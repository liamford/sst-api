import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

type Input = { uetr: string; [k: string]: unknown };
type Output = Input & { cardLast4: string };

export class AddCardUseCase {
  private ssmClient: SSMClient;

  constructor() {
    this.ssmClient = new SSMClient({ region: process.env.AWS_REGION });
  }

  async execute(event: Input): Promise<Output> {
    const paramName = process.env.CC_PARAM_NAME || '/app/rewards/credit-card-secret';

    const res = await this.ssmClient.send(
      new GetParameterCommand({
        Name: paramName,
        WithDecryption: true,
      }),
    );

    // Do NOT log or return the secret. Derive a safe value to store.
    const token = res.Parameter?.Value ?? '';
    const last4 = token.slice(-4) || '0000';

    return {
      ...event,
      cardLast4: last4,
    };
  }
}
