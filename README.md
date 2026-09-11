# picklist-api

![CI](https://github.com/luizcurti/picklist-api/workflows/CI/badge.svg)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)
![Node](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/license-ISC-blue)

A production-inspired reference implementation in TypeScript, demonstrating
Clean Architecture, dependency inversion, concurrency control, distributed
async processing, observability, automated testing and DevSecOps practices
— built around managing picklist product records (`product_code`,
`quantity`, `pick_location`) and asynchronous picking.

Persistence is PostgreSQL, behind an `IProductRepository` interface the
domain layer depends on but never touches directly.

![System overview](docs/img/system-overview.svg)

## ✅ Features

- Clean Architecture (controller → use case → repository interface)
- Full CRUD with pagination, validated with Yup before it reaches business logic
- Asynchronous pick flow over RabbitMQ: publish → inventory worker → stock update, with retry + dead-letter queue and idempotency keys
- PostgreSQL persistence behind an `IProductRepository` interface — the domain and application layers depend only on the interface, never on `pg` directly
- Atomic, concurrency-safe stock adjustments (`quantity = quantity + delta` inside the SQL statement itself) — see [Concurrency-safe stock updates](#concurrency-safe-stock-updates)
- API key authentication (`X-API-Key`) on every `/api/v1/*` request, with a fail-fast startup guard if `NODE_ENV=production` and no key is configured
- Typed domain errors (`ProductNotFoundError`, `DuplicateProductError`, `InvalidQuantityDeltaError`) extending a common `AppError`, instead of one generic error class with loose string reasons
- OpenAPI / Swagger UI at `/docs`
- Structured JSON logging correlated by request ID (`AsyncLocalStorage`, no call-site changes needed)
- Prometheus + Loki + Jaeger observability stack (metrics, logs, traces) in one Grafana dashboard
- Distributed tracing with OpenTelemetry, viewable in Jaeger (controller → use case → repository spans)
- `helmet` security headers, configurable CORS, rate limiting on `/api/*`
- Graceful shutdown on `SIGTERM`/`SIGINT`
- Unit, integration and e2e test suites, 100%-enforced coverage
- Multi-stage Docker build running as a non-root user, with a built-in healthcheck
- GitHub Actions CI: lint, format check, tests, build, Docker build, Trivy vulnerability scan, e2e and Postman collection runs against the container
- CodeQL static analysis and Dependabot (npm, Docker, GitHub Actions), weekly
- Every GitHub Action pinned to an immutable commit SHA, not a mutable version tag, so a tag can't be silently repointed to malicious code

## 📋 Prerequisites

- Node.js 24+ (see `.nvmrc`)
- npm
- A running PostgreSQL instance — `docker compose up -d postgres` is the easiest way (Docker required for that path); any local/managed Postgres reachable via `DATABASE_URL` also works

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy the example environment file
cp .env.example .env

# Start PostgreSQL (DATABASE_URL defaults to this container's credentials)
docker compose up -d postgres

# Start development server (hot reload) — runs migrations on boot
npm run dev
```

**API base URL**: `http://localhost:3005/api/v1`
**Interactive API docs (Swagger UI)**: `http://localhost:3005/docs`
**Health checks**: `http://localhost:3005/health` (liveness) and `http://localhost:3005/health/ready` (readiness)
**Postman collection**: `picklist-api.postman_collection.json`

### Run with Docker

```bash
docker compose up --build
```

This builds the production image, starts PostgreSQL alongside it (a named volume persists the data), and exposes the API on `http://localhost:3005`.

Extra infrastructure beyond Postgres (Prometheus/Grafana/Jaeger/Loki, RabbitMQ) is opt-in via [Compose profiles](#-observability) so the default `docker compose up` stays just the two services the API actually needs to run.

## 🛠️ Available Scripts

### Development

```bash
npm run dev              # Start development server with hot reload
```

### Testing

```bash
npm test                 # Run unit + integration tests with coverage (100% enforced)
npm run test:unit        # Run only unit tests
npm run test:integration # Run only integration tests (real Express app + supertest)
npm run test:e2e         # Run e2e tests against a live server (see Testing below)
npm run test:messaging   # Run the async pick flow test against the messaging profile stack (see Testing below)
npm run test:watch       # Run unit + integration tests in watch mode
npm run benchmark        # Run the PostgreSQL read/write/concurrency benchmark (see Persistence below)
```

### Build & Production

```bash
npm run build            # Compile TypeScript to dist/ (tsc + tsc-alias)
npm start                # Start production server from dist/
npm run clean            # Remove build/coverage artifacts
```

### Code Quality

```bash
npm run eslint           # Lint with ESLint (flat config)
npm run eslint:fix       # Fix ESLint issues automatically
npm run format           # Format the codebase with Prettier
npm run format:check     # Check formatting without writing
```

### Automation

```bash
npm run setup            # Install dependencies + build
npm run ci                # Full pipeline: lint + format check + test + build
```

### Documentation

```bash
npm run docs:diagrams    # Regenerate docs/img/*.png from docs/mmd/*.mmd, and docs/img/system-overview.svg
```

## 📋 API Endpoints

### Base URL

```
http://localhost:3005/api/v1/
```

Versioned and named after the resource, not the storage engine.

### Authentication

Every `/api/v1/*` request requires an `X-API-Key` header matching one of the
comma-separated keys in `API_KEYS` — CORS controls which browser origins can
_read_ a response, it's not an access control mechanism on its own, so this
is what actually gates who can create/update/delete products or trigger a
pick. Missing or wrong key → `401 Unauthorized`.

```bash
curl -H "X-API-Key: dev-local-key" http://localhost:3005/api/v1/products
```

If `API_KEYS` is left unset outside production, the app falls back to the
well-known `dev-local-key` above so `npm run dev`/tests/docs/the Postman
collection all work with zero setup — but it refuses to start at all with
`NODE_ENV=production` and no `API_KEYS` configured. `/health`, `/metrics`
and `/docs` stay unauthenticated (needed by orchestrators/tooling without
credentials). Swagger UI at `/docs` has an "Authorize" button to set the key
for "Try it out".

### Why an open `CORS_ORIGIN` is still safe

`CORS_ORIGIN=*` (the default) means any browser origin can _read_ a
response — it says nothing about who's allowed to _make the request in the
first place_. That's what `X-API-Key` above is for: a real access-control
gate, with CORS as a convenience on top of it, not a substitute for one.
It's implemented as a literal `'*'` string, never a reflected `Origin`
header — see the comment on the `cors()` call in `app.ts` for why that
distinction matters.

#### GET `/api/v1/products`

- **Description**: List all products (paginated)
- **Query Parameters**:
  - `limit` (optional): Items per page (default: 100, max: 1000)
  - `offset` (optional): Items to skip (default: 0)
- **Response**:

```json
{
  "data": [...],
  "pagination": {
    "total": 1000,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

- **Status**: 200 OK

#### POST `/api/v1/products`

- **Description**: Create a new product
- **Body**: `{ "product_code": "string", "quantity": number, "pick_location": "string" }`
- **Status**: 201 Created / 400 Validation error / 409 Already exists

#### GET `/api/v1/products/:product_code`

- **Description**: Find a product by code
- **Status**: 200 OK / 404 Not Found

#### PUT `/api/v1/products/:product_code`

- **Description**: Update an existing product. Provide exactly one of `quantity` (absolute — replaces the stored value, last-write-wins) or `quantity_delta` (relative — adjusts current stock by a signed amount, e.g. `-3` or `+10`, applied atomically in a single SQL statement so concurrent requests on the same product can't silently overwrite each other's result); providing both or neither is a 400.
- **Body**: `{ "quantity": number, "pick_location": "string" }` or `{ "quantity_delta": number, "pick_location": "string" }`
- **Status**: 200 OK / 400 Validation error / 404 Not Found / 409 Conflict (`quantity_delta` would result in negative stock)

#### DELETE `/api/v1/products/:product_code`

- **Description**: Delete a product by code
- **Status**: 200 OK / 404 Not Found

#### POST `/api/v1/picks`

- **Description**: Request an asynchronous pick. Publishes a `pick.created` event to RabbitMQ and returns immediately — the `inventory-worker` processes it out of band, decrementing stock and publishing `pick.completed` or `pick.failed` (insufficient stock / product not found). See [Async picking](#-async-picking).
- **Headers**: `Idempotency-Key` (optional) — a repeated key within the TTL window returns the same `pickId` instead of processing the pick twice.
- **Body**: `{ "product_code": "string", "quantity": number, "pick_location": "string" }`
- **Status**: 202 Accepted (`{ "pickId": "...", "status": "accepted" }`) / 400 Validation error / 409 Conflict (`Idempotency-Key` reused with a different payload) / 503 Service Unavailable (RabbitMQ or, when configured, Redis unreachable)

#### GET `/health` / `/health/live`

- **Description**: Liveness check (`status`, `uptime`, `timestamp`) — no dependency checks, just "is the process up". `/health` is an alias of `/health/live`; the Docker `HEALTHCHECK` deliberately targets this, not `/health/ready` (a slow dependency shouldn't get the container restarted).
- **Status**: 200 OK

#### GET `/health/ready`

- **Description**: Readiness check — runs `SELECT 1` against PostgreSQL and reports RabbitMQ connectivity. Only the storage check gates overall readiness; RabbitMQ is informational, since the core product API stays usable even if the (optional, async) pick flow's broker is down.
- **Response**: `{ "status": "ok"|"degraded", "checks": { "storage": "ok"|"error", "rabbitmq": "ok"|"error" } }`
- **Status**: 200 OK / 503 Service Unavailable

Full request/response schemas are available interactively at `/docs` (Swagger UI).

## 🧪 Testing

Three independent layers, covering both happy and sad paths (validation errors, not found, conflicts, rate limiting, unknown routes):

- **Unit** (`src/tests/*.unit.spec.ts`): use cases, controllers, middlewares, config and utilities tested in isolation (mocked `pg`, an in-memory repository fake, module-registry resets for env-dependent branches).
- **Integration** (`src/tests/*.integration.spec.ts`): boots the real Express app in-process and drives it with `supertest` against a real PostgreSQL database — full CRUD flow, validation, health check, Swagger UI, 404s. Requires Postgres reachable at `DATABASE_URL` (defaults to the docker-compose service — `docker compose up -d postgres` first); every product code is run-unique so parallel test files and repeat runs against a persistent database don't collide. Includes a real-concurrency regression test — 20+ genuinely concurrent `PUT .../quantity_delta` requests (`Promise.all`, not sequential awaits) on the same product, asserting the exact expected final quantity — plus an equivalent test directly against `PostgresProductRepository.applyQuantityDelta`. A mocked-repository unit test cannot catch this class of bug; only genuine concurrent connections can.
- **E2E** (`src/tests/*.e2e.spec.ts`): black-box tests that make real HTTP requests over the network against an already-running server (typically the Docker container). Run separately:

  ```bash
  docker compose up -d --build
  npm run test:e2e
  docker compose down
  ```

  Point it at a different instance with `E2E_BASE_URL=http://localhost:3005 npm run test:e2e`. Each test cleans up the rows it created; the suite doesn't touch the seeded sample data.

- **Coverage**: `npm test` (unit + integration) enforces a **100% threshold** (statements, branches, functions, lines) via `jest.config.js` — the build fails if coverage regresses. Reports are written to `coverage/` (text, LCOV, HTML). Coverage proves every branch ran, not that the assertions are meaningful — treat it as a floor, not a quality score. Since the integration suite hits a real database, `npm test` needs Postgres running (`docker compose up -d postgres`) to reach 100% — this is CI-enforced too, via a `postgres` service container on the job, not skipped.
- **Async pick flow** (`src/tests/picks.messaging.spec.ts`, `npm run test:messaging`): a fourth, local-only layer against the full `messaging` profile stack (api + rabbitmq + both workers) — proves the cross-process flow end-to-end, not coverage-gated or run in CI (more services, more startup-ordering flake surface than the CRUD e2e suite):

  ```bash
  docker compose --profile messaging up -d --build
  npm run test:messaging
  docker compose --profile messaging down
  ```

- **Load testing** (`load-tests/products-crud.js`, [k6](https://k6.io)): a mixed create/list/get/update/delete workload ramping 0→50 VUs over 30s, holding 1 minute, ramping down — not an npm dependency, standalone:

  ```bash
  docker compose up -d --build
  k6 run load-tests/products-crud.js
  ```

  See [Persistence: PostgreSQL § Benchmark](#benchmark) for real
  read/write/concurrency numbers, or run `npm run benchmark` for your own.

## 📊 Observability

```bash
docker compose --profile observability up
```

Starts Prometheus, Grafana, Jaeger, Loki and Promtail alongside the API — logs, metrics and traces, one Grafana:

- **Metrics**: `GET /metrics` (Prometheus text format) — `http_requests_total` / `http_request_duration_seconds` (labeled by `method`, `route`, `status_code`), `repository_operations_total` / `repository_operation_duration_seconds` (labeled by `adapter`, `operation`, `result`), plus default Node.js process metrics.
- **Logs**: **Promtail** auto-discovers every container via the Docker socket (no per-service config) and ships its stdout to **Loki**, lifting `level`/`requestId` out of the existing structured JSON into queryable labels — no changes to how the app logs.
- **Grafana**: `http://localhost:3000` (anonymous viewer access) — a provisioned "Picklist API - Service Overview" dashboard (request rate, error rate, p95 latency, latency percentiles, repository operations by adapter, and a live log panel).
- **Tracing**: every request is traced end-to-end (controller → use case → repository) via OpenTelemetry, exported to **Jaeger** at `http://localhost:16686`.
- **Correlation**: every response carries an `X-Request-Id` header (generated, or echoed if the caller sends one), and that same ID appears in every structured log line emitted while handling the request (queryable as a Loki label) — no call-site changes needed, via `AsyncLocalStorage`. A request-completion log line (`method`, `route`, `statusCode`, `durationMs`) is also emitted, at `info`/`warn`/`error` depending on status code.
- **Log ↔ trace linking**: every log line also carries the active OTel `traceId` (reads it directly from the span — no separate ID to maintain), and the `requestId` is tagged onto the span itself as an attribute — jump from a log line in Loki straight to its trace in Jaeger, or search a trace by `requestId`, in either direction.

## 🔄 Async picking

```bash
docker compose --profile messaging up
```

Starts RabbitMQ plus two worker processes (`inventory-worker`, `audit-worker`), reusing the same Docker image as the API with a different `command:` — real fault isolation and independent scaling, not in-process consumers.

```
POST /api/v1/picks
       │
       ▼
  picks.events (topic exchange)
       │
       ├── picks.inventory ──▶ inventory-worker ──▶ decrement stock ──▶ pick.completed / pick.failed
       │        │
       │        └─ on failure: retry (TTL delay queue, exponential backoff + jitter) up to PICK_RETRY_MAX, then DLQ
       │
       └── picks.audit ──▶ audit-worker ──▶ structured log per lifecycle event
```

- **Idempotency**: an `Idempotency-Key` header short-circuits a repeated request to the same cached `pickId`, claimed atomically (`SET ... NX EX`, or an equivalent single-threaded check-and-set in-memory) so two concurrent requests with the same key can't both win. Two implementations of `IIdempotencyStore`: `InMemoryIdempotencyStore` (default — process-local, doesn't survive a restart or work across replicas) and `RedisIdempotencyStore` (opt in with `REDIS_URL`, same `messaging` profile as RabbitMQ — recognizes a repeated key across every `api` replica).
- **Retry / DLQ**: transient failures are retried via a TTL delay queue (exponential backoff with equal jitter — `PICK_RETRY_DELAY_MS * 2^attempt`, capped at `PICK_RETRY_MAX_DELAY_MS`, no plugins) up to `PICK_RETRY_MAX` times, then dead-lettered for inspection via the RabbitMQ management UI at `http://localhost:15672` (guest/guest). Insufficient stock or an unknown product is a normal outcome (`pick.failed`), not a retry.
- **One message at a time per worker**: `consumeWithRetry.ts` sets `channel.prefetch(1)` — without it, RabbitMQ pushes every available message to the consumer at once and each spawns its own detached async handler, so a burst of picks for the same product could be processed concurrently _within a single worker process_ for no reason. This reduces needless in-process contention; it does not by itself make concurrent picks on the same product safe (a second `inventory-worker` replica can still race a first one) — that guarantee comes from the atomic repository update in [Concurrency-safe stock updates](#concurrency-safe-stock-updates), independent of prefetch or replica count.
- **Audit trail**: every lifecycle event is written to the same structured JSON logger the rest of the app uses — no new datastore for what's naturally an append-only event log.

## 🗄️ Persistence: PostgreSQL

```bash
docker compose up -d postgres
npm run dev
```

`PostgresProductRepository` is the only `IProductRepository` implementation
— controllers and use cases depend solely on the interface
(`src/modules/products/repositories/iProductRepository.ts`), never on `pg`
directly. Migrations (`src/shared/infra/database/pg/migrate.ts`) run
automatically at startup.

### Benchmark

```bash
docker compose up -d postgres
npm run benchmark
```

`scripts/benchmark-repositories.ts` — 500 sequential creates, 500
sequential reads, and 50 genuinely concurrent `applyQuantityDelta` calls
(`Promise.all`, the same atomic statement from
[Concurrency-safe stock updates](#concurrency-safe-stock-updates)) against
a real, local Postgres container. Real numbers, not estimated — re-run it
to get your own:

| Operation                 | Throughput           | Avg latency  |
| ------------------------- | -------------------- | ------------ |
| Sequential creates        | ~1,900–2,200 ops/sec | ~0.46–0.53ms |
| Sequential reads          | ~3,400–3,700 ops/sec | ~0.27–0.29ms |
| 50-way concurrent updates | ~2,900–3,200 ops/sec | ~0.31–0.34ms |

Measured across 2 consecutive runs (Apple M1 Pro, 10 cores, 16GB RAM,
Node 24, PostgreSQL 17 in Docker) — a local development machine, not a
production benchmark; the point is the methodology (real concurrency, real
connections) more than the specific numbers, which will vary by hardware.

## 🏗️ Architecture

This project follows **Clean Architecture** principles. For a diagram-driven
walkthrough of the request lifecycle, the PostgreSQL write path, and
the Docker build, see **[docs/SYSTEM_FLOW.md](docs/SYSTEM_FLOW.md)**. For
the reasoning behind the major architectural decisions (why PostgreSQL, why
RabbitMQ, the idempotency strategy, ...), see
**[docs/adr/](docs/adr/)**.

### Concurrency-safe stock updates

The domain and application layers depend only on `IProductRepository`,
never on the concrete storage engine. PostgreSQL gives any number of app
instances genuinely concurrent writes via MVCC — but MVCC alone doesn't
protect a **read-then-write sequence** in application code, only a single
statement. `quantity_delta` (used by both the async pick flow and `PUT
.../quantity_delta`) does the arithmetic and the stock guard inside one
SQL statement, so the database — not application code — resolves
concurrent updates to the same row:

```sql
UPDATE products
SET quantity = quantity + $1, pick_location = COALESCE($2, pick_location)
WHERE product_code = $3 AND quantity + $1 >= 0
RETURNING product_code, quantity, pick_location
```

(`IProductRepository.applyQuantityDelta`; the absolute-`quantity` path
uses a plain `update()`, where last-write-wins is the intended semantics,
not a race.) Covered by a real-concurrency regression test — `Promise.all`
firing 20+ genuinely simultaneous requests at the same product over real
Postgres connections, asserting the exact expected final quantity — in
both `postgresProductRepository.integration.spec.ts` and
`api.integration.spec.ts`; a mocked-repository unit test cannot exercise
this class of bug at all.

```
src/
├── config/                 # Centralized, validated environment configuration
│   └── env.ts
├── errors/                 # Custom error classes
│   └── appError.ts
├── modules/
│   ├── products/
│   │   ├── repositories/   # Data access layer
│   │   │   ├── index.ts               # Composition root: wires up the PostgreSQL adapter
│   │   │   ├── postgresProductRepository.ts
│   │   │   └── iProductRepository.ts
│   │   ├── errors/         # ProductNotFoundError, DuplicateProductError, InvalidQuantityDeltaError
│   │   └── useCases/       # Business logic
│   │       ├── createProduct/
│   │       ├── deleteProduct/
│   │       ├── updateProduct/
│   │       ├── listProducts/
│   │       └── findProduct/
│   └── picks/               # Async pick flow
│       ├── queue/           # IPickQueue port + RabbitMQ adapter
│       ├── useCases/        # createPick, processInventoryPick
│       └── workers/         # Pure handlers wired by the worker entrypoints
├── shared/
│   ├── infra/
│   │   ├── app.ts          # Express app (middlewares, routes, docs, health, metrics)
│   │   ├── server.ts       # Entry point + graceful shutdown (OTel bootstrap first)
│   │   ├── workers/         # inventoryWorker.ts / auditWorker.ts entrypoints
│   │   ├── messaging/rabbitmq/ # Connection, topology, retry/DLQ wrapper
│   │   ├── database/pg/     # Pool, migration runner, migrations/*.sql
│   │   ├── idempotency/     # IIdempotencyStore + in-memory/Redis adapters
│   │   ├── redis/           # Lazy-connecting Redis client
│   │   ├── tracing/         # OpenTelemetry SDK bootstrap + withSpan helper
│   │   ├── observability/   # Repository metrics/tracing instrumentation
│   │   └── http/
│   │       ├── docs/       # OpenAPI spec
│   │       ├── metrics/    # Prometheus registry
│   │       ├── context/    # AsyncLocalStorage request context
│   │       ├── middlewares/
│   │       └── routes/
│   ├── utils/               # Logger
│   └── validation/          # Yup schemas
└── tests/                   # Unit and integration tests
```

### Design patterns & practices

- ✅ Clean Architecture (controller → use case → repository)
- ✅ Repository pattern with dependency injection
- ✅ Typed domain errors (`src/modules/products/errors/productErrors.ts`) instead of one generic error class with string reasons
- ✅ Centralized, validated configuration (`src/config/env.ts`)
- ✅ PostgreSQL with MVCC for real concurrent writes across any number of app instances, no shared-filesystem requirement
- ✅ Atomic SQL updates (`quantity = quantity + delta` in the statement itself) for concurrency-safe stock adjustments — see [Concurrency-safe stock updates](#concurrency-safe-stock-updates)
- ✅ Structured JSON logging, correlated by request ID
- ✅ Prometheus metrics + OpenTelemetry tracing
- ✅ API key authentication on every `/api/v1/*` request
- ✅ Graceful shutdown on `SIGTERM`/`SIGINT`

## 🔧 Configuration

### Environment variables

| Variable                      | Default                                                | Description                                                                                                     |
| ----------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `PORT`                        | `3005`                                                 | HTTP port                                                                                                       |
| `NODE_ENV`                    | `development`                                          | `development`, `production` or `test`                                                                           |
| `DATABASE_URL`                | `postgres://picklist:picklist@localhost:5432/picklist` | PostgreSQL connection string                                                                                    |
| `CORS_ORIGIN`                 | `*`                                                    | Allowed CORS origin(s), comma-separated                                                                         |
| `API_KEYS`                    | `dev-local-key` (dev only)                             | Comma-separated keys required as `X-API-Key` on `/api/v1/*` — required (no fallback) when `NODE_ENV=production` |
| `RATE_LIMIT_WINDOW_MS`        | `60000`                                                | Rate limit window (ms) for `/api/*`                                                                             |
| `RATE_LIMIT_MAX`              | `100`                                                  | Max requests per window for `/api/*`                                                                            |
| `OTEL_SERVICE_NAME`           | `picklist-api`                                         | Service name reported to the OTel collector                                                                     |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318`                                | OTLP HTTP endpoint (Jaeger when using the `observability` profile)                                              |
| `RABBITMQ_URL`                | `amqp://guest:guest@localhost:5672`                    | AMQP connection string (`messaging` profile)                                                                    |
| `PICK_RETRY_MAX`              | `3`                                                    | Max retry attempts for a failed pick before it's dead-lettered                                                  |
| `PICK_RETRY_DELAY_MS`         | `5000`                                                 | Base retry backoff delay (ms) — exponential, with jitter                                                        |
| `PICK_RETRY_MAX_DELAY_MS`     | `60000`                                                | Cap on the exponential retry backoff delay (ms)                                                                 |
| `IDEMPOTENCY_TTL_MS`          | `86400000` (24h)                                       | How long an `Idempotency-Key` is remembered                                                                     |
| `REDIS_URL`                   | unset                                                  | Optional — set to use `RedisIdempotencyStore` instead of the in-memory default (`messaging` profile)            |

See `.env.example`.

### Security & hardening

- API key authentication (`X-API-Key`) on every `/api/v1/*` request — see [Authentication](#authentication)
- `helmet` for HTTP security headers
- `cors` with configurable origin (a static `'*'` when open, never a reflected origin — see [Why an open CORS_ORIGIN is still safe](#why-an-open-cors_origin-is-still-safe))
- `express-rate-limit` on `/api/*`
- Server-side error responses never leak stack traces in `NODE_ENV=production`

### Tooling

- **ESLint 9** flat config (`eslint.config.js`) with `typescript-eslint`
- **Prettier 3** for formatting
- **tsc** + **tsc-alias** for the production build (path aliases resolved at build time)
- **ts-node-dev** for local development

## 🐳 Docker

```bash
# Build and run with docker-compose (recommended)
docker compose up --build

# Or manually — still needs a reachable Postgres (e.g. the one above)
docker build -t picklist-api .
docker run -p 3005:3005 -e DATABASE_URL=postgres://picklist:picklist@host.docker.internal:5432/picklist picklist-api
```

The image is a multi-stage build (compile with `tsc`, run on a slim `node:24-alpine` runtime as a non-root user) with a built-in `HEALTHCHECK` against `/health`. `docker compose up` starts `api` + `postgres` — Postgres isn't optional, so it's not behind a profile. `inventory-worker`/`audit-worker` (below) explicitly disable that inherited `HEALTHCHECK` in `docker-compose.yml` — they don't serve HTTP, so the image's default check against `/health` would always fail and leave them permanently `unhealthy` despite working correctly; `docker ps`'s plain `Up` status already shows the process is alive without it.

Extra services beyond that are opt-in via [Compose profiles](https://docs.docker.com/compose/how-tos/profiles/), stacked as needed:

```bash
docker compose --profile observability --profile messaging up
```

| Profile         | Adds                                                | Docs                             |
| --------------- | --------------------------------------------------- | -------------------------------- |
| _(none)_        | `api` + `postgres`                                  | —                                |
| `observability` | Prometheus, Grafana, Jaeger, Loki, Promtail         | [Observability](#-observability) |
| `messaging`     | RabbitMQ, Redis, `inventory-worker`, `audit-worker` | [Async picking](#-async-picking) |

The `api` container may restart once or twice on first boot if `postgres`/`rabbitmq` aren't healthy yet — expected (`restart: unless-stopped` lets it retry), not a bug.

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Run tests (`npm test`) and linting (`npm run eslint:fix`)
4. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
5. Push to the branch (`git push origin feature/AmazingFeature`)
6. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.
