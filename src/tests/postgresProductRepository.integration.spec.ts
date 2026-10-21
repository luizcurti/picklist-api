import { PostgresProductRepository } from '@modules/products/repositories/postgresProductRepository';
import { pool } from '@shared/infra/database/pg/pool';
import { runMigrations } from '@shared/infra/database/pg/migrate';

/**
 * Runs against a real Postgres instance — Postgres is the only
 * IProductRepository adapter, so this is not opt-in. `DATABASE_URL`
 * defaults (see env.ts) to the docker-compose `postgres` service
 * credentials:
 *
 *   docker compose up -d postgres
 *   npm test
 */
describe('PostgresProductRepository (real Postgres)', () => {
  let repo: PostgresProductRepository;

  beforeAll(async () => {
    await runMigrations(pool);
    repo = new PostgresProductRepository(pool);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM products WHERE product_code LIKE $1', [
      'PG-INT-%',
    ]);
    await pool.end();
  });

  it('performs a full CRUD lifecycle against a real database', async () => {
    const created = await repo.create({
      product_code: 'PG-INT-001',
      quantity: 10,
      pick_location: 'A1',
    });
    expect(created.quantity).toBe(10);

    const found = await repo.findByID('PG-INT-001');
    expect(found).toEqual(created);

    const updated = await repo.update({
      product_code: 'PG-INT-001',
      quantity: 3,
      pick_location: 'B2',
    });
    expect(updated.quantity).toBe(3);

    await repo.remove('PG-INT-001');
    await expect(repo.findByID('PG-INT-001')).rejects.toThrow();
  });

  it('rejects a duplicate product_code with a 409', async () => {
    await repo.create({
      product_code: 'PG-INT-DUP',
      quantity: 1,
      pick_location: 'A1',
    });

    await expect(
      repo.create({
        product_code: 'PG-INT-DUP',
        quantity: 1,
        pick_location: 'A1',
      })
    ).rejects.toMatchObject({ code: 409 });

    await repo.remove('PG-INT-DUP');
  });

  describe('applyQuantityDelta', () => {
    it('applies a delta and optionally updates pick_location', async () => {
      await repo.create({
        product_code: 'PG-INT-DELTA',
        quantity: 10,
        pick_location: 'A1',
      });

      const result = await repo.applyQuantityDelta('PG-INT-DELTA', -3, 'B2');

      expect(result).toEqual({
        product_code: 'PG-INT-DELTA',
        quantity: 7,
        pick_location: 'B2',
      });

      await repo.remove('PG-INT-DELTA');
    });

    it('rejects a delta that would drive stock negative with a 409, unchanged', async () => {
      await repo.create({
        product_code: 'PG-INT-DELTA-NEG',
        quantity: 2,
        pick_location: 'A1',
      });

      await expect(
        repo.applyQuantityDelta('PG-INT-DELTA-NEG', -5)
      ).rejects.toMatchObject({ name: 'InvalidQuantityDeltaError', code: 409 });

      const unchanged = await repo.findByID('PG-INT-DELTA-NEG');
      expect(unchanged.quantity).toBe(2);

      await repo.remove('PG-INT-DELTA-NEG');
    });

    it('throws a 404 for a product that does not exist', async () => {
      await expect(
        repo.applyQuantityDelta('PG-INT-DELTA-MISSING', -1)
      ).rejects.toMatchObject({ name: 'ProductNotFoundError', code: 404 });
    });

    it('never loses an update under real concurrent writers to the same row', async () => {
      // 25 concurrent -1 deltas against a real Postgres connection pool
      // (not sequential, not mocked) must all land — anything less than the
      // full amount means an update was lost.
      const CONCURRENT_WRITERS = 25;
      await repo.create({
        product_code: 'PG-INT-CONCURRENT',
        quantity: CONCURRENT_WRITERS,
        pick_location: 'A1',
      });

      await Promise.all(
        Array.from({ length: CONCURRENT_WRITERS }, () =>
          repo.applyQuantityDelta('PG-INT-CONCURRENT', -1)
        )
      );

      const result = await repo.findByID('PG-INT-CONCURRENT');
      expect(result.quantity).toBe(0);

      await repo.remove('PG-INT-CONCURRENT');
    });
  });
});
