import { InMemoryIdempotencyStore } from '@shared/infra/idempotency/inMemoryIdempotencyStore';

const entry = {
  pickId: 'pick-1',
  product_code: 'SKU-1',
  quantity: 2,
  pick_location: 'A1',
};

describe('InMemoryIdempotencyStore', () => {
  it('returns undefined for an unknown key', async () => {
    const store = new InMemoryIdempotencyStore(1000, () => 0);

    await expect(store.get('missing')).resolves.toBeUndefined();
  });

  it('returns the stored entry before expiry', async () => {
    let now = 0;
    const store = new InMemoryIdempotencyStore(1000, () => now);

    await store.setIfAbsent('key-1', entry);
    now = 500;

    await expect(store.get('key-1')).resolves.toEqual(entry);
  });

  it('expires the entry once the TTL has elapsed', async () => {
    let now = 0;
    const store = new InMemoryIdempotencyStore(1000, () => now);

    await store.setIfAbsent('key-1', entry);
    now = 1500;

    await expect(store.get('key-1')).resolves.toBeUndefined();
    // Confirms the expired entry was actually removed, not just skipped.
    now = 0;
    await expect(store.get('key-1')).resolves.toBeUndefined();
  });

  it('claims an unclaimed key and reports success', async () => {
    const store = new InMemoryIdempotencyStore(1000, () => 0);

    await expect(store.setIfAbsent('key-1', entry)).resolves.toBe(true);
    await expect(store.get('key-1')).resolves.toEqual(entry);
  });

  it('refuses to claim a key that is already live', async () => {
    const store = new InMemoryIdempotencyStore(1000, () => 0);
    await store.setIfAbsent('key-1', entry);

    const other = { ...entry, pickId: 'pick-2' };
    await expect(store.setIfAbsent('key-1', other)).resolves.toBe(false);
    // The original claim wins — the second writer's entry never lands.
    await expect(store.get('key-1')).resolves.toEqual(entry);
  });

  it('allows re-claiming a key once its previous entry has expired', async () => {
    let now = 0;
    const store = new InMemoryIdempotencyStore(1000, () => now);
    await store.setIfAbsent('key-1', entry);

    now = 1500;
    const other = { ...entry, pickId: 'pick-2' };

    await expect(store.setIfAbsent('key-1', other)).resolves.toBe(true);
    await expect(store.get('key-1')).resolves.toEqual(other);
  });
});
