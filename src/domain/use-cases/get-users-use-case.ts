import type { HttpRequest, HttpResponse, UseCase } from '@/types/http';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

interface GetUsersRequest {
  // Query parameters for pagination or filtering can be added here
  [key: string]: any;
}

export class GetUsersUseCase implements UseCase {
  private dynamoClient: DynamoDBClient;

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
  }

  async execute(request: HttpRequest<GetUsersRequest>): Promise<HttpResponse> {
    const { jwtClaims } = request;

    console.log('Request to get users list');

    const userName = jwtClaims?.username as string | undefined;

    if (!userName) {
      return {
        status: 401,
        message: 'Unauthorized: Missing user authentication',
      };
    }

    try {
      // Scan DynamoDB table to get all users
      const scanCommand = new ScanCommand({
        TableName: process.env.TABLE_NAME,
        // Optionally add ProjectionExpression to limit returned attributes
        ProjectionExpression: 'uetr, #name, email, phone, userId, createdBy, createdAt',
        ExpressionAttributeNames: {
          '#name': 'name', // 'name' is a reserved word in DynamoDB
        },
      });

      const result = await this.dynamoClient.send(scanCommand);

      // Transform DynamoDB items to a more readable format
      const users =
        result.Items?.map((item) => ({
          uetr: item.uetr?.S || '',
          name: item.name?.S || '',
          email: item.email?.S || '',
          phone: item.phone?.S || '',
          userId: item.userId?.S || '',
          createdBy: item.createdBy?.S || '',
          createdAt: item.createdAt?.S || '',
        })) || [];

      console.log(`Retrieved ${users.length} users from database`);

      return {
        status: 200,
        data: {
          users,
          count: users.length,
        },
      };
    } catch (error) {
      console.error('Error retrieving users:', error);
      return {
        status: 500,
        message: 'Internal server error',
      };
    }
  }
}
