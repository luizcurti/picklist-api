import { IProductRepository } from './iProductRepository';
import { PostgresProductRepository } from './postgresProductRepository';
import { pool } from '@shared/infra/database/pg/pool';

export const productRepository: IProductRepository =
  new PostgresProductRepository(pool);
