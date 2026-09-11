import { CreatePickUseCase } from '@modules/picks/useCases/createPick/createPickUseCase';
import { InMemoryPickQueue } from './InMemoryPickQueue';
import { InMemoryIdempotencyStore } from '@shared/infra/idempotency/inMemoryIdempotencyStore';

describe('CreatePickUseCase', () => {
  let pickQueue: InMemoryPickQueue;
  let idempotencyStore: InMemoryIdempotencyStore;
  let useCase: CreatePickUseCase;

  beforeEach(() => {
    pickQueue = new InMemoryPickQueue();
    idempotencyStore = new InMemoryIdempotencyStore();
    useCase = new CreatePickUseCase(pickQueue, idempotencyStore);
  });

  it('publishes a pick.created event and returns a new pick id', async () => {
    const result = await useCase.execute({
      product_code: 'SKU-1',
      quantity: 2,
      pick_location: 'A1',
    });

    expect(result.pickId).toEqual(expect.any(String));
    expect(pickQueue.created).toHaveLength(1);
    expect(pickQueue.created[0]).toMatchObject({
      product_code: 'SKU-1',
      quantity: 2,
      pick_location: 'A1',
    });
  });

  it('always publishes when no idempotency key is supplied', async () => {
    await useCase.execute({
      product_code: 'SKU-1',
      quantity: 1,
      pick_location: 'A1',
    });
    await useCase.execute({
      product_code: 'SKU-1',
      quantity: 1,
      pick_location: 'A1',
    });

    expect(pickQueue.created).toHaveLength(2);
  });

  it('publishes once for a fresh idempotency key', async () => {
    const result = await useCase.execute({
      product_code: 'SKU-1',
      quantity: 1,
      pick_location: 'A1',
      idempotencyKey: 'key-1',
    });

    expect(pickQueue.created).toHaveLength(1);
    expect(result.pickId).toBe(pickQueue.created[0].pickId);
  });

  it('does not republish and returns the cached pick id for a repeated key', async () => {
    const first = await useCase.execute({
      product_code: 'SKU-1',
      quantity: 1,
      pick_location: 'A1',
      idempotencyKey: 'key-2',
    });

    const second = await useCase.execute({
      product_code: 'SKU-1',
      quantity: 1,
      pick_location: 'A1',
      idempotencyKey: 'key-2',
    });

    expect(pickQueue.created).toHaveLength(1);
    expect(second.pickId).toBe(first.pickId);
  });

  it('rejects a repeated idempotency key used with a different payload', async () => {
    // A replayed key must be compared against the original payload, not
    // just handed back the cached pickId — otherwise the caller has no way
    // to tell their new payload was never actually processed.
    await useCase.execute({
      product_code: 'SKU-1',
      quantity: 1,
      pick_location: 'A1',
      idempotencyKey: 'key-3',
    });

    await expect(
      useCase.execute({
        product_code: 'SKU-1',
        quantity: 999,
        pick_location: 'A1',
        idempotencyKey: 'key-3',
      })
    ).rejects.toMatchObject({
      name: 'IdempotencyKeyConflictError',
      code: 409,
      type: 'Conflict',
    });

    // Only the first, valid request was ever published.
    expect(pickQueue.created).toHaveLength(1);
  });

  it('still publishes when a lost claim has no retrievable entry to compare against', async () => {
    // Only reachable if the winning entry expired in the instant between
    // the failed claim and this read — a near-impossible race, but the use
    // case must not treat a missing entry as a conflict.
    const flakyStore = {
      setIfAbsent: jest.fn().mockResolvedValue(false),
      get: jest.fn().mockResolvedValue(undefined),
    };
    const flakyUseCase = new CreatePickUseCase(pickQueue, flakyStore);

    const result = await flakyUseCase.execute({
      product_code: 'SKU-1',
      quantity: 1,
      pick_location: 'A1',
      idempotencyKey: 'key-4',
    });

    expect(result.pickId).toEqual(expect.any(String));
    expect(pickQueue.created).toHaveLength(1);
  });
});
