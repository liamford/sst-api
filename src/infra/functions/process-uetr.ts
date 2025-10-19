import { ProcessUetrUseCase } from '@/domain/use-cases/process-uetr-use-case';
import { httpAdapt } from '@/infra/adapters/http';

export const handler = httpAdapt(new ProcessUetrUseCase());
