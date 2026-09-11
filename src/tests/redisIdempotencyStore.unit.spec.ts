const getRedisClientMock = jest.fn();

jest.mock('@shared/infra/redis/connection', () => ({
  getRedisClient: () => getRedisClientMock(),
}));

import { RedisIdempotencyStore } from '@shared/infra/idempotency/redisIdempotencyStore';

const entry = {
  pickId: 'pick-1',
  product_code: 'SKU-1',
  quantity: 2,
  pick_location: 'A1',
};

describe('RedisIdempotencyStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns undefined for a key with no entry', async () => {
    const client = { get: jest.fn().mockResolvedValue(null) };
    getRedisClientMock.mockResolvedValue(client);
    const store = new RedisIdempotencyStore(86_400);

    await expect(store.get('missing')).resolves.toBeUndefined();
    expect(client.get).toHaveBeenCalledWith('idempotency:pick:missing');
  });

  it('returns the deserialized entry for a live key', async () => {
    const client = { get: jest.fn().mockResolvedValue(JSON.stringify(entry)) };
    getRedisClientMock.mockResolvedValue(client);
    const store = new RedisIdempotencyStore(86_400);

    await expect(store.get('key-1')).resolves.toEqual(entry);
  });

  it('wraps a get failure in a 503 AppError', async () => {
    const client = {
      get: jest.fn().mockRejectedValue(new Error('connection refused')),
    };
    getRedisClientMock.mockResolvedValue(client);
    const store = new RedisIdempotencyStore(86_400);

    await expect(store.get('key-1')).rejects.toMatchObject({
      name: 'AppError',
      code: 503,
      message: 'Failed to check idempotency key',
    });
  });

  it('claims an unclaimed key via SET NX EX and reports success', async () => {
    const client = { set: jest.fn().mockResolvedValue('OK') };
    getRedisClientMock.mockResolvedValue(client);
    const store = new RedisIdempotencyStore(86_400);

    await expect(store.setIfAbsent('key-1', entry)).resolves.toBe(true);
    expect(client.set).toHaveBeenCalledWith(
      'idempotency:pick:key-1',
      JSON.stringify(entry),
      { condition: 'NX', expiration: { type: 'EX', value: 86_400 } }
    );
  });

  it('reports a lost claim when NX rejects the write', async () => {
    const client = { set: jest.fn().mockResolvedValue(null) };
    getRedisClientMock.mockResolvedValue(client);
    const store = new RedisIdempotencyStore(86_400);

    await expect(store.setIfAbsent('key-1', entry)).resolves.toBe(false);
  });

  it('wraps a setIfAbsent failure in a 503 AppError', async () => {
    const client = {
      set: jest.fn().mockRejectedValue(new Error('connection refused')),
    };
    getRedisClientMock.mockResolvedValue(client);
    const store = new RedisIdempotencyStore(86_400);

    await expect(store.setIfAbsent('key-1', entry)).rejects.toMatchObject({
      name: 'AppError',
      code: 503,
      message: 'Failed to claim idempotency key',
    });
  });
});
