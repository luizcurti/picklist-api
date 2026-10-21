import { IRequest } from './iDeleteProductDTO';
import { IProductRepository } from '@modules/products/repositories/iProductRepository';
import { withSpan } from '@shared/infra/tracing/withSpan';

class DeleteProductUseCase {
  constructor(private productRepository: IProductRepository) {}

  async execute({ product_code }: IRequest): Promise<void> {
    await withSpan('DeleteProductUseCase.execute', () =>
      this.productRepository.remove(product_code)
    );
  }
}

export { DeleteProductUseCase };
