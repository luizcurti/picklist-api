import { handlePickAuditEvent } from '@modules/picks/workers/handlePickAuditEvent';
import { logger } from '@shared/utils/logger';

describe('handlePickAuditEvent', () => {
  it('logs the event with its routing key as the event type', async () => {
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});

    await handlePickAuditEvent(
      { pickId: 'p1', product_code: 'SKU-1', quantity: 2, pick_location: 'A1' },
      'pick.created'
    );

    expect(infoSpy).toHaveBeenCalledWith('Pick lifecycle event', {
      eventType: 'pick.created',
      pickId: 'p1',
      product_code: 'SKU-1',
      quantity: 2,
      pick_location: 'A1',
    });

    infoSpy.mockRestore();
  });
});
