import { createClient, RedisClientType } from 'redis';
import { env } from '@config/env';
import { logger } from '@shared/utils/logger';

let clientPromise: Promise<RedisClientType> | null = null;

function getRedisClient(): Promise<RedisClientType> {
  if (!clientPromise) {
    const client: RedisClientType = createClient({ url: env.redisUrl });

    // Unlike the RabbitMQ connection, this only logs (never exits): the
    // client has its own default reconnection strategy and keeps emitting
    // 'error' on every failed attempt while it retries in the background —
    // exiting here would crash-loop the process instead of letting it
    // recover on its own.
    client.on('error', (error) => {
      logger.error('Redis client error', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    clientPromise = client.connect().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

export { getRedisClient };
