import { Request, Response } from 'express';
import { CreatePickController } from '@modules/picks/useCases/createPick/createPickController';
import { CreatePickUseCase } from '@modules/picks/useCases/createPick/createPickUseCase';

jest.mock('@modules/picks/useCases/createPick/createPickUseCase');
jest.mock('@modules/picks/queue/rabbitMQPickQueue');

describe('CreatePickController', () => {
  let controller: CreatePickController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockUseCase: jest.Mocked<CreatePickUseCase>;

  beforeEach(() => {
    controller = new CreatePickController();

    mockRequest = {
      body: { product_code: 'SKU-1', quantity: 2, pick_location: 'A1' },
      headers: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CreatePickUseCase>;

    (
      CreatePickUseCase as jest.MockedClass<typeof CreatePickUseCase>
    ).mockImplementation(() => mockUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns 202 with the generated pick id', async () => {
    mockUseCase.execute.mockResolvedValueOnce({ pickId: 'pick-123' });

    await controller.handle(mockRequest as Request, mockResponse as Response);

    expect(mockUseCase.execute).toHaveBeenCalledWith({
      product_code: 'SKU-1',
      quantity: 2,
      pick_location: 'A1',
      idempotencyKey: undefined,
    });
    expect(mockResponse.status).toHaveBeenCalledWith(202);
    expect(mockResponse.json).toHaveBeenCalledWith({
      pickId: 'pick-123',
      status: 'accepted',
    });
  });

  it('forwards the Idempotency-Key header to the use case', async () => {
    mockRequest.headers = { 'idempotency-key': 'key-abc' };
    mockUseCase.execute.mockResolvedValueOnce({ pickId: 'pick-456' });

    await controller.handle(mockRequest as Request, mockResponse as Response);

    expect(mockUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'key-abc' })
    );
  });
});
