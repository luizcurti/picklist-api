import { Request, Response } from 'express';
import { CreateProductController } from '@modules/products/useCases/createProduct/createProductController';
import { CreateProductUseCase } from '@modules/products/useCases/createProduct/createProductUseCase';
import { AppError } from '@errors/appError';

jest.mock('@modules/products/useCases/createProduct/createProductUseCase');

describe('CreateProductController', () => {
  let createProductController: CreateProductController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockCreateProductUseCase: jest.Mocked<CreateProductUseCase>;

  beforeEach(() => {
    createProductController = new CreateProductController();

    mockRequest = {
      body: {
        product_code: '123456',
        quantity: 10,
        pick_location: 'A1',
      },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockCreateProductUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CreateProductUseCase>;

    (
      CreateProductUseCase as jest.MockedClass<typeof CreateProductUseCase>
    ).mockImplementation(() => mockCreateProductUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new data successfully', async () => {
    const mockCreatedData = {
      product_code: '123456',
      quantity: 10,
      pick_location: 'A1',
    };

    mockCreateProductUseCase.execute.mockResolvedValueOnce(mockCreatedData);

    await createProductController.handle(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockCreateProductUseCase.execute).toHaveBeenCalledWith({
      product_code: '123456',
      quantity: 10,
      pick_location: 'A1',
    });

    expect(mockResponse.status).toHaveBeenCalledWith(201);
    expect(mockResponse.json).toHaveBeenCalledWith(mockCreatedData);
  });

  it('should return validation error when required fields are missing', async () => {
    mockRequest.body = {
      product_code: '123456',
    };

    await createProductController.handle(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockCreateProductUseCase.execute).toHaveBeenCalled();
  });

  it('should handle AppError from use case', async () => {
    const appError = new AppError('Product already exists', 409, 'Conflict');
    mockCreateProductUseCase.execute.mockRejectedValueOnce(appError);

    await expect(
      createProductController.handle(
        mockRequest as Request,
        mockResponse as Response
      )
    ).rejects.toThrow(appError);
  });

  it('should handle unexpected errors', async () => {
    const unexpectedError = new Error('Database connection failed');
    mockCreateProductUseCase.execute.mockRejectedValueOnce(unexpectedError);

    await expect(
      createProductController.handle(
        mockRequest as Request,
        mockResponse as Response
      )
    ).rejects.toThrow(unexpectedError);
  });

  it('should accept numeric product_code', async () => {
    mockRequest.body = {
      product_code: '123456',
      quantity: 10,
      pick_location: 'A1',
    };

    const mockCreatedData = {
      product_code: '123456',
      quantity: 10,
      pick_location: 'A1',
    };

    mockCreateProductUseCase.execute.mockResolvedValueOnce(mockCreatedData);

    await createProductController.handle(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockCreateProductUseCase.execute).toHaveBeenCalledWith({
      product_code: '123456',
      quantity: 10,
      pick_location: 'A1',
    });
  });
});
