import { logger } from '@shared/utils/logger';
import { pool } from '@shared/infra/database/pg/pool';

describe('pool', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('logs a pool error instead of letting it crash the process', () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    pool.emit('error', new Error('connection terminated unexpectedly'));

    expect(errorSpy).toHaveBeenCalledWith('PostgreSQL pool error', {
      error: 'connection terminated unexpectedly',
    });

    errorSpy.mockRestore();
  });
});
