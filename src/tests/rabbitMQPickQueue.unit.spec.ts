const publishMock = jest.fn().mockReturnValue(true);
const createChannelMock = jest.fn().mockResolvedValue({ publish: publishMock });
const connectMock = jest
  .fn()
  .mockResolvedValue({ createChannel: createChannelMock, on: jest.fn() });

jest.mock('amqplib', () => ({
  __esModule: true,
  default: { connect: (...args: unknown[]) => connectMock(...args) },
  connect: (...args: unknown[]) => connectMock(...args),
}));

import {
  EXCHANGE,
  ROUTING_KEYS,
} from '@shared/infra/messaging/rabbitmq/topology';
import type { RabbitMQPickQueue as RabbitMQPickQueueType } from '@modules/picks/queue/rabbitMQPickQueue';

const event = {
  pickId: 'pick-1',
  product_code: 'SKU-1',
  quantity: 2,
  pick_location: 'A1',
};

async function freshQueue(): Promise<RabbitMQPickQueueType> {
  jest.resetModules();
  const { RabbitMQPickQueue } =
    await import('@modules/picks/queue/rabbitMQPickQueue');
  return new RabbitMQPickQueue();
}

describe('RabbitMQPickQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    publishMock.mockReturnValue(true);
    createChannelMock.mockResolvedValue({ publish: publishMock });
    connectMock.mockResolvedValue({
      createChannel: createChannelMock,
      on: jest.fn(),
    });
  });

  it('publishes pick.created with a persistent, JSON-encoded message', async () => {
    const queue = await freshQueue();

    await queue.publishPickCreated(event);

    expect(publishMock).toHaveBeenCalledWith(
      EXCHANGE,
      ROUTING_KEYS.PICK_CREATED,
      Buffer.from(JSON.stringify(event)),
      expect.objectContaining({ persistent: true })
    );
  });

  it('publishes pick.completed and pick.failed to their own routing keys', async () => {
    const queue = await freshQueue();

    await queue.publishPickCompleted(event);
    await queue.publishPickFailed({ ...event, reason: 'INSUFFICIENT_STOCK' });

    expect(publishMock).toHaveBeenNthCalledWith(
      1,
      EXCHANGE,
      ROUTING_KEYS.PICK_COMPLETED,
      expect.any(Buffer),
      expect.anything()
    );
    expect(publishMock).toHaveBeenNthCalledWith(
      2,
      EXCHANGE,
      ROUTING_KEYS.PICK_FAILED,
      expect.any(Buffer),
      expect.anything()
    );
  });

  it('wraps a connection failure in an AppError', async () => {
    connectMock.mockRejectedValueOnce(new Error('connection refused'));
    const queue = await freshQueue();

    // Compared by shape, not `instanceof` — jest.resetModules() gives the
    // freshly re-imported rabbitMQPickQueue.ts its own AppError class
    // instance distinct from one statically imported at the top of this file.
    await expect(queue.publishPickCreated(event)).rejects.toMatchObject({
      name: 'AppError',
      code: 503,
      message: 'Failed to publish pick event',
    });
  });
});
