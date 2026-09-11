import { Channel } from 'amqplib';
import { AUDIT_BINDING_KEYS, EXCHANGE, QUEUES, ROUTING_KEYS } from './topology';

async function setupTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

  await channel.assertQueue(QUEUES.INVENTORY, { durable: true });
  await channel.bindQueue(
    QUEUES.INVENTORY,
    EXCHANGE,
    ROUTING_KEYS.PICK_CREATED
  );

  // Delay queue: no queue-level TTL — consumeWithRetry sets a per-message
  // `expiration` (exponential backoff), so each retry waits longer than the
  // last. Expiry still dead-letters back onto the exchange either way
  // (standard TTL-as-delay pattern, no plugins).
  await channel.assertQueue(QUEUES.INVENTORY_RETRY, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': EXCHANGE,
      'x-dead-letter-routing-key': ROUTING_KEYS.PICK_CREATED,
    },
  });
  await channel.bindQueue(
    QUEUES.INVENTORY_RETRY,
    EXCHANGE,
    ROUTING_KEYS.PICK_CREATED_RETRY
  );

  await channel.assertQueue(QUEUES.INVENTORY_DLQ, { durable: true });
  await channel.bindQueue(
    QUEUES.INVENTORY_DLQ,
    EXCHANGE,
    ROUTING_KEYS.PICK_CREATED_DEAD
  );

  // Explicit bindings only — a `pick.#` wildcard would also catch the retry/dead keys and double-process.
  await channel.assertQueue(QUEUES.AUDIT, { durable: true });
  await Promise.all(
    AUDIT_BINDING_KEYS.map((routingKey) =>
      channel.bindQueue(QUEUES.AUDIT, EXCHANGE, routingKey)
    )
  );

  await channel.assertQueue(QUEUES.AUDIT_RETRY, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': EXCHANGE,
      'x-dead-letter-routing-key': ROUTING_KEYS.PICK_AUDIT_REDELIVER,
    },
  });
  await channel.bindQueue(
    QUEUES.AUDIT_RETRY,
    EXCHANGE,
    ROUTING_KEYS.PICK_AUDIT_RETRY
  );

  await channel.assertQueue(QUEUES.AUDIT_DLQ, { durable: true });
  await channel.bindQueue(
    QUEUES.AUDIT_DLQ,
    EXCHANGE,
    ROUTING_KEYS.PICK_AUDIT_DEAD
  );
}

export { setupTopology };
