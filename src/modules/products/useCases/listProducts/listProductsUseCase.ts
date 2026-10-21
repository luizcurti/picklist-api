import {
  IProductRepository,
  PaginatedResult,
  IProduct,
  PaginationOptions,
} from '@modules/products/repositories/iProductRepository';
import { withSpan } from '@shared/infra/tracing/withSpan';

class ListProductsUseCase {
  constructor(private productRepository: IProductRepository) {}

  async execute(
    options?: PaginationOptions
  ): Promise<PaginatedResult<IProduct>> {
    return withSpan('ListProductsUseCase.execute', () =>
      this.productRepository.findAll(options)
    );
  }
}

export { ListProductsUseCase };
