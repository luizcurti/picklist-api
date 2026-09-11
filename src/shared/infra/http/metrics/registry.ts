import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

const register = new Registry();
collectDefaultMetrics({ register });

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const repositoryOperationsTotal = new Counter({
  name: 'repository_operations_total',
  help: 'Total number of repository operations, by adapter',
  labelNames: ['adapter', 'operation', 'result'] as const,
  registers: [register],
});

const repositoryOperationDurationSeconds = new Histogram({
  name: 'repository_operation_duration_seconds',
  help: 'Repository operation duration in seconds, by adapter',
  labelNames: ['adapter', 'operation'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

export {
  register,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  repositoryOperationsTotal,
  repositoryOperationDurationSeconds,
};
