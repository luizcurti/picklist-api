import { productRepository } from '@modules/products/repositories';
import { rabbitMQPickQueue } from '@modules/picks/queue/rabbitMQPickQueue';
import { IPickEvent } from '@modules/picks/queue/iPickQueue';
import { ProcessInventoryPickUseCase } from './processInventoryPickUseCase';

function isPickCreatedEvent(event: unknown): event is IPickEvent {
  if (!event || typeof event !== 'object') return false;
  const candidate = event as Record<string, unknown>;
  return (
    typeof candidate.pickId === 'string' &&
    typeof candidate.product_code === 'string' &&
    typeof candidate.quantity === 'number' &&
    typeof candidate.pick_location === 'string'
  );
}

async function handlePickCreated(event: unknown): Promise<void> {
  if (!isPickCreatedEvent(event)) {
    throw new Error('Malformed pick.created event payload');
  }

  const useCase = new ProcessInventoryPickUseCase(
    productRepository,
    rabbitMQPickQueue
  );

  await useCase.execute(event);
}

export { handlePickCreated, isPickCreatedEvent };
