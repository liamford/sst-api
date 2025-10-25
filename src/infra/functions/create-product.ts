import { CreateProductUseCase } from '@/domain/use-cases/create-product-use-case';
import { httpAdapt } from '@/infra/adapters/http';

export const handler = httpAdapt(new CreateProductUseCase());
