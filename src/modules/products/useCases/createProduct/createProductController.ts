import { CreateProductUseCase } from './createProductUseCase';
import { Request, Response } from 'express';
import { productRepository } from '@modules/products/repositories';

class CreateProductController {
  async handle(request: Request, response: Response) {
    const { product_code, quantity, pick_location } = request.body;

    const createProductUseCase = new CreateProductUseCase(productRepository);

    const newProduct = await createProductUseCase.execute({
      product_code,
      quantity,
      pick_location,
    });

    return response.status(201).json(newProduct);
  }
}

export { CreateProductController };
