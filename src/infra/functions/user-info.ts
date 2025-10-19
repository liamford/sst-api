import { UserInfoUseCase } from '@/domain/use-cases/user-info-use-case';
import { httpAdapt } from '@/infra/adapters/http';

export const handler = httpAdapt(new UserInfoUseCase());
