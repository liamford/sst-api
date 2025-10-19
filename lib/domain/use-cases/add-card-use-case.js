import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
export class AddCardUseCase {
    constructor() {
        this.ssmClient = new SSMClient({ region: process.env.AWS_REGION });
    }
    async execute(event) {
        const paramName = process.env.CC_PARAM_NAME || '/app/rewards/credit-card-secret';
        const res = await this.ssmClient.send(new GetParameterCommand({
            Name: paramName,
            WithDecryption: true,
        }));
        const token = res.Parameter?.Value ?? '';
        const last4 = token.slice(-4) || '0000';
        return {
            ...event,
            cardLast4: last4,
        };
    }
}
//# sourceMappingURL=add-card-use-case.js.map