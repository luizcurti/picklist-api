import { Request, Response } from 'express';
import { DeleteProductController } from '@modules/products/useCases/deleteProduct/deleteProductController';
import { DeleteProductUseCase } from '@modules/products/useCases/deleteProduct/deleteProductUseCase';
import { AppError } from '@errors/appError';

jest.mock('@modules/products/useCases/deleteProduct/deleteProductUseCase');

describe('DeleteProductController', () => {
  let deleteProductController: DeleteProductController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockDeleteProductUseCase: jest.Mocked<DeleteProductUseCase>;

  beforeEach(() => {
    deleteProductController = new DeleteProductController();

    mockRequest = {
      params: {
        product_code: '123456',
      },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockDeleteProductUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<DeleteProductUseCase>;

    (
      DeleteProductUseCase as jest.MockedClass<typeof DeleteProductUseCase>
    ).mockImplementation(() => mockDeleteProductUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should delete data successfully', async () => {
    mockDeleteProductUseCase.execute.mockResolvedValueOnce(undefined);

    await deleteProductController.handle(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockDeleteProductUseCase.execute).toHaveBeenCalledWith({
      product_code: '123456',
    });

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Product deleted successfully.',
    });
  });

  it('should convert product_code to string', async () => {
    mockRequest.params = { product_code: '789012' };
    mockDeleteProductUseCase.execute.mockResolvedValueOnce(undefined);

    await deleteProductController.handle(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockDeleteProductUseCase.execute).toHaveBeenCalledWith({
      product_code: '789012',
    });
  });

  it('should handle 404 error when data not found', async () => {
    const notFoundError = new AppError('Data not found', 404, 'Not Found');
    mockDeleteProductUseCase.execute.mockRejectedValueOnce(notFoundError);

    await expect(
      deleteProductController.handle(
        mockRequest as Request,
        mockResponse as Response
      )
    ).rejects.toThrow(notFoundError);
  });

  it('should handle general errors from use case', async () => {
    const error = new Error('Database connection failed');
    mockDeleteProductUseCase.execute.mockRejectedValueOnce(error);

    await expect(
      deleteProductController.handle(
        mockRequest as Request,
        mockResponse as Response
      )
    ).rejects.toThrow(error);
  });

  it('should handle errors without message', async () => {
    const error = new Error('Unknown error');
    mockDeleteProductUseCase.execute.mockRejectedValueOnce(error);

    await expect(
      deleteProductController.handle(
        mockRequest as Request,
        mockResponse as Response
      )
    ).rejects.toThrow();
  });

  it('should handle missing params', async () => {
    mockRequest.params = {};
    mockDeleteProductUseCase.execute.mockResolvedValueOnce(undefined);

    await deleteProductController.handle(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockDeleteProductUseCase.execute).toHaveBeenCalledWith({
      product_code: undefined,
    });
  });
});
