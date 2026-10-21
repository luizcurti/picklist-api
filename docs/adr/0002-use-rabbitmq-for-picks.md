# 0002. Use RabbitMQ for the asynchronous pick flow

- **Status**: Accepted

## Context

`POST /api/v1/picks` represents a warehouse pick request. Processing it
(validating stock, decrementing it, recording the outcome) doesn't need to
block the HTTP response — the caller only needs confirmation the pick was
accepted, and the actual inventory update can happen out of band. This is
also the natural place to demonstrate a distributed-systems concern this
project would otherwise have no reason to cover: fault isolation between
processes, retry with backoff, and dead-lettering.

## Decision

`POST /api/v1/picks` publishes a `pick.created` event to a RabbitMQ topic
exchange (`picks.events`) and returns `202 Accepted` immediately. A
separate `inventory-worker` process consumes `picks.inventory` and performs
the actual stock decrement; a separate `audit-worker` consumes `picks.audit`
and writes a structured log line per lifecycle event. Both workers reuse
the same Docker image as `api`, with a different `command:` — real process
isolation (a worker crash doesn't take the API down), not in-process
consumers.

## Alternatives Considered

- **Do the stock update synchronously inside the request**: rejected as
  the whole point of this ADR — it removes the reason to demonstrate
  async processing, retry/DLQ, and worker fault isolation at all.
- **Kafka**: rejected — no consumer group / partition-ordering / long-term
  log-retention requirement exists here that RabbitMQ's simpler
  competing-consumers model doesn't already satisfy. Kafka would be new
  operational surface with no corresponding requirement, not depth.
- **A database-backed outbox/polling queue**: rejected — reuses Postgres
  instead of adding a broker, but trades a real message broker's delivery
  guarantees and management tooling (the RabbitMQ management UI at
  `:15672` for inspecting queues/DLQ) for a hand-rolled polling loop with
  no real benefit at this scale.
- **In-process `EventEmitter` / a job library running inside the `api`
  process**: rejected — doesn't provide real fault isolation; a bug in
  pick processing would crash (or be silently swallowed by) the same
  process serving HTTP traffic.

## Trade-offs

- A second piece of infrastructure (RabbitMQ) and two extra long-running
  processes to operate, versus a synchronous in-request implementation.
  Scoped behind the `messaging` Compose profile so the base
  `docker compose up` (API + Postgres only) stays a zero-friction default.
- Eventual consistency: `GET /api/v1/products/:code` immediately after a
  `202 Accepted` pick may still show the pre-pick quantity until
  `inventory-worker` processes the event.
- No CI job exercises the full messaging profile end-to-end (more services
  means more startup-ordering flake surface than the CRUD e2e suite); it's
  a local-only script (`npm run test:messaging`), a known, accepted gap.

## Consequences

- Retry and dead-lettering are built on RabbitMQ's own primitives (a TTL
  delay queue as the retry mechanism, `x-dead-letter-exchange` for the
  DLQ) rather than a plugin — see `consumeWithRetry.ts` and
  `setupTopology.ts`.
- `inventory-worker`'s stock update reuses the same atomic `UPDATE` the
  synchronous `PUT` endpoint uses — see
  [0003-atomic-stock-updates.md](0003-atomic-stock-updates.md) — so a pick
  and a concurrent manual adjustment on the same product can't lose an
  update to each other.
- `POST /api/v1/picks` returns `503 Service Unavailable` (not `500`) when
  RabbitMQ can't be reached at publish time — a downstream dependency
  outage is a distinct, retryable failure mode from an application bug.
