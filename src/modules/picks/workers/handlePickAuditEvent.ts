import { logger } from '@shared/utils/logger';

async function handlePickAuditEvent(
  event: unknown,
  routingKey: string
): Promise<void> {
  logger.info('Pick lifecycle event', {
    eventType: routingKey,
    ...(event as object),
  });
}

export { handlePickAuditEvent };
