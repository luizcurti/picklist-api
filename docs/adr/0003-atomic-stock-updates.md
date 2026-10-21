# 0003. Atomic SQL statement for relative stock adjustments

- **Status**: Accepted

## Context

Stock quantity is adjusted from two independent paths: `PUT
/api/v1/products/:code` with a `quantity_delta`, and `inventory-worker`
processing a pick. Both can run concurrently against the same product row —
either two HTTP requests, or a request racing a pick, or (with more than
one `inventory-worker` replica) two picks racing each other.

A relative adjustment implemented as `findByID` → compute the new value in
application code → `update()` with that absolute value is a read-then-write
sequence spanning two separate SQL statements. Two concurrent callers can
both read the same starting quantity, both compute their own delta against
it, and the second `update()` silently overwrites the first's result — a
classic lost update.

PostgreSQL's MVCC (default `READ COMMITTED` isolation) does not prevent
this on its own — it protects a single statement against corruption, not a
sequence of statements against logical interleaving. Each `findByID`
correctly reads whatever was last committed at the moment it runs; that
correctness is exactly what makes the race possible.

## Decision

Do the arithmetic and the non-negative guard inside the `UPDATE` statement
itself, so the database — not application code — resolves the race:

```sql
UPDATE products
SET quantity = quantity + $1, pick_location = COALESCE($2, pick_location)
WHERE product_code = $3 AND quantity + $1 >= 0
RETURNING product_code, quantity, pick_location
```

(`IProductRepository.applyQuantityDelta`, used by both the pick flow and
`PUT .../quantity_delta`.) A zero-row result is ambiguous by construction
(product missing vs. the guard rejecting a negative result), so a
disambiguating `SELECT` runs only on that unhappy path, never on the
success path. The absolute-`quantity` path keeps using a plain `update()`
— last-write-wins is the correct, intended semantics there, not a race,
since the caller is explicitly replacing the stored value outright.

## Alternatives Considered

- **`SELECT ... FOR UPDATE` (explicit row locking) + application-code
  arithmetic**: rejected — still two round trips and a held transaction
  across them, for a guarantee the single-statement `UPDATE` already
  provides more simply.
- **Optimistic concurrency (a version column, retry on conflict)**:
  rejected — adds a retry loop and a schema column for a case the
  database's own `UPDATE` semantics resolve for free; would only earn its
  complexity if writes needed to inspect/reject based on the previous
  value beyond a simple non-negative guard.
- **Serializable isolation level for the whole transaction**: rejected —
  broader (and costlier) than the problem requires; the race is scoped to
  one row's arithmetic, not cross-row invariants.

## Trade-offs

- The non-negative guard and the arithmetic must both live in the SQL
  string, not in TypeScript — logic a reader has to reconstruct from the
  query text and the zero-row disambiguation branch together, rather than
  a single readable function body.

## Consequences

- Covered by a real-concurrency test — `Promise.all` firing 20+ genuinely
  simultaneous requests at the same product over real Postgres
  connections, asserting the exact expected final quantity — in both
  `postgresProductRepository.integration.spec.ts` and
  `api.integration.spec.ts`. A mocked-repository unit test cannot exercise
  this class of bug at all; only genuine concurrent connections can.
- This is what makes the `api` + `inventory-worker` split in the
  `messaging` profile safe for a single atomic statement — both processes
  hold their own connection to the same Postgres database, and Postgres
  serializes concurrent writes to the same row correctly.
- Every relative-adjustment operation on this table follows the same
  pattern: arithmetic inside the guarded `UPDATE`, never a read-then-write
  sequence.
