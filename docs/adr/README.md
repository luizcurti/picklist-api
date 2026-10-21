# Architecture Decision Records

Each record captures a decision, the alternatives considered, and the
trade-offs accepted — not just the outcome.

| ADR                                    | Decision                                                     |
| -------------------------------------- | ------------------------------------------------------------ |
| [0001](0001-use-postgresql.md)         | Use PostgreSQL as the persistence engine                     |
| [0002](0002-use-rabbitmq-for-picks.md) | Use RabbitMQ for the asynchronous pick flow                  |
| [0003](0003-atomic-stock-updates.md)   | Atomic SQL statement for relative stock adjustments          |
| [0004](0004-idempotency-strategy.md)   | Idempotency-Key strategy for the pick flow                   |
| [0005](0005-observability-stack.md)    | Observability stack: Prometheus, OpenTelemetry, Loki/Grafana |
| [0006](0006-api-key-authentication.md) | API key authentication on every `/api/v1/*` request          |

See [../SYSTEM_FLOW.md](../SYSTEM_FLOW.md) for the current-state
architecture these decisions led to, and the main
[README](../../README.md) for how to run the system they describe.
