import { productRepository } from '@modules/products/repositories';
import { FindProductUseCase } from './findProductUseCase';
import { Request, Response } from 'express';

class FindProductController {
  async handle(request: Request, response: Response) {
    const { product_code } = request.params;

    const findProductUseCase = new FindProductUseCase(productRepository);

    const listData = await findProductUseCase.execute({
      product_code,
    });

    return response.status(200).json(listData);
  }
}

export { FindProductController };
