import { AppError } from '@errors/appError';

// Thrown when a key is replayed with a different payload — see IIdempotencyStore.
class IdempotencyKeyConflictError extends AppError {
  constructor(idempotencyKey: string) {
    super(
      `Idempotency-Key '${idempotencyKey}' was already used with a different request payload`,
      409,
      'Conflict'
    );
    this.name = 'IdempotencyKeyConflictError';
  }
}

export { IdempotencyKeyConflictError };
