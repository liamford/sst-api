import type { HttpRequest, HttpResponse, UseCase } from '@/types/http';
import { DynamoDBClient, ScanCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface ListProductsRequest {
  [key: string]: any;
}

function parseCSV(val?: string | null): string[] | undefined {
  if (!val) return undefined;
  return String(val)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function normalizeSort(val?: string | null): 'price_asc' | 'price_desc' | undefined {
  if (!val) return undefined;
  const v = String(val).toLowerCase();
  if (v === 'price_asc' || v === 'price:asc' || v === 'price-asc' || v === 'asc') return 'price_asc';
  if (v === 'price_desc' || v === 'price:desc' || v === 'price-desc' || v === 'desc') return 'price_desc';
  return undefined;
}

function pricePredicate(range?: string | null): ((p: any) => boolean) | undefined {
  if (!range) return undefined;
  const v = String(range).toLowerCase();
  // support multiple aliases
  if (v === 'below25' || v === 'lt25' || v === '<25') return (p) => typeof p.newPrice === 'number' && p.newPrice < 25;
  if (v === '25to75' || v === 'between25-75' || v === '25-75' || v === 'btw25-75')
    return (p) => typeof p.newPrice === 'number' && p.newPrice >= 25 && p.newPrice <= 75;
  if (v === 'above75' || v === 'gt75' || v === '>75' || v === 'morethan75')
    return (p) => typeof p.newPrice === 'number' && p.newPrice > 75;
  return undefined;
}

function toNumber(val?: string | null): number | undefined {
  if (val == null) return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

export class ListProductsUseCase implements UseCase {
  private dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
  private s3 = new S3Client({ region: process.env.AWS_REGION });

  async execute(request: HttpRequest<ListProductsRequest>): Promise<HttpResponse> {
    const { jwtClaims, query } = request as any;

    const userName = jwtClaims?.username as string | undefined;
    if (!userName) {
      return { status: 401, message: 'Unauthorized: Missing user authentication' };
    }

    const productsTable = process.env.PRODUCTS_TABLE_NAME as string;
    const picturesBucket = process.env.PICTURES_BUCKET_NAME as string;
    if (!productsTable || !picturesBucket) {
      return { status: 500, message: 'Server configuration error' };
    }

    // Parse query params
    const genders = parseCSV(query?.gender);
    const category = (query?.category as string | undefined)?.trim(); // one item
    const colors = parseCSV(query?.colors);
    const priceRange = query?.price as string | undefined; // below25 | 25to75 | above75 (also aliases)
    const minRating = toNumber(query?.rating);
    const sort = normalizeSort(query?.sort) ?? undefined; // price_asc | price_desc

    const page = Math.max(1, Math.trunc(toNumber(query?.page) || 1));
    const pageSize = Math.min(100, Math.max(1, Math.trunc(toNumber(query?.pageSize) || 20)));

    // Attempt DynamoDB-native Query on GSI for sorting/filtering/pagination
    try {
      const cursorStr = typeof query?.cursor === 'string' ? query.cursor : undefined;
      let exclusiveStartKey: any = undefined;
      if (cursorStr) {
        try { exclusiveStartKey = JSON.parse(Buffer.from(cursorStr, 'base64').toString('utf8')); } catch {}
      }

      const exprNames: Record<string, string> = { '#pk': 'pk', '#newPrice': 'newPrice', '#gender': 'gender', '#category': 'category', '#colors': 'colors', '#rating': 'rating' };
      const exprVals: Record<string, any> = { ':pk': { S: 'PRODUCT' } };

      // Build key condition
      let keyCond = '#pk = :pk';
      const priceStr = priceRange || '';
      if (/^(below25|lt25|<25)$/i.test(priceStr)) {
        exprVals[':pHi'] = { N: '25' };
        keyCond += ' AND #newPrice < :pHi';
      } else if (/^(25to75|between25-75|25-75|btw25-75)$/i.test(priceStr)) {
        exprVals[':pLo'] = { N: '25' };
        exprVals[':pHi'] = { N: '75' };
        keyCond += ' AND #newPrice BETWEEN :pLo AND :pHi';
      } else if (/^(above75|gt75|>75|morethan75)$/i.test(priceStr)) {
        exprVals[':pLo'] = { N: '75' };
        keyCond += ' AND #newPrice > :pLo';
      }

      // Build filters
      const filters: string[] = [];
      if (genders && genders.length) {
        const placeholders = genders.map((g, i) => {
          exprVals[`:g${i}`] = { S: g };
          return `:g${i}`;
        });
        filters.push(`#gender IN (${placeholders.join(',')})`);
      }
      if (category) {
        exprVals[':cat'] = { S: category };
        filters.push('contains(#category, :cat)');
      }
      if (colors && colors.length) {
        const clauses = colors.map((c, i) => {
          exprVals[`:c${i}`] = { S: c };
          return `contains(#colors, :c${i})`;
        });
        filters.push(`(${clauses.join(' OR ')})`);
      }
      if (typeof minRating === 'number') {
        exprVals[':minRating'] = { N: String(minRating) };
        filters.push('#rating >= :minRating');
      }

      const queryInput: any = {
        TableName: productsTable,
        IndexName: 'gsi1-price',
        KeyConditionExpression: keyCond,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprVals,
        Limit: pageSize,
        ExclusiveStartKey: exclusiveStartKey,
        ScanIndexForward: sort !== 'price_desc',
      };
      if (filters.length) queryInput.FilterExpression = filters.join(' AND ');

      const out = await this.dynamo.send(new QueryCommand(queryInput));
      const items = out.Items || [];

      // Map and sign for returned items only
      const mapped = items.map((it: any) => ({
        uetr: it.uetr?.S,
        productName: it.productName?.S,
        newPrice: it.newPrice?.N ? Number(it.newPrice.N) : undefined,
        oldPrice: it.oldPrice?.N ? Number(it.oldPrice.N) : undefined,
        gender: it.gender?.S,
        category: (it.category?.L || []).map((x: any) => x.S),
        colors: (it.colors?.L || []).map((x: any) => x.S),
        rating: it.rating?.N ? Number(it.rating.N) : undefined,
        onSale: it.onSale?.BOOL ?? false,
        createdBy: it.createdBy?.S,
        createdAt: it.createdAt?.S,
        _imageKey: it.imageKey?.S,
        _imageUrl: it.imageUrl?.S,
      }));

      const results = await Promise.all(
        mapped.map(async (p: any) => {
          let imageKey = p._imageKey as string | undefined;
          if (!imageKey && p._imageUrl) {
            try { const url = new URL(p._imageUrl); imageKey = decodeURIComponent(url.pathname.replace(/^\//, '')); } catch {}
          }
          if (imageKey) {
            try {
              const signed = await getSignedUrl(this.s3, new GetObjectCommand({ Bucket: picturesBucket, Key: imageKey }), { expiresIn: 3600 });
              p.imageUrl = signed;
            } catch {}
          }
          delete p._imageKey; delete p._imageUrl; return p;
        })
      );

      const lastKey = out.LastEvaluatedKey;
      const nextCursor = lastKey ? Buffer.from(JSON.stringify(lastKey), 'utf8').toString('base64') : null;

      return {
        status: 200,
        data: {
          items: results,
          pagination: {
            page: null,
            pageSize,
            total: null,
            totalPages: null,
            hasNext: Boolean(lastKey),
            nextCursor,
          },
          appliedFilters: {
            genders: genders ?? null,
            category: category ?? null,
            colors: colors ?? null,
            price: priceRange ?? null,
            rating: typeof minRating === 'number' ? minRating : null,
            sort: sort ?? null,
          },
        },
      };
    } catch (e) { /* fallback to scan-based implementation below while index deploy/backfill */ }

    try {
      // Scan entire table (minimal changes) and filter/sort/paginate in-memory
      // If the table is large, consider moving filters to DynamoDB FilterExpression in a future improvement.
      let allItems: any[] = [];
      let lastKey: any = undefined;
      do {
        const out = await this.dynamo.send(
          new ScanCommand({ TableName: productsTable, ExclusiveStartKey: lastKey })
        );
        allItems = allItems.concat(out.Items || []);
        lastKey = out.LastEvaluatedKey;
      } while (lastKey);

      // Map raw items to product objects first without signing to allow filtering/sorting on fields
      const mapped = allItems.map((it: any) => {
        const product: any = {
          uetr: it.uetr?.S,
          productName: it.productName?.S,
          newPrice: it.newPrice?.N ? Number(it.newPrice.N) : undefined,
          oldPrice: it.oldPrice?.N ? Number(it.oldPrice.N) : undefined,
          gender: it.gender?.S,
          category: (it.category?.L || []).map((x: any) => x.S),
          colors: (it.colors?.L || []).map((x: any) => x.S),
          rating: it.rating?.N ? Number(it.rating.N) : undefined,
          onSale: it.onSale?.BOOL ?? false,
          createdBy: it.createdBy?.S,
          createdAt: it.createdAt?.S,
          _imageKey: it.imageKey?.S,
          _imageUrl: it.imageUrl?.S,
        };
        return product;
      });

      // Apply filters
      let filtered = mapped;
      if (genders && genders.length) {
        const set = new Set(genders.map((g) => g.toLowerCase()));
        filtered = filtered.filter((p) => p.gender && set.has(String(p.gender).toLowerCase()));
      }
      if (category) {
        filtered = filtered.filter((p) => Array.isArray(p.category) && p.category.includes(category));
      }
      if (colors && colors.length) {
        const set = new Set(colors.map((c) => c.toLowerCase()));
        filtered = filtered.filter(
          (p) => Array.isArray(p.colors) && p.colors.some((c: string) => set.has(String(c).toLowerCase()))
        );
      }
      const priceFn = pricePredicate(priceRange);
      if (priceFn) {
        filtered = filtered.filter(priceFn);
      }
      if (typeof minRating === 'number') {
        filtered = filtered.filter((p) => typeof p.rating === 'number' && p.rating >= (minRating as number));
      }

      // Sorting
      if (sort === 'price_asc' || sort === 'price_desc') {
        filtered.sort((a, b) => {
          const pa = typeof a.newPrice === 'number' ? a.newPrice : Number.POSITIVE_INFINITY;
          const pb = typeof b.newPrice === 'number' ? b.newPrice : Number.POSITIVE_INFINITY;
          const cmp = pa - pb;
          return sort === 'price_asc' ? cmp : -cmp;
        });
      }

      // Pagination
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * pageSize;
      const end = Math.min(start + pageSize, total);
      const pageItems = filtered.slice(start, end);

      // Sign S3 URLs for paginated items only
      const results = await Promise.all(
        pageItems.map(async (p: any) => {
          let imageKey = p._imageKey as string | undefined;
          if (!imageKey && p._imageUrl) {
            try {
              const url = new URL(p._imageUrl);
              imageKey = decodeURIComponent(url.pathname.replace(/^\//, ''));
            } catch {}
          }

          if (imageKey) {
            try {
              const signed = await getSignedUrl(
                this.s3,
                new GetObjectCommand({ Bucket: picturesBucket, Key: imageKey }),
                { expiresIn: 3600 },
              );
              p.imageUrl = signed;
            } catch {
              // ignore signing error; leave imageUrl undefined
            }
          }

          // cleanup internals
          delete p._imageKey;
          delete p._imageUrl;
          return p;
        })
      );

      return {
        status: 200,
        data: {
          items: results,
          pagination: {
            page: safePage,
            pageSize,
            total,
            totalPages,
            hasNext: safePage < totalPages,
          },
          appliedFilters: {
            genders: genders ?? null,
            category: category ?? null,
            colors: colors ?? null,
            price: priceRange ?? null,
            rating: typeof minRating === 'number' ? minRating : null,
            sort: sort ?? null,
          },
        },
      };
    } catch (err) {
      console.error('Error listing products:', err);
      return { status: 500, message: 'Internal server error' };
    }
  }
}
