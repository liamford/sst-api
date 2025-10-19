import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
export class GetUsersUseCase {
    constructor() {
        this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    }
    async execute(request) {
        const { jwtClaims } = request;
        console.log('Request to get users list');
        const userName = jwtClaims?.username;
        if (!userName) {
            return {
                status: 401,
                message: 'Unauthorized: Missing user authentication',
            };
        }
        try {
            const scanCommand = new ScanCommand({
                TableName: process.env.TABLE_NAME,
                ProjectionExpression: 'uetr, #name, email, phone, userId, createdBy, createdAt',
                ExpressionAttributeNames: {
                    '#name': 'name',
                },
            });
            const result = await this.dynamoClient.send(scanCommand);
            const users = result.Items?.map((item) => ({
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
        }
        catch (error) {
            console.error('Error retrieving users:', error);
            return {
                status: 500,
                message: 'Internal server error',
            };
        }
    }
}
//# sourceMappingURL=get-users-use-case.js.map