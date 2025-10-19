import { AddCardUseCase } from '@/domain/use-cases/add-card-use-case';
import type { Handler } from 'aws-lambda';

type Input = { uetr: string; [k: string]: unknown };
type Output = Input & { cardLast4: string };

const addCardUseCase = new AddCardUseCase();

export const handler: Handler<Input, Output> = async (event) => {
  return await addCardUseCase.execute(event);
};
