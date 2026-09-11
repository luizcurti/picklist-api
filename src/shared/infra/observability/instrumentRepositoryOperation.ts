import {
  repositoryOperationDurationSeconds,
  repositoryOperationsTotal,
} from '@shared/infra/http/metrics/registry';
import { withSpan } from '@shared/infra/tracing/withSpan';

// Only adapter — label kept so Prometheus queries filtering on adapter="postgres" keep working.
const ADAPTER = 'postgres';

type RepositoryOperation =
  | 'create'
  | 'findByID'
  | 'findAll'
  | 'update'
  | 'applyQuantityDelta'
  | 'remove';

async function instrumentRepositoryOperation<T>(
  operation: RepositoryOperation,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = process.hrtime.bigint();

  try {
    const result = await withSpan(`${ADAPTER}Repository.${operation}`, fn);
    repositoryOperationsTotal.inc({
      adapter: ADAPTER,
      operation,
      result: 'success',
    });
    return result;
  } catch (error) {
    repositoryOperationsTotal.inc({
      adapter: ADAPTER,
      operation,
      result: 'error',
    });
    throw error;
  } finally {
    const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;
    repositoryOperationDurationSeconds.observe(
      { adapter: ADAPTER, operation },
      durationSeconds
    );
  }
}

export { instrumentRepositoryOperation, RepositoryOperation };
