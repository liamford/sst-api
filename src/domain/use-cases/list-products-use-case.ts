import type { HttpRequest, HttpResponse, UseCase } from '@/types/http';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface ListProductsRequest {
  [key: string]: any;
}

export class ListProductsUseCase implements UseCase {
  private dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
  private s3 = new S3Client({ region: process.env.AWS_REGION });

  async execute(request: HttpRequest<ListProductsRequest>): Promise<HttpResponse> {
    const { jwtClaims } = request;

    const userName = jwtClaims?.username as string | undefined;
    if (!userName) {
      return { status: 401, message: 'Unauthorized: Missing user authentication' };
    }

    const productsTable = process.env.PRODUCTS_TABLE_NAME as string;
    const picturesBucket = process.env.PICTURES_BUCKET_NAME as string;
    if (!productsTable || !picturesBucket) {
      return { status: 500, message: 'Server configuration error' };
    }

    try {
      const out = await this.dynamo.send(new ScanCommand({ TableName: productsTable }));
      const items = out.Items || [];

      const results = await Promise.all(
        items.map(async (it: any) => {
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
          };

          const imageKey = it.imageKey?.S ?? decodeURIComponent(new URL(it.imageUrl?.S).pathname.replace(/^\//, ''));

          const signed = await getSignedUrl(
            this.s3,
            new GetObjectCommand({ Bucket: picturesBucket, Key: imageKey }),
            { expiresIn: 3600 },
          );

          product.imageUrl = signed;
          return product;
        })
      );

      return { status: 200, data: { items: results } };
    } catch (err) {
      console.error('Error listing products:', err);
      return { status: 500, message: 'Internal server error' };
    }
  }
}
