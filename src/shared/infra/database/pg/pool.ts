import { Pool } from 'pg';
import { env } from '@config/env';
import { logger } from '@shared/utils/logger';

export const pool = new Pool({ connectionString: env.databaseUrl });

// pg.Pool emits 'error' for a connection failure on an already-idle client
// (e.g. the server restarting) — the pool itself discards that client and
// opens a new one on the next query, but an unhandled 'error' on this
// EventEmitter would otherwise throw and crash the process. Unlike the
// RabbitMQ connection, this only logs (never exits): the pool already
// self-heals per client, so exiting would be an overreaction.
pool.on('error', (error) => {
  logger.error('PostgreSQL pool error', { error: error.message });
});
