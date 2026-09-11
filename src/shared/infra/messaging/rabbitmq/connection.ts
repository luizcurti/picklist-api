import amqp, { Channel, ChannelModel } from 'amqplib';
import { env } from '@config/env';
import { logger } from '@shared/utils/logger';

let connectionPromise: Promise<ChannelModel> | null = null;
let channelPromise: Promise<Channel> | null = null;

function getConnection(): Promise<ChannelModel> {
  if (!connectionPromise) {
    connectionPromise = amqp
      .connect(env.rabbitmqUrl)
      .then((connection) => {
        // An unhandled 'error' on this EventEmitter throws and crashes the
        // process with a raw stack trace, bypassing the structured logger.
        // A connection that errors out after being established can't self
        // heal here (the cached promise above would keep handing out the
        // now-dead connection), so this fails fast and relies on the
        // container's `restart: unless-stopped` to reconnect cleanly on a
        // fresh process instead.
        connection.on('error', (error) => {
          logger.error('RabbitMQ connection error', {
            error: error instanceof Error ? error.message : String(error),
          });
          process.exit(1);
        });
        return connection;
      })
      .catch((error) => {
        // Clear the cache on failure so the next call retries instead of
        // reusing a rejected promise forever.
        connectionPromise = null;
        throw error;
      });
  }
  return connectionPromise;
}

async function getChannel(): Promise<Channel> {
  if (!channelPromise) {
    channelPromise = getConnection()
      .then((connection) => connection.createChannel())
      .catch((error) => {
        channelPromise = null;
        throw error;
      });
  }
  return channelPromise;
}

export { getConnection, getChannel };
