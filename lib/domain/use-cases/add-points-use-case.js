import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
export class AddPointsUseCase {
    constructor() {
        this.ssmClient = new SSMClient({ region: process.env.AWS_REGION });
    }
    async execute(event) {
        const paramName = process.env.POINTS_PARAM_NAME || '/app/rewards/points-per-user';
        const res = await this.ssmClient.send(new GetParameterCommand({
            Name: paramName,
            WithDecryption: false,
        }));
        const raw = res.Parameter?.Value ?? '0';
        const points = Number.parseInt(raw, 10) || 0;
        return {
            ...event,
            pointsAdded: points,
        };
    }
}
//# sourceMappingURL=add-points-use-case.js.map