import { Channel, ConsumeMessage } from 'amqplib';
import { logger } from '@shared/utils/logger';
import { computeRetryDelayMs } from './backoff';

const RETRY_COUNT_HEADER = 'x-retry-count';

type Handler = (event: unknown, msg: ConsumeMessage) => Promise<void>;

interface ConsumeWithRetryOptions {
  channel: Channel;
  queue: string;
  exchange: string;
  retryRoutingKey: string;
  deadRoutingKey: string;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  handler: Handler;
  random?: () => number;
}

function getRetryCount(msg: ConsumeMessage): number {
  const value = msg.properties.headers?.[RETRY_COUNT_HEADER];
  return typeof value === 'number' ? value : 0;
}

async function consumeWithRetry(
  options: ConsumeWithRetryOptions
): Promise<void> {
  const {
    channel,
    queue,
    exchange,
    retryRoutingKey,
    deadRoutingKey,
    maxRetries,
    baseDelayMs,
    maxDelayMs,
    handler,
    random,
  } = options;

  // Handlers aren't awaited before the next delivery, so without a prefetch
  // limit RabbitMQ pushes every message at once. Only reduces in-process
  // contention — a second worker replica can still race (the atomic
  // repository update handles that).
  await channel.prefetch(1);

  await channel.consume(queue, (msg) => {
    if (!msg) return;

    void (async () => {
      const retryCount = getRetryCount(msg);

      try {
        const event = JSON.parse(msg.content.toString());
        await handler(event, msg);
        channel.ack(msg);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (retryCount < maxRetries) {
          const delayMs = computeRetryDelayMs(retryCount, {
            baseDelayMs,
            maxDelayMs,
            random,
          });

          // Per-message TTL (not a queue-level one), so each retry backs
          // off further than the last. Trade-off: RabbitMQ only checks a
          // classic queue's head message for expiry, so a message here can
          // sit slightly past its own delay if an earlier, longer-delay
          // message is still ahead of it in the same retry queue.
          channel.publish(exchange, retryRoutingKey, msg.content, {
            persistent: true,
            expiration: String(delayMs),
            headers: {
              ...msg.properties.headers,
              [RETRY_COUNT_HEADER]: retryCount + 1,
            },
          });
          logger.warn('Message processing failed, scheduled for retry', {
            queue,
            retryCount: retryCount + 1,
            maxRetries,
            delayMs,
            error: message,
          });
        } else {
          channel.publish(exchange, deadRoutingKey, msg.content, {
            persistent: true,
            headers: msg.properties.headers,
          });
          logger.error('Message exhausted retries, moved to DLQ', {
            queue,
            retryCount,
            error: message,
          });
        }

        // Always acked — retries go through the delay queue, never nack(requeue=true) (would hot-loop).
        channel.ack(msg);
      }
    })();
  });
}

export { consumeWithRetry };
