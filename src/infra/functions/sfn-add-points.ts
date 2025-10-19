import { AddPointsUseCase } from '@/domain/use-cases/add-points-use-case';
import type { Handler } from 'aws-lambda';

type Input = { uetr: string; [k: string]: unknown };
type Output = Input & { pointsAdded: number };

const addPointsUseCase = new AddPointsUseCase();

export const handler: Handler<Input, Output> = async (event) => {
  return await addPointsUseCase.execute(event);
};
