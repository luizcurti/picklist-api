# 0005. Observability stack: Prometheus, OpenTelemetry, Loki/Grafana

- **Status**: Accepted

## Context

With two processes types (`api`, and two kinds of worker) communicating
asynchronously through RabbitMQ, understanding what's actually happening at
runtime — request rates, error rates, latency, and how a single request or
pick flows across process boundaries — needs more than reading logs off
`docker logs`. This project also exists to demonstrate production-oriented
practices, and observability is one of the concrete, verifiable ones (metric
values, real trace spans, correlated log lines) rather than something that
can only be asserted in prose.

## Decision

Three complementary signals, each with a standard, widely-used tool rather
than a custom-built equivalent:

- **Metrics**: `prom-client`, exposing `GET /metrics` in Prometheus text
  format (`http_requests_total`/`_duration_seconds`,
  `repository_operations_total`/`_duration_seconds`, default Node.js
  process metrics). Scraped by Prometheus, visualized in a provisioned
  Grafana dashboard.
- **Tracing**: OpenTelemetry's Node SDK, auto-instrumenting `http` and
  `express`, plus a `withSpan` helper wrapping every use case and
  repository method — giving a controller → use case → repository span
  chain for free through OTel's own context propagation. Exported to
  Jaeger over OTLP/HTTP.
- **Logs**: structured JSON via a small custom `logger` (not a logging
  framework — the format is simple enough not to need one), with
  `requestId` (generated or echoed per request, via `AsyncLocalStorage`)
  and the active OTel `traceId` spliced into every line with no call-site
  changes. Promtail ships container stdout to Loki, lifting `level`/
  `requestId` into queryable labels.

All four backends (Prometheus, Grafana, Jaeger, Loki+Promtail) live behind
the `observability` Compose profile — opt-in, not part of the zero-friction
base `docker compose up`.

## Alternatives Considered

- **A hosted/managed observability SaaS**: out of scope — this project runs
  locally/in CI, not in a real deployment (see memory: dev-only scope);
  self-hosted, disposable containers match that better than an external
  account/API key dependency.
- **A single all-in-one tool (e.g. Grafana Cloud's bundled agent, or
  SigNoz)**: rejected — using the standard, separately-recognizable
  building blocks (Prometheus, OpenTelemetry, Loki) demonstrates
  familiarity with the pieces a reader is more likely to already know,
  rather than one packaged product's specific way of combining them.
- **Custom request logging middleware instead of OpenTelemetry**: rejected
  for tracing specifically — a hand-rolled span/parent-id scheme would
  duplicate what OTel's context propagation already does correctly across
  async boundaries (including across the RabbitMQ publish/consume
  boundary), for strictly worse interoperability (Jaeger, and any other
  OTLP-speaking backend, understands real OTel spans; it wouldn't
  understand a custom scheme).

## Trade-offs

- Four extra containers when the profile is enabled — real resource and
  startup-time cost, mitigated by keeping the profile opt-in.
- `/metrics`, the RabbitMQ management UI, and Grafana are unauthenticated —
  acceptable for local/portfolio use (documented in the README), not a
  decision that would carry over to a real deployment as-is.
- Structured logging depends on every log call site actually using
  `logger.*` (never a stray `console.log`) for the `requestId`/`traceId`
  correlation to hold — an implicit convention, not something the type
  system enforces.

## Consequences

- `GET /metrics` sits outside the `/api/*` rate limiter — Prometheus scrapes
  every few seconds and shouldn't compete with API traffic for that budget.
- The Prometheus `route` label uses the matched Express route pattern
  (`req.route.path`), never the raw URL, specifically to avoid unbounded
  cardinality from `product_code` values appearing as distinct label
  values.
- A log line's `requestId` is also tagged onto its active span as an
  attribute (the reverse direction of the log→trace link) — a trace in
  Jaeger is searchable by `requestId`, and a log line in Loki carries a
  `traceId` straight to its trace, in either direction.
