import { DeleteProductUseCase } from './deleteProductUseCase';
import { Request, Response } from 'express';
import { productRepository } from '@modules/products/repositories';

class DeleteProductController {
  async handle(request: Request, response: Response) {
    const { product_code } = request.params;

    const deleteProductUseCase = new DeleteProductUseCase(productRepository);

    await deleteProductUseCase.execute({
      product_code,
    });

    return response
      .status(200)
      .json({ message: 'Product deleted successfully.' });
  }
}

export { DeleteProductController };
