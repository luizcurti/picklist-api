import { AppError } from '@errors/appError';
import { getChannel } from '@shared/infra/messaging/rabbitmq/connection';
import {
  EXCHANGE,
  ROUTING_KEYS,
} from '@shared/infra/messaging/rabbitmq/topology';
import { IPickEvent, IPickFailedEvent, IPickQueue } from './iPickQueue';

class RabbitMQPickQueue implements IPickQueue {
  private async publish(routingKey: string, event: unknown): Promise<void> {
    try {
      const channel = await getChannel();
      channel.publish(
        EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify(event)),
        {
          persistent: true,
          headers: { 'x-retry-count': 0 },
        }
      );
    } catch (error) {
      // Broker outage, not an app bug — 503 signals retryable, unlike a generic 500.
      throw new AppError(
        'Failed to publish pick event',
        503,
        'Service Unavailable',
        error
      );
    }
  }

  async publishPickCreated(event: IPickEvent): Promise<void> {
    await this.publish(ROUTING_KEYS.PICK_CREATED, event);
  }

  async publishPickCompleted(event: IPickEvent): Promise<void> {
    await this.publish(ROUTING_KEYS.PICK_COMPLETED, event);
  }

  async publishPickFailed(event: IPickFailedEvent): Promise<void> {
    await this.publish(ROUTING_KEYS.PICK_FAILED, event);
  }
}

export const rabbitMQPickQueue = new RabbitMQPickQueue();
export { RabbitMQPickQueue };
