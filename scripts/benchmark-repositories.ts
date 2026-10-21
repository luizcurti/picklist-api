/**
 * Standalone benchmark for the PostgreSQL IProductRepository adapter —
 * reads, writes, and concurrent updates. Not part of `npm test` or CI; run
 * it locally (real numbers only, never fabricated):
 *
 *   docker compose up -d postgres
 *   npm run benchmark
 */
import { Pool } from 'pg';
import { PostgresProductRepository } from '@modules/products/repositories/postgresProductRepository';
import { IProductRepository } from '@modules/products/repositories/iProductRepository';
import { env } from '@config/env';
import { runMigrations } from '@shared/infra/database/pg/migrate';

const CREATE_COUNT = 500;
const CONCURRENT_UPDATES = 50;

interface Timing {
  label: string;
  totalMs: number;
  opsPerSecond: number;
  avgMs: number;
}

async function time(
  label: string,
  ops: number,
  fn: () => Promise<void>
): Promise<Timing> {
  const start = process.hrtime.bigint();
  await fn();
  const totalMs = Number(process.hrtime.bigint() - start) / 1e6;
  return {
    label,
    totalMs,
    opsPerSecond: ops / (totalMs / 1000),
    avgMs: totalMs / ops,
  };
}

function printTiming(t: Timing): void {
  console.log(
    `  ${t.label.padEnd(28)} ${t.totalMs.toFixed(1).padStart(9)}ms total  ` +
      `${t.opsPerSecond.toFixed(0).padStart(8)} ops/sec  ` +
      `${t.avgMs.toFixed(3).padStart(8)}ms/op`
  );
}

async function benchmarkRepository(
  name: string,
  repo: IProductRepository
): Promise<void> {
  console.log(`\n${name}`);
  console.log('-'.repeat(name.length));

  const codes = Array.from({ length: CREATE_COUNT }, (_, i) => `BENCH-${i}`);

  const createTiming = await time(
    'sequential creates',
    CREATE_COUNT,
    async () => {
      for (const code of codes) {
        await repo.create({
          product_code: code,
          quantity: 10,
          pick_location: 'A1',
        });
      }
    }
  );
  printTiming(createTiming);

  const readTiming = await time('sequential reads', CREATE_COUNT, async () => {
    for (const code of codes) {
      await repo.findByID(code);
    }
  });
  printTiming(readTiming);

  const concurrentCodes = codes.slice(0, CONCURRENT_UPDATES);
  const updateTiming = await time(
    `${CONCURRENT_UPDATES}-way concurrent updates`,
    CONCURRENT_UPDATES,
    async () => {
      await Promise.all(
        concurrentCodes.map((code, i) =>
          repo.update({ product_code: code, quantity: i, pick_location: 'B2' })
        )
      );
    }
  );
  printTiming(updateTiming);

  await time('cleanup', CREATE_COUNT, async () => {
    for (const code of codes) {
      await repo.remove(code);
    }
  });
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: env.databaseUrl });
  await runMigrations(pool);
  const pgRepo = new PostgresProductRepository(pool);

  console.log(
    `Benchmarking: ${CREATE_COUNT} creates/reads, ${CONCURRENT_UPDATES} concurrent updates\n`
  );

  await benchmarkRepository('PostgreSQL (PostgresProductRepository)', pgRepo);

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
