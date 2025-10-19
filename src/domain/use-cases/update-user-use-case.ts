import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

type Input = {
  uetr: string;
  pointsAdded: number;
  cardLast4: string;
  [k: string]: unknown;
};
type Output = Input & { updated: true };

export class UpdateUserUseCase {
  private dynamoClient: DynamoDBClient;

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
  }

  async execute(event: Input): Promise<Output> {
    const { uetr, pointsAdded, cardLast4 } = event;
    const nowIso = new Date().toISOString();
    const tableName = process.env.USERS_TABLE_NAME!;
    const tablePK = process.env.USERS_TABLE_PK || 'uetr';

    await this.dynamoClient.send(
      new UpdateItemCommand({
        TableName: tableName,
        Key: { [tablePK]: { S: uetr } },
        UpdateExpression: 'SET rewardsPoints = :p, cardLast4 = :l, updatedAt = :u',
        ExpressionAttributeValues: {
          ':p': { N: String(pointsAdded ?? 0) },
          ':l': { S: cardLast4 ?? '' },
          ':u': { S: nowIso },
        },
      }),
    );

    return { ...event, updated: true };
  }
}
