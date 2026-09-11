// Must stay the first import — patches http/express before they're required elsewhere.
import { otelSDK } from './tracing/otel';

import { env } from '@config/env';
import { logger } from '@shared/utils/logger';
import { App } from './app';
import { pool } from './database/pg/pool';
import { runMigrations } from './database/pg/migrate';

(async () => {
  if (env.usingDefaultApiKey) {
    logger.warn(
      'No API_KEYS configured — falling back to the default development key. Set API_KEYS for anything beyond local dev.',
      { header: 'X-API-Key', hint: 'see .env.example' }
    );
  }

  await runMigrations(pool);

  const app = new App();
  await app.init();

  const server = app.server.listen(env.port, () => {
    console.log(`[SERVER] LISTENING ON PORT ${env.port}`);
  });

  const shutdown = (signal: string) => {
    logger.info('Shutdown signal received, closing server', { signal });
    server.close(async () => {
      await otelSDK.shutdown();
      logger.info('Server closed gracefully');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})();
