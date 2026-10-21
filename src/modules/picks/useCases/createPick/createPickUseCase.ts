import { randomUUID } from 'crypto';
import { IPickQueue } from '@modules/picks/queue/iPickQueue';
import { IIdempotencyStore } from '@shared/infra/idempotency/iIdempotencyStore';
import { IdempotencyKeyConflictError } from '@modules/picks/errors/pickErrors';
import { withSpan } from '@shared/infra/tracing/withSpan';
import { IRequest, IResponse } from '../../dtos/iCreatePickDTO';

class CreatePickUseCase {
  constructor(
    private pickQueue: IPickQueue,
    private idempotencyStore: IIdempotencyStore
  ) {}

  async execute({
    product_code,
    quantity,
    pick_location,
    idempotencyKey,
  }: IRequest): Promise<IResponse> {
    return withSpan('CreatePickUseCase.execute', async () => {
      const pickId = randomUUID();

      if (idempotencyKey) {
        const claimed = await this.idempotencyStore.setIfAbsent(
          idempotencyKey,
          { pickId, product_code, quantity, pick_location }
        );

        if (!claimed) {
          // Another request already holds this key — claiming and
          // publishing are two separate steps, so this closes the window
          // between them rather than a plain get-then-set, which two
          // concurrent requests (or two replicas) could both pass.
          const existing = await this.idempotencyStore.get(idempotencyKey);

          // A missing entry here (claim lost, but the winner's entry is
          // already gone) is only reachable if it expired in the instant
          // between the failed claim and this read — treat it as "no
          // conflict" rather than adding a retry loop for a near-impossible race.
          if (existing) {
            const sameRequest =
              existing.product_code === product_code &&
              existing.quantity === quantity &&
              existing.pick_location === pick_location;

            if (!sameRequest) {
              throw new IdempotencyKeyConflictError(idempotencyKey);
            }

            return { pickId: existing.pickId };
          }
        }
      }

      await this.pickQueue.publishPickCreated({
        pickId,
        product_code,
        quantity,
        pick_location,
      });

      return { pickId };
    });
  }
}

export { CreatePickUseCase };
