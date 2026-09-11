import { Request, Response } from 'express';
import { CreatePickUseCase } from './createPickUseCase';
import { rabbitMQPickQueue } from '@modules/picks/queue/rabbitMQPickQueue';
import { idempotencyStore } from '@shared/infra/idempotency';

class CreatePickController {
  async handle(request: Request, response: Response) {
    const { product_code, quantity, pick_location } = request.body;
    const idempotencyKeyHeader = request.headers['idempotency-key'];
    const idempotencyKey =
      typeof idempotencyKeyHeader === 'string'
        ? idempotencyKeyHeader
        : undefined;

    const createPickUseCase = new CreatePickUseCase(
      rabbitMQPickQueue,
      idempotencyStore
    );

    const { pickId } = await createPickUseCase.execute({
      product_code,
      quantity,
      pick_location,
      idempotencyKey,
    });

    return response.status(202).json({ pickId, status: 'accepted' });
  }
}

export { CreatePickController };
