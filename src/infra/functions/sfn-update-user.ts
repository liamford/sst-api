import { UpdateUserUseCase } from '@/domain/use-cases/update-user-use-case';
import type { Handler } from 'aws-lambda';

type Input = {
  uetr: string;
  pointsAdded: number;
  cardLast4: string;
  [k: string]: unknown;
};
type Output = Input & { updated: true };

const updateUserUseCase = new UpdateUserUseCase();

export const handler: Handler<Input, Output> = async (event) => {
  return await updateUserUseCase.execute(event);
};
