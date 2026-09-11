import 'dotenv/config';
import * as Yup from 'yup';

const envSchema = Yup.object({
  NODE_ENV: Yup.string()
    .oneOf(['development', 'production', 'test'])
    .default('development'),
  PORT: Yup.number().integer().positive().default(3005),
  CORS_ORIGIN: Yup.string().default('*'),
  RATE_LIMIT_WINDOW_MS: Yup.number().integer().positive().default(60_000),
  RATE_LIMIT_MAX: Yup.number().integer().positive().default(100),
  OTEL_SERVICE_NAME: Yup.string().default('picklist-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: Yup.string().default('http://localhost:4318'),
  RABBITMQ_URL: Yup.string().default('amqp://guest:guest@localhost:5672'),
  PICK_RETRY_MAX: Yup.number().integer().min(0).default(3),
  PICK_RETRY_DELAY_MS: Yup.number().integer().positive().default(5000),
  PICK_RETRY_MAX_DELAY_MS: Yup.number().integer().positive().default(60_000),
  IDEMPOTENCY_TTL_MS: Yup.number().integer().positive().default(86_400_000),
  // Unset by default — falls back to InMemoryIdempotencyStore (see
  // shared/infra/idempotency/index.ts). Set to opt into RedisIdempotencyStore,
  // the only implementation that recognizes a repeated key across replicas.
  REDIS_URL: Yup.string().default(''),
  // Matches docker-compose.yml's postgres credentials — zero-config local dev.
  DATABASE_URL: Yup.string().default(
    'postgres://picklist:picklist@localhost:5432/picklist'
  ),
  API_KEYS: Yup.string().default(''),
});

const parsed = envSchema.validateSync(process.env, { stripUnknown: true });

// Fallback dev key so local runs/tests/docs work with zero setup; unused once API_KEYS is set.
const DEFAULT_DEV_API_KEY = 'dev-local-key';

const configuredApiKeys = parsed.API_KEYS
  ? parsed.API_KEYS.split(',')
      .map((key) => key.trim())
      .filter(Boolean)
  : [];

if (parsed.NODE_ENV === 'production' && configuredApiKeys.length === 0) {
  throw new Error(
    'API_KEYS must be set (comma-separated) when NODE_ENV=production — refusing to start unauthenticated in production.'
  );
}

const apiKeys =
  configuredApiKeys.length > 0 ? configuredApiKeys : [DEFAULT_DEV_API_KEY];

export const env = {
  nodeEnv: parsed.NODE_ENV,
  isProduction: parsed.NODE_ENV === 'production',
  port: parsed.PORT,
  corsOrigin: parsed.CORS_ORIGIN,
  rateLimit: {
    windowMs: parsed.RATE_LIMIT_WINDOW_MS,
    max: parsed.RATE_LIMIT_MAX,
  },
  rabbitmqUrl: parsed.RABBITMQ_URL,
  pickRetryMax: parsed.PICK_RETRY_MAX,
  pickRetryDelayMs: parsed.PICK_RETRY_DELAY_MS,
  pickRetryMaxDelayMs: parsed.PICK_RETRY_MAX_DELAY_MS,
  idempotencyTtlMs: parsed.IDEMPOTENCY_TTL_MS,
  redisUrl: parsed.REDIS_URL || undefined,
  databaseUrl: parsed.DATABASE_URL,
  apiKeys,
  usingDefaultApiKey: configuredApiKeys.length === 0,
};

export { DEFAULT_DEV_API_KEY };
