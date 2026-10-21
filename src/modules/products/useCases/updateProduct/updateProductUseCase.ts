import { IRequest } from './iUpdateProductDTO';
import {
  IProductRepository,
  IProduct,
} from '@modules/products/repositories/iProductRepository';
import { withSpan } from '@shared/infra/tracing/withSpan';

class UpdateProductUseCase {
  constructor(private productRepository: IProductRepository) {}

  async execute({
    product_code,
    quantity,
    quantity_delta,
    pick_location,
  }: IRequest): Promise<IProduct> {
    return withSpan('UpdateProductUseCase.execute', async () => {
      // Validation guarantees exactly one of quantity/quantity_delta is set.
      if (quantity_delta !== undefined) {
        // Atomic in the repository — see IProductRepository.applyQuantityDelta.
        return this.productRepository.applyQuantityDelta(
          product_code,
          quantity_delta,
          pick_location
        );
      }

      // Absolute set — last-write-wins is intentional here, not a race.
      const data = await this.productRepository.findByID(product_code);
      data.quantity = quantity as number;
      data.pick_location = pick_location;

      return this.productRepository.update(data);
    });
  }
}

export { UpdateProductUseCase };
