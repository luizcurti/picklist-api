import { Pool } from 'pg';
import {
  IProduct,
  IProductRepository,
  PaginatedResult,
  PaginationOptions,
} from './iProductRepository';
import {
  DuplicateProductError,
  InvalidQuantityDeltaError,
  ProductNotFoundError,
} from '../errors/productErrors';
import { logger } from '@shared/utils/logger';
import { instrumentRepositoryOperation } from '@shared/infra/observability/instrumentRepositoryOperation';

const UNIQUE_VIOLATION = '23505';

function toIData(row: {
  product_code: string;
  quantity: number;
  pick_location: string;
}): IProduct {
  return {
    product_code: row.product_code,
    quantity: row.quantity,
    pick_location: row.pick_location,
  };
}

export class PostgresProductRepository implements IProductRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: IProduct): Promise<IProduct> {
    return instrumentRepositoryOperation('create', async () => {
      try {
        const { rows } = await this.pool.query(
          `INSERT INTO products (product_code, quantity, pick_location)
           VALUES ($1, $2, $3)
           RETURNING product_code, quantity, pick_location`,
          [data.product_code, data.quantity, data.pick_location]
        );
        logger.info('Product created', { product_code: data.product_code });
        return toIData(rows[0]);
      } catch (error) {
        if (isUniqueViolation(error)) {
          logger.warn('Attempted to create duplicate product', {
            product_code: data.product_code,
          });
          throw new DuplicateProductError(data.product_code);
        }
        throw error;
      }
    });
  }

  async findByID(product_code: string): Promise<IProduct> {
    return instrumentRepositoryOperation('findByID', async () => {
      const { rows } = await this.pool.query(
        'SELECT product_code, quantity, pick_location FROM products WHERE product_code = $1',
        [product_code]
      );

      if (rows.length === 0) {
        logger.warn('Product not found', { product_code });
        throw new ProductNotFoundError(product_code);
      }

      return toIData(rows[0]);
    });
  }

  async findAll(
    options?: PaginationOptions
  ): Promise<PaginatedResult<IProduct>> {
    return instrumentRepositoryOperation('findAll', async () => {
      const limit = options?.limit || 100;
      const offset = options?.offset || 0;

      const [{ rows }, countResult] = await Promise.all([
        this.pool.query(
          `SELECT product_code, quantity, pick_location FROM products
           ORDER BY pick_location
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        ),
        this.pool.query('SELECT COUNT(*)::int AS total FROM products'),
      ]);

      const total = countResult.rows[0].total;

      logger.debug('Products listed', { total, limit, offset });

      return {
        data: rows.map(toIData),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    });
  }

  async update(data: IProduct): Promise<IProduct> {
    return instrumentRepositoryOperation('update', async () => {
      const { rows } = await this.pool.query(
        `UPDATE products
         SET quantity = $2, pick_location = $3
         WHERE product_code = $1
         RETURNING product_code, quantity, pick_location`,
        [data.product_code, data.quantity, data.pick_location]
      );

      if (rows.length === 0) {
        logger.warn('Attempted to update non-existent product', {
          product_code: data.product_code,
        });
        throw new ProductNotFoundError(data.product_code);
      }

      logger.info('Product updated', { product_code: data.product_code });
      return toIData(rows[0]);
    });
  }

  async applyQuantityDelta(
    product_code: string,
    delta: number,
    pick_location?: string
  ): Promise<IProduct> {
    return instrumentRepositoryOperation('applyQuantityDelta', async () => {
      // Delta arithmetic + the >= 0 guard in one statement, so Postgres
      // resolves concurrent updates to the same row, not application code.
      const { rows } = await this.pool.query(
        `UPDATE products
         SET quantity = quantity + $1,
             pick_location = COALESCE($2, pick_location)
         WHERE product_code = $3
           AND quantity + $1 >= 0
         RETURNING product_code, quantity, pick_location`,
        [delta, pick_location ?? null, product_code]
      );

      if (rows.length > 0) {
        logger.info('Product quantity delta applied', {
          product_code,
          delta,
        });
        return toIData(rows[0]);
      }

      // Zero rows is ambiguous (missing vs. guard-rejected) — worth a second read only here.
      const { rows: existingRows } = await this.pool.query(
        'SELECT quantity FROM products WHERE product_code = $1',
        [product_code]
      );

      if (existingRows.length === 0) {
        logger.warn(
          'Attempted to apply quantity delta to non-existent product',
          {
            product_code,
          }
        );
        throw new ProductNotFoundError(product_code);
      }

      logger.warn('Rejected quantity delta that would go negative', {
        product_code,
        delta,
        currentQuantity: existingRows[0].quantity,
      });
      throw new InvalidQuantityDeltaError(
        product_code,
        existingRows[0].quantity,
        delta
      );
    });
  }

  async remove(product_code: string): Promise<void> {
    return instrumentRepositoryOperation('remove', async () => {
      const { rowCount } = await this.pool.query(
        'DELETE FROM products WHERE product_code = $1',
        [product_code]
      );

      if (!rowCount) {
        logger.warn('Attempted to delete non-existent product', {
          product_code,
        });
        throw new ProductNotFoundError(product_code);
      }

      logger.info('Product deleted', { product_code });
    });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === UNIQUE_VIOLATION
  );
}
