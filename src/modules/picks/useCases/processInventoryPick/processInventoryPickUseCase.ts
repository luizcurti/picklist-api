import { IProductRepository } from '@modules/products/repositories/iProductRepository';
import {
  InvalidQuantityDeltaError,
  ProductNotFoundError,
} from '@modules/products/errors/productErrors';
import { IPickEvent, IPickQueue } from '@modules/picks/queue/iPickQueue';
import { logger } from '@shared/utils/logger';
import { withSpan } from '@shared/infra/tracing/withSpan';

class ProcessInventoryPickUseCase {
  constructor(
    private productRepository: IProductRepository,
    private pickQueue: IPickQueue
  ) {}

  async execute(event: IPickEvent): Promise<void> {
    return withSpan('ProcessInventoryPickUseCase.execute', async () => {
      const { pickId, product_code, quantity, pick_location } = event;

      try {
        // Atomic decrement, not a findByID-then-update race — see IProductRepository.applyQuantityDelta.
        await this.productRepository.applyQuantityDelta(
          product_code,
          -quantity
        );
      } catch (error) {
        if (error instanceof ProductNotFoundError) {
          logger.warn('Pick failed: product not found', {
            pickId,
            product_code,
          });
          await this.pickQueue.publishPickFailed({
            pickId,
            product_code,
            quantity,
            pick_location,
            reason: 'PRODUCT_NOT_FOUND',
          });
          return;
        }

        if (error instanceof InvalidQuantityDeltaError) {
          logger.warn('Pick failed: insufficient stock', {
            pickId,
            product_code,
            requested: quantity,
          });
          await this.pickQueue.publishPickFailed({
            pickId,
            product_code,
            quantity,
            pick_location,
            reason: 'INSUFFICIENT_STOCK',
          });
          return;
        }

        // Unexpected failure — propagate so consumeWithRetry retries it.
        throw error;
      }

      logger.info('Pick completed', { pickId, product_code, quantity });
      await this.pickQueue.publishPickCompleted({
        pickId,
        product_code,
        quantity,
        pick_location,
      });
    });
  }
}

export { ProcessInventoryPickUseCase };
