import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
export class UpdateUserUseCase {
    constructor() {
        this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    }
    async execute(event) {
        const { uetr, pointsAdded, cardLast4 } = event;
        const nowIso = new Date().toISOString();
        const tableName = process.env.USERS_TABLE_NAME;
        const tablePK = process.env.USERS_TABLE_PK || 'uetr';
        await this.dynamoClient.send(new UpdateItemCommand({
            TableName: tableName,
            Key: { [tablePK]: { S: uetr } },
            UpdateExpression: 'SET rewardsPoints = :p, cardLast4 = :l, updatedAt = :u',
            ExpressionAttributeValues: {
                ':p': { N: String(pointsAdded ?? 0) },
                ':l': { S: cardLast4 ?? '' },
                ':u': { S: nowIso },
            },
        }));
        return { ...event, updated: true };
    }
}
//# sourceMappingURL=update-user-use-case.js.map