import { Pool, PoolClient } from 'pg';
import { runMigrations } from '@shared/infra/database/pg/migrate';

function buildClient() {
  return {
    query: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
}

describe('runMigrations', () => {
  it('creates the schema_migrations table and applies a pending migration', async () => {
    const client = buildClient();
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined) // CREATE TABLE schema_migrations
        .mockResolvedValueOnce({ rows: [] }), // SELECT ... not yet applied
      connect: jest.fn().mockResolvedValue(client),
    };

    await runMigrations(pool as unknown as Pool);

    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS products')
    );
    expect(client.query).toHaveBeenCalledWith(
      'INSERT INTO schema_migrations (name) VALUES ($1)',
      ['0001_create_products.sql']
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('skips a migration already recorded in schema_migrations', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined) // CREATE TABLE schema_migrations
        .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }), // already applied
      connect: jest.fn(),
    };

    await runMigrations(pool as unknown as Pool);

    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('rolls back and rethrows when applying a migration fails', async () => {
    const migrationError = new Error('syntax error in migration');
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(migrationError) // the migration SQL itself
        .mockResolvedValueOnce(undefined), // ROLLBACK
      release: jest.fn(),
    };
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [] }),
      connect: jest.fn().mockResolvedValue(client as unknown as PoolClient),
    };

    await expect(runMigrations(pool as unknown as Pool)).rejects.toBe(
      migrationError
    );

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
