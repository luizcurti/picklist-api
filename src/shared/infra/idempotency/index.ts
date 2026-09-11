import { env } from '@config/env';
import { IIdempotencyStore } from './iIdempotencyStore';
import { InMemoryIdempotencyStore } from './inMemoryIdempotencyStore';
import { RedisIdempotencyStore } from './redisIdempotencyStore';

// Falls back to the process-local, single-replica store when REDIS_URL
// isn't set, so `docker compose up` (no messaging/Redis) still works —
// only a multi-replica deployment needs the Redis-backed one.
export const idempotencyStore: IIdempotencyStore = env.redisUrl
  ? new RedisIdempotencyStore(Math.round(env.idempotencyTtlMs / 1000))
  : new InMemoryIdempotencyStore();
