import {
  handlePickCreated,
  isPickCreatedEvent,
} from '@modules/picks/useCases/processInventoryPick/handlePickCreated';
import { ProcessInventoryPickUseCase } from '@modules/picks/useCases/processInventoryPick/processInventoryPickUseCase';

jest.mock(
  '@modules/picks/useCases/processInventoryPick/processInventoryPickUseCase'
);
jest.mock('@modules/picks/queue/rabbitMQPickQueue');

describe('isPickCreatedEvent', () => {
  const valid = {
    pickId: 'p1',
    product_code: 'SKU-1',
    quantity: 1,
    pick_location: 'A1',
  };

  it('accepts a well-formed event', () => {
    expect(isPickCreatedEvent(valid)).toBe(true);
  });

  it('rejects null', () => {
    expect(isPickCreatedEvent(null)).toBe(false);
  });

  it('rejects a non-object primitive', () => {
    expect(isPickCreatedEvent('not an object')).toBe(false);
  });

  it('rejects a missing pickId', () => {
    expect(
      isPickCreatedEvent({
        product_code: valid.product_code,
        quantity: valid.quantity,
        pick_location: valid.pick_location,
      })
    ).toBe(false);
  });

  it('rejects a missing product_code', () => {
    expect(
      isPickCreatedEvent({
        pickId: valid.pickId,
        quantity: valid.quantity,
        pick_location: valid.pick_location,
      })
    ).toBe(false);
  });

  it('rejects a non-numeric quantity', () => {
    expect(isPickCreatedEvent({ ...valid, quantity: '1' })).toBe(false);
  });

  it('rejects a missing pick_location', () => {
    expect(
      isPickCreatedEvent({
        pickId: valid.pickId,
        product_code: valid.product_code,
        quantity: valid.quantity,
      })
    ).toBe(false);
  });
});

describe('handlePickCreated', () => {
  let mockExecute: jest.Mock;

  beforeEach(() => {
    mockExecute = jest.fn().mockResolvedValue(undefined);
    (
      ProcessInventoryPickUseCase as jest.MockedClass<
        typeof ProcessInventoryPickUseCase
      >
    ).mockImplementation(() => ({ execute: mockExecute }) as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates a well-formed event to ProcessInventoryPickUseCase', async () => {
    const event = {
      pickId: 'p1',
      product_code: 'SKU-1',
      quantity: 1,
      pick_location: 'A1',
    };

    await handlePickCreated(event);

    expect(mockExecute).toHaveBeenCalledWith(event);
  });

  it('throws on a malformed payload instead of delegating', async () => {
    await expect(handlePickCreated({ pickId: 'p1' })).rejects.toThrow(
      'Malformed pick.created event payload'
    );
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
