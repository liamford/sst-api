import { GetUsersUseCase } from '@/domain/use-cases/get-users-use-case';
import { httpAdapt } from '@/infra/adapters/http';

export const handler = httpAdapt(new GetUsersUseCase());
