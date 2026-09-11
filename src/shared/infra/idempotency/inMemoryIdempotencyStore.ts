import { env } from '@config/env';
import { IIdempotencyStore, IdempotencyEntry } from './iIdempotencyStore';

interface StoredEntry extends IdempotencyEntry {
  expiresAt: number;
}

// Process-local by design — doesn't survive a restart or work across
// replicas. Expiry is lazy (checked on read), no timer to clean up.
class InMemoryIdempotencyStore implements IIdempotencyStore {
  private readonly store = new Map<string, StoredEntry>();

  constructor(
    private readonly ttlMs: number = env.idempotencyTtlMs,
    private readonly now: () => number = Date.now
  ) {}

  async get(key: string): Promise<IdempotencyEntry | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }

    const { pickId, product_code, quantity, pick_location } = entry;
    return { pickId, product_code, quantity, pick_location };
  }

  // Synchronous under the hood (no `await` between the read and the
  // write), so Node's single-threaded execution already makes this
  // atomic — no other request's code can interleave between the check and
  // the set within one process.
  async setIfAbsent(key: string, entry: IdempotencyEntry): Promise<boolean> {
    const existing = this.store.get(key);
    if (existing && existing.expiresAt > this.now()) {
      return false;
    }

    this.store.set(key, { ...entry, expiresAt: this.now() + this.ttlMs });
    return true;
  }
}

export const inMemoryIdempotencyStore = new InMemoryIdempotencyStore();
export { InMemoryIdempotencyStore };
