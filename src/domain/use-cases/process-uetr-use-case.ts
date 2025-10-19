import type { HttpRequest, HttpResponse, UseCase } from '@/types/http';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';

interface ProcessUetrRequest {
  uetr?: string;
  [key: string]: any;
}

export class ProcessUetrUseCase implements UseCase {
  private dynamoClient: DynamoDBClient;
  private sfnClient: SFNClient;

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.sfnClient = new SFNClient({ region: process.env.AWS_REGION });
  }

  async execute(request: HttpRequest<ProcessUetrRequest>): Promise<HttpResponse> {
    const { params } = request;
    const uetr = params?.uetr;

    if (!uetr) {
      return {
        status: 400,
        message: 'Missing uetr in path parameters',
      };
    }

    try {
      // 1) Verify user exists in DynamoDB
      const getRes = await this.dynamoClient.send(
        new GetItemCommand({
          TableName: process.env.USERS_TABLE_NAME!,
          Key: { [process.env.USERS_TABLE_PK || 'uetr']: { S: uetr } },
          ProjectionExpression: process.env.USERS_TABLE_PK || 'uetr',
        }),
      );

      if (!getRes.Item) {
        return {
          status: 404,
          message: `User with ${process.env.USERS_TABLE_PK || 'uetr'}=${uetr} not found`,
        };
      }

      // 2) Start Step Functions workflow
      const startRes = await this.sfnClient.send(
        new StartExecutionCommand({
          stateMachineArn: process.env.REWARDS_STATE_MACHINE_ARN!,
          name: `process-uetr-${uetr}-${Date.now()}`,
          input: JSON.stringify({ uetr }),
        }),
      );

      return {
        status: 202,
        data: {
          message: 'Processing started',
          executionArn: startRes.executionArn,
        },
      };
    } catch (error) {
      console.error('process-uetr error', error);
      return {
        status: 500,
        message: 'Internal error starting workflow',
      };
    }
  }
}
