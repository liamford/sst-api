import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
export class ProcessUetrUseCase {
    constructor() {
        this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
        this.sfnClient = new SFNClient({ region: process.env.AWS_REGION });
    }
    async execute(request) {
        const { params } = request;
        const uetr = params?.uetr;
        if (!uetr) {
            return {
                status: 400,
                message: 'Missing uetr in path parameters',
            };
        }
        try {
            const getRes = await this.dynamoClient.send(new GetItemCommand({
                TableName: process.env.USERS_TABLE_NAME,
                Key: { [process.env.USERS_TABLE_PK || 'uetr']: { S: uetr } },
                ProjectionExpression: process.env.USERS_TABLE_PK || 'uetr',
            }));
            if (!getRes.Item) {
                return {
                    status: 404,
                    message: `User with ${process.env.USERS_TABLE_PK || 'uetr'}=${uetr} not found`,
                };
            }
            const startRes = await this.sfnClient.send(new StartExecutionCommand({
                stateMachineArn: process.env.REWARDS_STATE_MACHINE_ARN,
                name: `process-uetr-${uetr}-${Date.now()}`,
                input: JSON.stringify({ uetr }),
            }));
            return {
                status: 202,
                data: {
                    message: 'Processing started',
                    executionArn: startRes.executionArn,
                },
            };
        }
        catch (error) {
            console.error('process-uetr error', error);
            return {
                status: 500,
                message: 'Internal error starting workflow',
            };
        }
    }
}
//# sourceMappingURL=process-uetr-use-case.js.map