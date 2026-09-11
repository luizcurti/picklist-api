import { ListProductsUseCase } from './listProductsUseCase';
import { Request, Response } from 'express';
import { productRepository } from '@modules/products/repositories';

class ListProductsController {
  async handle(request: Request, response: Response) {
    const { limit, offset } = request.query;

    const listProductsUseCase = new ListProductsUseCase(productRepository);

    const result = await listProductsUseCase.execute({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    return response.status(200).json(result);
  }
}

export { ListProductsController };
