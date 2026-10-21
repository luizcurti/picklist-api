import { Channel } from 'amqplib';
import { setupTopology } from '@shared/infra/messaging/rabbitmq/setupTopology';
import {
  EXCHANGE,
  QUEUES,
  ROUTING_KEYS,
} from '@shared/infra/messaging/rabbitmq/topology';

function buildChannel(): jest.Mocked<Channel> {
  return {
    assertExchange: jest.fn().mockResolvedValue(undefined),
    assertQueue: jest.fn().mockResolvedValue(undefined),
    bindQueue: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<Channel>;
}

describe('setupTopology', () => {
  it('declares the topic exchange', async () => {
    const channel = buildChannel();

    await setupTopology(channel);

    expect(channel.assertExchange).toHaveBeenCalledWith(EXCHANGE, 'topic', {
      durable: true,
    });
  });

  it('binds the inventory queue only to pick.created', async () => {
    const channel = buildChannel();

    await setupTopology(channel);

    expect(channel.bindQueue).toHaveBeenCalledWith(
      QUEUES.INVENTORY,
      EXCHANGE,
      ROUTING_KEYS.PICK_CREATED
    );
  });

  it('configures the inventory retry queue as a TTL delay queue that dead-letters back to pick.created', async () => {
    const channel = buildChannel();

    await setupTopology(channel);

    expect(channel.assertQueue).toHaveBeenCalledWith(
      QUEUES.INVENTORY_RETRY,
      expect.objectContaining({
        arguments: expect.objectContaining({
          'x-dead-letter-exchange': EXCHANGE,
          'x-dead-letter-routing-key': ROUTING_KEYS.PICK_CREATED,
        }),
      })
    );
  });

  it('binds the audit queue explicitly to each lifecycle key, never a wildcard', async () => {
    const channel = buildChannel();

    await setupTopology(channel);

    const auditBindings = (channel.bindQueue as jest.Mock).mock.calls.filter(
      ([queue]) => queue === QUEUES.AUDIT
    );
    const boundRoutingKeys = auditBindings.map(
      ([, , routingKey]) => routingKey
    );

    expect(boundRoutingKeys).toEqual(
      expect.arrayContaining([
        ROUTING_KEYS.PICK_CREATED,
        ROUTING_KEYS.PICK_COMPLETED,
        ROUTING_KEYS.PICK_FAILED,
        ROUTING_KEYS.PICK_AUDIT_REDELIVER,
      ])
    );
    expect(boundRoutingKeys).not.toContain('pick.#');
  });
});
