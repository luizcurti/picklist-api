import { Request, Response } from 'express';
import { FindProductController } from '@modules/products/useCases/findProduct/findProductController';
import { FindProductUseCase } from '@modules/products/useCases/findProduct/findProductUseCase';
import { IResponse } from '@modules/products/useCases/findProduct/iFindProductDTO';

jest.mock('@modules/products/useCases/findProduct/findProductUseCase');

describe('FindProductController', () => {
  let findProductController: FindProductController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockFindProductUseCase: jest.Mocked<FindProductUseCase>;

  beforeEach(() => {
    findProductController = new FindProductController();

    mockRequest = {
      params: {
        product_code: '123456',
      },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockFindProductUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<FindProductUseCase>;

    (
      FindProductUseCase as jest.MockedClass<typeof FindProductUseCase>
    ).mockImplementation(() => mockFindProductUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should list data by id successfully', async () => {
    const mockData = {
      product_code: '123456',
      quantity: 10,
      pick_location: 'A1',
    };

    mockFindProductUseCase.execute.mockResolvedValueOnce(mockData);

    await findProductController.handle(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockFindProductUseCase.execute).toHaveBeenCalledWith({
      product_code: '123456',
    });

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(mockData);
  });

  it('should convert product_code to string', async () => {
    mockRequest.params = { product_code: '789012' };
    const mockData = {
      product_code: '789012',
      quantity: 5,
      pick_location: 'B2',
    };

    mockFindProductUseCase.execute.mockResolvedValueOnce(mockData);

    await findProductController.handle(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockFindProductUseCase.execute).toHaveBeenCalledWith({
      product_code: '789012',
    });
  });

  it('should handle product not found error', async () => {
    const notFoundError = new Error('Product not found');
    mockFindProductUseCase.execute.mockRejectedValueOnce(notFoundError);

    await expect(
      findProductController.handle(
        mockRequest as Request,
        mockResponse as Response
      )
    ).rejects.toThrow(notFoundError);
  });

  it('should handle general errors from use case', async () => {
    const error = new Error('Database connection failed');
    mockFindProductUseCase.execute.mockRejectedValueOnce(error);

    await expect(
      findProductController.handle(
        mockRequest as Request,
        mockResponse as Response
      )
    ).rejects.toThrow(error);
  });

  it('should handle errors without message', async () => {
    const error = new Error('Unknown error');
    mockFindProductUseCase.execute.mockRejectedValueOnce(error);

    await expect(
      findProductController.handle(
        mockRequest as Request,
        mockResponse as Response
      )
    ).rejects.toThrow();
  });

  it('should handle missing params', async () => {
    mockRequest.params = {};
    const mockData = {
      product_code: undefined,
      quantity: 10,
      pick_location: 'A1',
    };

    mockFindProductUseCase.execute.mockResolvedValueOnce(
      mockData as unknown as IResponse
    );

    await findProductController.handle(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockFindProductUseCase.execute).toHaveBeenCalledWith({
      product_code: undefined,
    });
  });
});
