import { Pool } from 'pg';
import { PostgresProductRepository } from '@modules/products/repositories/postgresProductRepository';

interface MockPool {
  query: jest.Mock;
}

function buildPool(): MockPool {
  return { query: jest.fn() };
}

function asPool(mockPool: MockPool): Pool {
  return mockPool as unknown as Pool;
}

const row = { product_code: 'SKU-1', quantity: 10, pick_location: 'A1' };

describe('PostgresProductRepository', () => {
  describe('create', () => {
    it('inserts and returns the created product', async () => {
      const pool = buildPool();
      pool.query.mockResolvedValueOnce({ rows: [row] });
      const repo = new PostgresProductRepository(asPool(pool));

      const result = await repo.create(row);

      expect(result).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO products'),
        [row.product_code, row.quantity, row.pick_location]
      );
    });

    it('maps a unique violation (23505) to a 409 AppError', async () => {
      const pool = buildPool();
      pool.query.mockRejectedValueOnce({ code: '23505' });
      const repo = new PostgresProductRepository(asPool(pool));

      await expect(repo.create(row)).rejects.toMatchObject({
        name: 'DuplicateProductError',
        code: 409,
        type: 'Conflict',
      });
    });

    it('rethrows a non-unique-violation error unchanged', async () => {
      const pool = buildPool();
      const genericError = new Error('connection lost');
      pool.query.mockRejectedValueOnce(genericError);
      const repo = new PostgresProductRepository(asPool(pool));

      await expect(repo.create(row)).rejects.toBe(genericError);
    });

    it('does not treat a null rejection as a unique violation', async () => {
      const pool = buildPool();
      pool.query.mockRejectedValueOnce(null);
      const repo = new PostgresProductRepository(asPool(pool));

      await expect(repo.create(row)).rejects.toBeNull();
    });

    it('does not treat a differently-coded pg error as a unique violation', async () => {
      const pool = buildPool();
      pool.query.mockRejectedValueOnce({ code: '23503' });
      const repo = new PostgresProductRepository(asPool(pool));

      await expect(repo.create(row)).rejects.toEqual({ code: '23503' });
    });
  });

  describe('findByID', () => {
    it('returns the product when found', async () => {
      const pool = buildPool();
      pool.query.mockResolvedValueOnce({ rows: [row] });
      const repo = new PostgresProductRepository(asPool(pool));

      await expect(repo.findByID('SKU-1')).resolves.toEqual(row);
    });

    it('throws a 404 AppError when not found', async () => {
      const pool = buildPool();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const repo = new PostgresProductRepository(asPool(pool));

      await expect(repo.findByID('MISSING')).rejects.toMatchObject({
        name: 'ProductNotFoundError',
        code: 404,
        type: 'Not Found',
      });
    });
  });

  describe('findAll', () => {
    it('applies default pagination and computes hasMore', async () => {
      const pool = buildPool();
      pool.query
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({ rows: [{ total: 150 }] });
      const repo = new PostgresProductRepository(asPool(pool));

      const result = await repo.findAll();

      expect(result.pagination).toEqual({
        total: 150,
        limit: 100,
        offset: 0,
        hasMore: true,
      });
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        [100, 0]
      );
    });

    it('respects explicit limit/offset', async () => {
      const pool = buildPool();
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: 5 }] });
      const repo = new PostgresProductRepository(asPool(pool));

      const result = await repo.findAll({ limit: 10, offset: 5 });

      expect(result.pagination).toEqual({
        total: 5,
        limit: 10,
        offset: 5,
        hasMore: false,
      });
    });
  });

  describe('update', () => {
    it('returns the updated product', async () => {
      const pool = buildPool();
      const updated = { ...row, quantity: 5 };
      pool.query.mockResolvedValueOnce({ rows: [updated] });
      const repo = new PostgresProductRepository(asPool(pool));

      await expect(repo.update(updated)).resolves.toEqual(updated);
    });

    it('throws a 404 AppError when the product does not exist', async () => {
      const pool = buildPool();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const repo = new PostgresProductRepository(asPool(pool));

      await expect(repo.update(row)).rejects.toMatchObject({
        name: 'ProductNotFoundError',
        code: 404,
        type: 'Not Found',
      });
    });
  });

  describe('applyQuantityDelta', () => {
    it('applies the delta atomically and returns the updated row', async () => {
      const pool = buildPool();
      const updated = { ...row, quantity: 7 };
      pool.query.mockResolvedValueOnce({ rows: [updated] });
      const repo = new PostgresProductRepository(asPool(pool));

      await expect(repo.applyQuantityDelta('SKU-1', -3, 'B2')).resolves.toEqual(
        updated
      );
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('quantity = quantity + $1'),
        [-3, 'B2', 'SKU-1']
      );
    });

    it('leaves pick_location unchanged when not provided', async () => {
      const pool = buildPool();
      pool.query.mockResolvedValueOnce({ rows: [row] });
      const repo = new PostgresProductRepository(asPool(pool));

      await repo.applyQuantityDelta('SKU-1', -3);

      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        -3,
        null,
        'SKU-1',
      ]);
    });

    it('throws a 404 ProductNotFoundError when the product does not exist', async () => {
      const pool = buildPool();
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // guarded UPDATE matches nothing
        .mockResolvedValueOnce({ rows: [] }); // disambiguation SELECT: missing
      const repo = new PostgresProductRepository(asPool(pool));

      await expect(
        repo.applyQuantityDelta('MISSING', -3)
      ).rejects.toMatchObject({
        name: 'ProductNotFoundError',
        code: 404,
        type: 'Not Found',
      });
    });

    it('throws a 409 InvalidQuantityDeltaError when the delta would go negative', async () => {
      const pool = buildPool();
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // guarded UPDATE rejected by WHERE
        .mockResolvedValueOnce({ rows: [{ quantity: 2 }] }); // disambiguation: exists
      const repo = new PostgresProductRepository(asPool(pool));

      await expect(repo.applyQuantityDelta('SKU-1', -5)).rejects.toMatchObject({
        name: 'InvalidQuantityDeltaError',
        code: 409,
        type: 'Conflict',
      });
    });
  });

  describe('remove', () => {
    it('resolves when a row was deleted', async () => {
      const pool = buildPool();
      pool.query.mockResolvedValueOnce({ rowCount: 1 });
      const repo = new PostgresProductRepository(asPool(pool));

      await expect(repo.remove('SKU-1')).resolves.toBeUndefined();
    });

    it('throws a 404 AppError when nothing was deleted', async () => {
      const pool = buildPool();
      pool.query.mockResolvedValueOnce({ rowCount: 0 });
      const repo = new PostgresProductRepository(asPool(pool));

      await expect(repo.remove('MISSING')).rejects.toMatchObject({
        name: 'ProductNotFoundError',
        code: 404,
        type: 'Not Found',
      });
    });
  });
});
