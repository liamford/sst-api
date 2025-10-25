import type { HttpRequest, HttpResponse, UseCase } from '@/types/http';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

interface CreateProductRequest {
  productName: string;
  newPrice: number | string;
  oldPrice?: number | string;
  gender?: string;
  category?: string[] | string;
  colors?: string[] | string;
  rating?: number | string;
  onSale?: boolean | string;
  // image via multipart
  image?: { filename?: string; content?: Buffer; contentType?: string } | any;
  // or base64
  imageBase64?: string;
  fileName?: string;
  [key: string]: unknown;
}

export class CreateProductUseCase implements UseCase {
  private dynamoClient: DynamoDBClient;
  private s3Client: S3Client;

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.s3Client = new S3Client({ region: process.env.AWS_REGION });
  }

  async execute(request: HttpRequest<CreateProductRequest>): Promise<HttpResponse> {
    const { body, jwtClaims } = request;

    const userName = jwtClaims?.username as string | undefined;

    if (!userName) {
      return { status: 401, message: 'Unauthorized: Missing user authentication' };
    }

    const required = body?.productName && (body?.imageBase64 || (body as any)?.image?.content);
    if (!required) {
      return {
        status: 400,
        message: 'Missing required fields: productName and image (multipart "image" or { imageBase64, fileName })',
      };
    }

    const uetr = crypto.randomUUID();

    try {
      // Prepare image bytes and key
      const picturesBucket = process.env.PICTURES_BUCKET_NAME as string;
      const productsTable = process.env.PRODUCTS_TABLE_NAME as string;

      if (!picturesBucket || !productsTable) {
        return { status: 500, message: 'Server configuration error' };
      }

      let imageBuffer: Buffer | undefined;
      let fileName = (body as any).fileName as string | undefined;
      let contentType: string | undefined = (body as any)?.image?.contentType;

      const multipartImage = (body as any)?.image;
      if (multipartImage?.content) {
        imageBuffer = Buffer.isBuffer(multipartImage.content)
          ? multipartImage.content
          : Buffer.from(multipartImage.content);
        fileName = multipartImage.filename || fileName || `product-${uetr}.bin`;
      } else if (body.imageBase64) {
        const base64 = (body.imageBase64 as string).split(',').pop() as string;
        imageBuffer = Buffer.from(base64, 'base64');
        fileName = fileName || `product-${uetr}.bin`;
      }

      if (!imageBuffer) {
        return { status: 400, message: 'Invalid image payload' };
      }

      const safeFileName = fileName?.replace(/[^a-zA-Z0-9_.-]/g, '-') || `product-${uetr}.bin`;
      const key = `products/${uetr}-${safeFileName}`;

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: picturesBucket,
          Key: key,
          Body: imageBuffer,
          ContentType: contentType || 'application/octet-stream',
        }),
      );

      const s3Url = `https://${picturesBucket}.s3.amazonaws.com/${encodeURIComponent(key)}`;

      // Normalize fields
      const newPriceNum = Number(body.newPrice);
      const oldPriceNum = body.oldPrice != null ? Number(body.oldPrice) : undefined;
      const ratingNum = body.rating != null ? Number(body.rating) : undefined;
      const onSaleBool = typeof body.onSale === 'string' ? body.onSale === 'true' : Boolean(body.onSale);

      const catArr = Array.isArray(body.category)
        ? (body.category as string[])
        : typeof body.category === 'string' && body.category
          ? body.category.split(',').map((s) => s.trim()).filter(Boolean)
          : [];

      const colorsArr = Array.isArray(body.colors)
        ? (body.colors as string[])
        : typeof body.colors === 'string' && body.colors
          ? body.colors.split(',').map((s) => s.trim()).filter(Boolean)
          : [];

      const productItem = {
        uetr: { S: uetr },
        productName: { S: String(body.productName) },
        newPrice: { N: String(isNaN(newPriceNum) ? 0 : newPriceNum) },
        ...(oldPriceNum != null ? { oldPrice: { N: String(isNaN(oldPriceNum) ? 0 : oldPriceNum) } } : {}),
        ...(body.gender ? { gender: { S: String(body.gender) } } : {}),
        category: { L: catArr.map((c) => ({ S: c })) },
        colors: { L: colorsArr.map((c) => ({ S: c })) },
        ...(ratingNum != null ? { rating: { N: String(isNaN(ratingNum) ? 0 : ratingNum) } } : {}),
        onSale: { BOOL: onSaleBool },
        imageUrl: { S: s3Url },
        imageKey: { S: key },
        createdBy: { S: userName },
        createdAt: { S: new Date().toISOString() },
      } as const;

      await this.dynamoClient.send(
        new PutItemCommand({
          TableName: productsTable,
          Item: productItem as any,
        }),
      );

      return {
        status: 200,
        data: {
          uetr,
          imageUrl: s3Url,
          message: 'Product created successfully',
        },
      };
    } catch (error) {
      console.error('Error creating product:', error);
      return { status: 500, message: 'Internal server error' };
    }
  }
}
