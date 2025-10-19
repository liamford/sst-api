import type { HttpRequest, HttpResponse, UseCase } from '@/types/http';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

interface UserInfoRequest {
  name: string;
  email: string;
  phone?: string;
  userId: string;
  [key: string]: any;
}

export class UserInfoUseCase implements UseCase {
  private dynamoClient: DynamoDBClient;
  private s3Client: S3Client;

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.s3Client = new S3Client({ region: process.env.AWS_REGION });
  }

  async execute(request: HttpRequest<UserInfoRequest>): Promise<HttpResponse> {
    const { body, jwtClaims } = request;

    console.log(`request to add user with ID: ${body.userId}`);

    const userName = jwtClaims?.username as string | undefined;

    if (!body.name || !body.email || !body.userId || !userName) {
      return {
        status: 400,
        message: 'Missing required fields: name, email, userId',
      };
    }

    const uetr = crypto.randomUUID();

    try {
      // Save user data to DynamoDB
      const userRecord = {
        fileKey: { S: `${uetr}-${body.userId}` },
        uetr: { S: uetr },
        name: { S: body.name },
        email: { S: body.email },
        phone: { S: body.phone || '' },
        userId: { S: body.userId },
        createdBy: { S: userName },
        createdAt: { S: new Date().toISOString() },
      };

      await this.dynamoClient.send(
        new PutItemCommand({
          TableName: process.env.TABLE_NAME,
          Item: userRecord,
        }),
      );

      // Create JSON file and upload to S3
      const userData = {
        name: body.name,
        email: body.email,
        phone: body.phone || '',
        userId: body.userId,
        uetr: uetr,
        createdAt: new Date().toISOString(),
      };

      const jsonContent = JSON.stringify(userData, null, 2);
      const fileName = `${body.userId}.json`;

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.BUCKET_NAME,
          Key: fileName,
          Body: jsonContent,
          ContentType: 'application/json',
        }),
      );

      console.log(`User added successfully with ID: ${body.userId}`);

      return {
        status: 200,
        data: {
          message: 'User information saved successfully',
          userId: body.userId,
          fileName: fileName,
        },
      };
    } catch (error) {
      console.error('Error processing user information:', error);
      return {
        status: 500,
        message: 'Internal server error',
      };
    }
  }
}
