import { Request, Response } from 'express';
import { ListProductsController } from '@modules/products/useCases/listProducts/listProductsController';
import { ListProductsUseCase } from '@modules/products/useCases/listProducts/listProductsUseCase';

jest.mock('@modules/products/useCases/listProducts/listProductsUseCase');

describe('ListProductsController', () => {
  let listProductsController: ListProductsController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockListProductsUseCase: jest.Mocked<ListProductsUseCase>;

  beforeEach(() => {
    listProductsController = new ListProductsController();

    mockRequest = {
      query: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockListProductsUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ListProductsUseCase>;

    (
      ListProductsUseCase as jest.MockedClass<typeof ListProductsUseCase>
    ).mockImplementation(() => mockListProductsUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should list all data successfully', async () => {
    const mockResult = {
      data: [
        {
          product_code: '123456',
          quantity: 10,
          pick_location: 'A1',
        },
        {
          product_code: '789012',
          quantity: 5,
          pick_location: 'B2',
        },
      ],
      pagination: {
        total: 2,
        limit: 100,
        offset: 0,
        hasMore: false,
      },
    };

    mockListProductsUseCase.execute.mockResolvedValueOnce(mockResult);

    await listProductsController.handle(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockListProductsUseCase.execute).toHaveBeenCalledWith({
      limit: undefined,
      offset: undefined,
    });
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
  });

  it('should return empty array when no data exists', async () => {
    const mockEmptyResult = {
      data: [],
      pagination: {
        total: 0,
        limit: 100,
        offset: 0,
        hasMore: false,
      },
    };

    mockListProductsUseCase.execute.mockResolvedValueOnce(mockEmptyResult);

    await listProductsController.handle(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockListProductsUseCase.execute).toHaveBeenCalledWith({
      limit: undefined,
      offset: undefined,
    });
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(mockEmptyResult);
  });

  it('should handle pagination with limit and offset', async () => {
    mockRequest.query = {
      limit: '50',
      offset: '10',
    };

    const mockResult = {
      data: [
        {
          product_code: '123456',
          quantity: 10,
          pick_location: 'A1',
        },
      ],
      pagination: {
        total: 100,
        limit: 50,
        offset: 10,
        hasMore: true,
      },
    };

    mockListProductsUseCase.execute.mockResolvedValueOnce(mockResult);

    await listProductsController.handle(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockListProductsUseCase.execute).toHaveBeenCalledWith({
      limit: 50,
      offset: 10,
    });
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
  });

  it('should handle errors from use case', async () => {
    const error = new Error('Failed to read storage');
    mockListProductsUseCase.execute.mockRejectedValueOnce(error);

    await expect(
      listProductsController.handle(
        mockRequest as Request,
        mockResponse as Response
      )
    ).rejects.toThrow(error);
  });

  it('should handle unexpected errors without message', async () => {
    const error = new Error('Unknown error');
    mockListProductsUseCase.execute.mockRejectedValueOnce(error);

    await expect(
      listProductsController.handle(
        mockRequest as Request,
        mockResponse as Response
      )
    ).rejects.toThrow();
  });
});
