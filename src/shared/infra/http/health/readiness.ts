import { pool } from '@shared/infra/database/pg/pool';
import { getChannel } from '@shared/infra/messaging/rabbitmq/connection';

type CheckStatus = 'ok' | 'error';

interface ReadinessChecks {
  storage: CheckStatus;
  rabbitmq: CheckStatus;
}

interface ReadinessResult {
  ready: boolean;
  checks: ReadinessChecks;
}

const CHECK_TIMEOUT_MS = 2000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => reject(new Error('readiness check timed out')), ms);
    }),
  ]);
}

async function checkPostgresStorage(): Promise<CheckStatus> {
  try {
    await withTimeout(pool.query('SELECT 1'), CHECK_TIMEOUT_MS);
    return 'ok';
  } catch {
    return 'error';
  }
}

async function checkRabbitMQ(): Promise<CheckStatus> {
  try {
    await withTimeout(getChannel(), CHECK_TIMEOUT_MS);
    return 'ok';
  } catch {
    return 'error';
  }
}

async function getReadiness(): Promise<ReadinessResult> {
  const storage = await checkPostgresStorage();
  const rabbitmq = await checkRabbitMQ();

  return {
    // RabbitMQ is informational only — core CRUD API works without it.
    ready: storage === 'ok',
    checks: { storage, rabbitmq },
  };
}

export { getReadiness };
