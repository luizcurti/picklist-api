import { UpdateProductUseCase } from './updateProductUseCase';
import { Request, Response } from 'express';
import { productRepository } from '@modules/products/repositories';

class UpdateProductController {
  async handle(request: Request, response: Response) {
    const { product_code } = request.params;
    const { quantity, quantity_delta, pick_location } = request.body;

    const updateProductUseCase = new UpdateProductUseCase(productRepository);

    const dataUpdated = await updateProductUseCase.execute({
      product_code,
      quantity,
      quantity_delta,
      pick_location,
    });

    return response.status(200).json(dataUpdated);
  }
}

export { UpdateProductController };
