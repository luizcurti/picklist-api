import { IRequest, IResponse } from './iFindProductDTO';
import { IProductRepository } from '@modules/products/repositories/iProductRepository';
import { withSpan } from '@shared/infra/tracing/withSpan';

class FindProductUseCase {
  constructor(private productRepository: IProductRepository) {}

  async execute({ product_code }: IRequest): Promise<IResponse> {
    return withSpan('FindProductUseCase.execute', () =>
      // Every adapter throws its own 404 on a miss — nothing to check here.
      this.productRepository.findByID(product_code)
    );
  }
}

export { FindProductUseCase };
