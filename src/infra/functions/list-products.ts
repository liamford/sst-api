import { ListProductsUseCase } from '@/domain/use-cases/list-products-use-case';
import { httpAdapt } from '@/infra/adapters/http';

export const handler = httpAdapt(new ListProductsUseCase());
