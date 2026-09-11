import { Request, Response } from 'express';
import { UpdateProductController } from '@modules/products/useCases/updateProduct/updateProductController';
import { UpdateProductUseCase } from '@modules/products/useCases/updateProduct/updateProductUseCase';
import { IProduct } from '@modules/products/repositories/iProductRepository';

jest.mock('@modules/products/useCases/updateProduct/updateProductUseCase');

describe('UpdateProductController', () => {
  let updateProductController: UpdateProductController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockUpdateProductUseCase: jest.Mocked<UpdateProductUseCase>;

  beforeEach(() => {
    updateProductController = new UpdateProductController();

    mockRequest = {
      params: {
        product_code: '123456',
      },
      body: {
        quantity: 15,
        pick_location: 'B2',
      },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockUpdateProductUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<UpdateProductUseCase>;

    (
      UpdateProductUseCase as jest.MockedClass<typeof UpdateProductUseCase>
    ).mockImplementation(() => mockUpdateProductUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should edit data successfully', async () => {
    const mockUpdatedData = {
      product_code: '123456',
      quantity: 15,
      pick_location: 'B2',
    };

    mockUpdateProductUseCase.execute.mockResolvedValueOnce(mockUpdatedData);

    await updateProductController.handle(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockUpdateProductUseCase.execute).toHaveBeenCalledWith({
      product_code: '123456',
      quantity: 15,
      pick_location: 'B2',
    });

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(mockUpdatedData);
  });

  it('should convert all inputs to strings', async () => {
    mockRequest.params = { product_code: '123456' };
    mockRequest.body = {
      quantity: 20,
      pick_location: 'C3',
    };

    const mockUpdatedData = {
      product_code: '123456',
      quantity: 20,
      pick_location: 'C3',
    };

    mockUpdateProductUseCase.execute.mockResolvedValueOnce(mockUpdatedData);

    await updateProductController.handle(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockUpdateProductUseCase.execute).toHaveBeenCalledWith({
      product_code: '123456',
      quantity: 20,
      pick_location: 'C3',
    });
  });

  it('should handle errors from use case', async () => {
    const error = new Error('Product not found');
    mockUpdateProductUseCase.execute.mockRejectedValueOnce(error);

    await expect(
      updateProductController.handle(
        mockRequest as Request,
        mockResponse as Response
      )
    ).rejects.toThrow(error);
  });

  it('should handle errors without message', async () => {
    const error = new Error('Unknown error');
    mockUpdateProductUseCase.execute.mockRejectedValueOnce(error);

    await expect(
      updateProductController.handle(
        mockRequest as Request,
        mockResponse as Response
      )
    ).rejects.toThrow();
  });

  it('should handle missing params', async () => {
    mockRequest.params = {};
    const mockUpdatedData = {
      product_code: undefined,
      quantity: 15,
      pick_location: 'B2',
    };

    mockUpdateProductUseCase.execute.mockResolvedValueOnce(
      mockUpdatedData as unknown as IProduct
    );

    await updateProductController.handle(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockUpdateProductUseCase.execute).toHaveBeenCalledWith({
      product_code: undefined,
      quantity: 15,
      pick_location: 'B2',
    });
  });

  it('should handle missing body properties', async () => {
    mockRequest.body = {};
    const mockUpdatedData = {
      product_code: '123456',
      quantity: undefined,
      pick_location: undefined,
    };

    mockUpdateProductUseCase.execute.mockResolvedValueOnce(
      mockUpdatedData as unknown as IProduct
    );

    await updateProductController.handle(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockUpdateProductUseCase.execute).toHaveBeenCalledWith({
      product_code: '123456',
      quantity: undefined,
      pick_location: undefined,
    });
  });
});
