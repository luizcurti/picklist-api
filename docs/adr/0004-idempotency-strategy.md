# 0004. Idempotency-Key strategy for the pick flow

- **Status**: Accepted

## Context

`POST /api/v1/picks` accepts an optional `Idempotency-Key` header so a
client that retries a request (a network timeout, a duplicate submit) isn't
charged with two picks. This requires two distinct guarantees:

1. **Payload-mismatch detection.** Caching only `key -> pickId` would let a
   replayed key with a _different_ payload (a corrected quantity, say)
   silently return a cached `pickId` for a request that was never actually
   processed with that payload — the caller would have no way to tell.
   Storing the original request alongside the `pickId` and comparing it on
   replay closes this: a mismatch is rejected with `409 Conflict` instead
   of served as if it succeeded.
2. **A genuinely atomic claim.** A plain `get(key)` check followed by a
   separate `set(key, entry)` call leaves a window: two concurrent requests
   with the same key (or the same key hitting two different `api`
   replicas) can both see "no entry yet" and both proceed to publish — the
   two-step check-then-set race is exactly what an Idempotency-Key is
   supposed to prevent.

## Decision

`IIdempotencyStore.setIfAbsent(key, entry)` claims a key atomically and
reports whether the caller won the claim, before any work is done —
`CreatePickUseCase` claims first, then publishes, rather than checking,
publishing, and setting after the fact. Two implementations:

- **`InMemoryIdempotencyStore`** (default): a `Map` with lazy TTL expiry.
  Atomic by construction — no `await` between the check and the write, and
  Node's single-threaded execution means no other request's code can
  interleave between them within one process.
- **`RedisIdempotencyStore`** (opt in via `REDIS_URL`, same `messaging`
  Compose profile as RabbitMQ): `SET key value NX EX <ttl>` — the claim and
  the expiry are one atomic Redis command, so two `api` replicas racing the
  same key can never both win. This is the only implementation that
  recognizes a repeated key across replicas at all; the in-memory store is
  inherently process-local.

## Alternatives Considered

- **A unique constraint in PostgreSQL on the idempotency key**: rejected —
  would work, but adds a table and a write to the primary CRUD database for
  a concern that's a natural fit for a short-TTL key-value store; Redis (or
  the in-memory fallback) also keeps this off the product data's own
  transaction path.
- **Always require Redis (no in-memory fallback)**: rejected — would make
  idempotency, and by extension the whole pick flow, depend on
  infrastructure beyond RabbitMQ for the zero-friction single-process case;
  the in-memory store is a legitimate, explicitly-scoped default for that
  case (see Consequences).
- **Deduplicate at the RabbitMQ level (message deduplication plugins/
  broker-side dedup)**: rejected — solves "don't publish the same message
  twice," not "tell the client their differing payload was rejected," which
  is the actual requirement here (the `409 Conflict` behavior).

## Trade-offs

- `RedisIdempotencyStore` makes the pick flow depend on a second piece of
  infrastructure beyond RabbitMQ when enabled — mitigated by keeping it
  optional and lazily connected (no connection attempt until a request
  actually carries an `Idempotency-Key`), and by putting it in the same
  `messaging` profile rather than a separate one.
- `InMemoryIdempotencyStore` is explicitly not correct across multiple
  `api` replicas or a process restart — acceptable only because it's the
  documented, opt-out-of default, not a hidden limitation.
- A rare theoretical gap: if `setIfAbsent` loses a claim and the winning
  entry expires in the instant before the follow-up `get`, the loser
  proceeds to publish rather than retrying the claim — accepted as
  effectively unreachable at the default 24h TTL, rather than adding a
  retry loop for it.

## Consequences

- `CreatePickUseCase.execute()` generates the `pickId` before attempting
  the claim, so the same `pickId` is used whether this call wins the claim
  or (on the identical-payload path) needs to fall back to whatever the
  winner already stored.
- Both store implementations wrap a downstream failure as `AppError(503,
'Service Unavailable')` rather than letting it surface as an unhandled
  `500` or silently skipping the idempotency check — a client that sent an
  `Idempotency-Key` and got a broker/store outage is told the request
  wasn't safely deduplicated, not left to guess.
- A repeated key with the same payload always resolves to the same
  `pickId`, across any number of concurrent requests and any number of
  `api` replicas when `RedisIdempotencyStore` is active.
