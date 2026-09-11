# 0001. Use PostgreSQL as the persistence engine

- **Status**: Accepted

## Context

`IProductRepository` is the interface the domain and application layers
depend on for storing product records (`product_code`, `quantity`,
`pick_location`). The concrete engine behind it needs to support:

- Correct concurrent writes to the same row (stock decrements from both
  synchronous `PUT` requests and the asynchronous pick flow can race on the
  same product).
- More than one `api`/`inventory-worker` process reading and writing the
  same data — a single-process deployment isn't a realistic constraint to
  design around.
- No infrastructure requirement beyond what the project already needs to
  demonstrate (it's a reference implementation, not a system with an
  existing operational footprint to fit into).

## Decision

Use PostgreSQL, accessed through a hand-written `PostgresProductRepository`
using the `pg` driver directly (parameterized queries, no ORM).

## Alternatives Considered

- **An embedded, file-based database (e.g. SQLite)**: rejected — genuinely
  concurrent writers (not just correctly serialized ones) require MVCC,
  which a single global writer lock can't provide regardless of journal
  mode, and every writer would need the same local filesystem, ruling out
  more than one host.
- **An ORM (Prisma, TypeORM, Knex)**: rejected — the query surface is five
  simple, hand-tunable statements (including one that must be a single
  atomic `UPDATE`, see [0003](0003-atomic-stock-updates.md)); an ORM adds
  an abstraction layer and a generated-query black box for no real gain at
  this scale, and raw `pg` keeps the SQL — and its concurrency behavior —
  fully visible.
- **A managed cloud database (RDS, Cloud SQL, etc.)**: out of scope — this
  project runs locally/in CI only, not in a real deployment.
  `docker-compose.yml`'s `postgres` service is the intended environment.

## Trade-offs

- Requires a running Postgres instance for local development and the full
  integration test suite — not zero-infrastructure like an embedded file
  would be. Mitigated with `docker compose up -d postgres` as a single
  command and CI running Postgres as a service container.
- No ORM means schema migrations are hand-written SQL
  (`src/shared/infra/database/pg/migrations/*.sql`), run by a small custom
  runner (`migrate.ts`) rather than a framework's migration tool.

## Consequences

- `PostgresProductRepository` is the only `IProductRepository`
  implementation; the domain layer depends solely on the interface
  (`src/modules/products/repositories/iProductRepository.ts`).
- MVCC alone does not make every operation concurrency-safe by itself — see
  [0003-atomic-stock-updates.md](0003-atomic-stock-updates.md) for the
  specific guarantee it does not provide (a read-then-write sequence) and
  how that gap is closed.
- `inventory-worker` and `api` share the same database, reachable over the
  network by any number of instances regardless of host.
