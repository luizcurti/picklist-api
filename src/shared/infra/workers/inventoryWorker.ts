// Must stay the first import — patches http/express before they're required elsewhere.
import { otelSDK } from '../tracing/otel';

import { env } from '@config/env';
import { logger } from '@shared/utils/logger';
import { getChannel, getConnection } from '../messaging/rabbitmq/connection';
import { setupTopology } from '../messaging/rabbitmq/setupTopology';
import { EXCHANGE, QUEUES, ROUTING_KEYS } from '../messaging/rabbitmq/topology';
import { consumeWithRetry } from '../messaging/rabbitmq/consumeWithRetry';
import { handlePickCreated } from '@modules/picks/useCases/processInventoryPick/handlePickCreated';

(async () => {
  const channel = await getChannel();
  await setupTopology(channel);

  await consumeWithRetry({
    channel,
    queue: QUEUES.INVENTORY,
    exchange: EXCHANGE,
    retryRoutingKey: ROUTING_KEYS.PICK_CREATED_RETRY,
    deadRoutingKey: ROUTING_KEYS.PICK_CREATED_DEAD,
    maxRetries: env.pickRetryMax,
    baseDelayMs: env.pickRetryDelayMs,
    maxDelayMs: env.pickRetryMaxDelayMs,
    handler: (event) => handlePickCreated(event),
  });

  logger.info('Inventory worker listening', { queue: QUEUES.INVENTORY });

  const shutdown = async (signal: string) => {
    logger.info('Inventory worker shutting down', { signal });
    const connection = await getConnection();
    await connection.close();
    await otelSDK.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
})();
