import { ProcessInventoryPickUseCase } from '@modules/picks/useCases/processInventoryPick/processInventoryPickUseCase';
import { InMemoryProductRepository } from './InMemoryProductRepository';
import { InMemoryPickQueue } from './InMemoryPickQueue';

describe('ProcessInventoryPickUseCase', () => {
  let repository: InMemoryProductRepository;
  let pickQueue: InMemoryPickQueue;
  let useCase: ProcessInventoryPickUseCase;

  beforeEach(() => {
    repository = new InMemoryProductRepository();
    pickQueue = new InMemoryPickQueue();
    useCase = new ProcessInventoryPickUseCase(repository, pickQueue);
  });

  it('decrements stock and publishes pick.completed when stock is sufficient', async () => {
    await repository.create({
      product_code: 'SKU-1',
      quantity: 10,
      pick_location: 'A1',
    });

    await useCase.execute({
      pickId: 'pick-1',
      product_code: 'SKU-1',
      quantity: 3,
      pick_location: 'A1',
    });

    const updated = await repository.findByID('SKU-1');
    expect(updated.quantity).toBe(7);
    expect(pickQueue.completed).toHaveLength(1);
    expect(pickQueue.completed[0].pickId).toBe('pick-1');
    expect(pickQueue.failed).toHaveLength(0);
  });

  it('succeeds when picking exactly the remaining stock (boundary: quantity === available)', async () => {
    // Mutation testing caught this: without this case, `quantity < available`
    // and `quantity <= available` are indistinguishable to the test suite —
    // picking exactly what's left must succeed, not be treated as insufficient.
    await repository.create({
      product_code: 'SKU-EXACT',
      quantity: 5,
      pick_location: 'A1',
    });

    await useCase.execute({
      pickId: 'pick-exact',
      product_code: 'SKU-EXACT',
      quantity: 5,
      pick_location: 'A1',
    });

    const updated = await repository.findByID('SKU-EXACT');
    expect(updated.quantity).toBe(0);
    expect(pickQueue.completed).toHaveLength(1);
    expect(pickQueue.failed).toHaveLength(0);
  });

  it('does not update stock and publishes pick.failed on insufficient stock', async () => {
    await repository.create({
      product_code: 'SKU-2',
      quantity: 1,
      pick_location: 'A1',
    });

    await useCase.execute({
      pickId: 'pick-2',
      product_code: 'SKU-2',
      quantity: 5,
      pick_location: 'A1',
    });

    const unchanged = await repository.findByID('SKU-2');
    expect(unchanged.quantity).toBe(1);
    expect(pickQueue.completed).toHaveLength(0);
    expect(pickQueue.failed).toEqual([
      expect.objectContaining({
        pickId: 'pick-2',
        reason: 'INSUFFICIENT_STOCK',
      }),
    ]);
  });

  it('publishes pick.failed with a different reason when the product does not exist', async () => {
    await useCase.execute({
      pickId: 'pick-3',
      product_code: 'DOES-NOT-EXIST',
      quantity: 1,
      pick_location: 'A1',
    });

    expect(pickQueue.completed).toHaveLength(0);
    expect(pickQueue.failed).toEqual([
      expect.objectContaining({
        pickId: 'pick-3',
        reason: 'PRODUCT_NOT_FOUND',
      }),
    ]);
  });

  it('propagates a genuinely unexpected repository error instead of treating it as a normal pick.failed outcome', async () => {
    // Unlike PRODUCT_NOT_FOUND/INSUFFICIENT_STOCK (expected outcomes that
    // resolve normally), anything else must propagate so consumeWithRetry
    // actually retries it.
    await repository.create({
      product_code: 'SKU-4',
      quantity: 10,
      pick_location: 'A1',
    });
    const connectionError = new Error('connection terminated unexpectedly');
    jest
      .spyOn(repository, 'applyQuantityDelta')
      .mockRejectedValueOnce(connectionError);

    await expect(
      useCase.execute({
        pickId: 'pick-4',
        product_code: 'SKU-4',
        quantity: 1,
        pick_location: 'A1',
      })
    ).rejects.toBe(connectionError);

    expect(pickQueue.completed).toHaveLength(0);
    expect(pickQueue.failed).toHaveLength(0);
  });
});
