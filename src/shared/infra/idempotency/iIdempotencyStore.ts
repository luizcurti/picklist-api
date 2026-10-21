interface IdempotentPickRequest {
  product_code: string;
  quantity: number;
  pick_location: string;
}

// Stores the original payload too, so a replay with a different payload can be detected and rejected.
interface IdempotencyEntry extends IdempotentPickRequest {
  pickId: string;
}

interface IIdempotencyStore {
  // Atomically claims `key` for `entry` — resolves true if this call won
  // the claim (no live entry existed yet), false if another writer already
  // holds it. This is what actually closes the race two concurrent
  // requests with the same key would otherwise hit: checking `get` and
  // then calling a separate `set` leaves a window where both can see "not
  // present" and both proceed.
  setIfAbsent(key: string, entry: IdempotencyEntry): Promise<boolean>;
  get(key: string): Promise<IdempotencyEntry | undefined>;
}

export { IIdempotencyStore, IdempotencyEntry, IdempotentPickRequest };
