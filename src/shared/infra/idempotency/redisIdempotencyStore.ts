import { AppError } from '@errors/appError';
import { getRedisClient } from '@shared/infra/redis/connection';
import { IIdempotencyStore, IdempotencyEntry } from './iIdempotencyStore';

// Shared across every api replica — this is what actually makes a repeated
// Idempotency-Key recognized across processes, unlike InMemoryIdempotencyStore.
class RedisIdempotencyStore implements IIdempotencyStore {
  constructor(private readonly ttlSeconds: number) {}

  async get(key: string): Promise<IdempotencyEntry | undefined> {
    try {
      const client = await getRedisClient();
      const raw = await client.get(this.namespacedKey(key));
      return raw ? (JSON.parse(raw) as IdempotencyEntry) : undefined;
    } catch (error) {
      throw new AppError(
        'Failed to check idempotency key',
        503,
        'Service Unavailable',
        error
      );
    }
  }

  async setIfAbsent(key: string, entry: IdempotencyEntry): Promise<boolean> {
    try {
      const client = await getRedisClient();
      // SET ... NX EX: the claim and the expiry are one atomic Redis
      // command, so two replicas racing the same key can never both "win".
      const result = await client.set(
        this.namespacedKey(key),
        JSON.stringify(entry),
        { condition: 'NX', expiration: { type: 'EX', value: this.ttlSeconds } }
      );
      return result !== null;
    } catch (error) {
      throw new AppError(
        'Failed to claim idempotency key',
        503,
        'Service Unavailable',
        error
      );
    }
  }

  private namespacedKey(key: string): string {
    return `idempotency:pick:${key}`;
  }
}

export { RedisIdempotencyStore };
