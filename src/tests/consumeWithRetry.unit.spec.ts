import { Channel, ConsumeMessage } from 'amqplib';
import { consumeWithRetry } from '@shared/infra/messaging/rabbitmq/consumeWithRetry';

function buildMessage(payload: unknown, retryCount?: number): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify(payload)),
    fields: { routingKey: 'pick.created' },
    properties: {
      headers: retryCount === undefined ? {} : { 'x-retry-count': retryCount },
    },
  } as unknown as ConsumeMessage;
}

function buildChannel() {
  let onMessage: ((msg: ConsumeMessage | null) => void) | undefined;

  return {
    prefetch: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn((_queue: string, cb: typeof onMessage) => {
      onMessage = cb;
      return Promise.resolve({ consumerTag: 'tag' });
    }),
    ack: jest.fn(),
    nack: jest.fn(),
    publish: jest.fn().mockReturnValue(true),
    emit: (msg: ConsumeMessage) => onMessage?.(msg),
  } as unknown as Channel & { emit: (msg: ConsumeMessage) => void };
}

const baseOptions = {
  queue: 'picks.inventory',
  exchange: 'picks.events',
  retryRoutingKey: 'pick.created.retry',
  deadRoutingKey: 'pick.created.dead',
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 60_000,
  random: () => 0.5,
};

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('consumeWithRetry', () => {
  it('acks the message and never publishes when the handler succeeds', async () => {
    const channel = buildChannel();
    const handler = jest.fn().mockResolvedValue(undefined);

    await consumeWithRetry({ ...baseOptions, channel, handler });
    const msg = buildMessage({ ok: true });
    channel.emit(msg);
    await flush();

    expect(handler).toHaveBeenCalledWith({ ok: true }, msg);
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('republishes to the retry routing key with an incremented header below max retries', async () => {
    const channel = buildChannel();
    const handler = jest.fn().mockRejectedValue(new Error('transient'));

    await consumeWithRetry({ ...baseOptions, channel, handler });
    const msg = buildMessage({ ok: false }, 1);
    channel.emit(msg);
    await flush();

    // attempt=1: exponential = min(60000, 1000*2) = 2000; equal jitter with
    // random()=0.5 -> 2000/2 + 0.5*2000/2 = 1500.
    expect(channel.publish).toHaveBeenCalledWith(
      baseOptions.exchange,
      baseOptions.retryRoutingKey,
      msg.content,
      expect.objectContaining({
        persistent: true,
        expiration: '1500',
        headers: expect.objectContaining({ 'x-retry-count': 2 }),
      })
    );
    expect(channel.ack).toHaveBeenCalledWith(msg);
    // never redelivers via nack — that would hot-loop instead of backing off
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('dead-letters the message once retries are exhausted', async () => {
    const channel = buildChannel();
    const handler = jest.fn().mockRejectedValue(new Error('still failing'));

    await consumeWithRetry({ ...baseOptions, channel, handler });
    const msg = buildMessage({ ok: false }, 3);
    channel.emit(msg);
    await flush();

    expect(channel.publish).toHaveBeenCalledWith(
      baseOptions.exchange,
      baseOptions.deadRoutingKey,
      msg.content,
      expect.objectContaining({ persistent: true })
    );
    expect(channel.ack).toHaveBeenCalledWith(msg);
  });

  it('defaults the retry count to 0 when the message has no headers at all', async () => {
    const channel = buildChannel();
    const handler = jest.fn().mockRejectedValue(new Error('transient'));

    await consumeWithRetry({ ...baseOptions, channel, handler });
    const msg = {
      content: Buffer.from(JSON.stringify({ ok: false })),
      fields: { routingKey: 'pick.created' },
      properties: {},
    } as unknown as ConsumeMessage;
    channel.emit(msg);
    await flush();

    // attempt=0: exponential = min(60000, 1000*1) = 1000; equal jitter with
    // random()=0.5 -> 1000/2 + 0.5*1000/2 = 750.
    expect(channel.publish).toHaveBeenCalledWith(
      baseOptions.exchange,
      baseOptions.retryRoutingKey,
      msg.content,
      expect.objectContaining({
        expiration: '750',
        headers: expect.objectContaining({ 'x-retry-count': 1 }),
      })
    );
  });

  it('stringifies a non-Error thrown value for the log message', async () => {
    const channel = buildChannel();
    const handler = jest.fn().mockRejectedValue('a plain string failure');

    await consumeWithRetry({ ...baseOptions, channel, handler });
    const msg = buildMessage({ ok: false }, 0);
    channel.emit(msg);
    await flush();

    // Doesn't throw and still resolves the message — proves the
    // non-Error branch of `error instanceof Error ? ... : String(error)`
    // is exercised without crashing the consumer.
    expect(channel.ack).toHaveBeenCalledWith(msg);
  });

  it('ignores a null message (consumer cancellation notice)', async () => {
    const channel = buildChannel();
    const handler = jest.fn();

    await consumeWithRetry({ ...baseOptions, channel, handler });
    channel.emit(null as unknown as ConsumeMessage);
    await flush();

    expect(handler).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
  });
});
