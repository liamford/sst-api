import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

type Input = { uetr: string; [k: string]: unknown };
type Output = Input & { pointsAdded: number };

export class AddPointsUseCase {
  private ssmClient: SSMClient;

  constructor() {
    this.ssmClient = new SSMClient({ region: process.env.AWS_REGION });
  }

  async execute(event: Input): Promise<Output> {
    const paramName = process.env.POINTS_PARAM_NAME || '/app/rewards/points-per-user';

    const res = await this.ssmClient.send(
      new GetParameterCommand({
        Name: paramName,
        WithDecryption: false,
      }),
    );

    const raw = res.Parameter?.Value ?? '0';
    const points = Number.parseInt(raw, 10) || 0;

    return {
      ...event,
      pointsAdded: points,
    };
  }
}
