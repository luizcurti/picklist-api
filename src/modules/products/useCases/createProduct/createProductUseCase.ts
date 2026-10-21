import { AppError } from '@errors/appError';
import {
  IProductRepository,
  IProduct,
} from '@modules/products/repositories/iProductRepository';
import { withSpan } from '@shared/infra/tracing/withSpan';

class CreateProductUseCase {
  constructor(private productRepository: IProductRepository) {}

  async execute({
    product_code,
    quantity,
    pick_location,
  }: {
    product_code: string;
    quantity: number;
    pick_location: string;
  }): Promise<IProduct> {
    try {
      const createProduct = await withSpan('CreateProductUseCase.execute', () =>
        this.productRepository.create({
          product_code,
          quantity,
          pick_location,
        })
      );

      return createProduct;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to create data',
        500,
        'Internal Server Error',
        error
      );
    }
  }
}

export { CreateProductUseCase };
