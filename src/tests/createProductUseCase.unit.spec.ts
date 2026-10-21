import { CreateProductUseCase } from '@modules/products/useCases/createProduct/createProductUseCase';
import { InMemoryProductRepository } from './InMemoryProductRepository';
import { AppError } from '@errors/appError';

describe('CreateProductUseCase', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new data', async () => {
    const inMemoryLessonsRepositoryCreate = new InMemoryProductRepository();
    const useCase = new CreateProductUseCase(inMemoryLessonsRepositoryCreate);

    const dataCreate = await useCase.execute({
      product_code: '123456',
      quantity: 10,
      pick_location: 'A1',
    });

    expect(dataCreate).toHaveProperty('product_code');
    expect(dataCreate).toHaveProperty('quantity');
    expect(dataCreate).toHaveProperty('pick_location');

    expect(dataCreate.product_code).toBe('123456');
    expect(dataCreate.quantity).toBe(10);
    expect(dataCreate.pick_location).toBe('A1');
  });

  it('should not create a new data when data already exists', async () => {
    const inMemoryLessonsRepository = new InMemoryProductRepository();
    const useCase = new CreateProductUseCase(inMemoryLessonsRepository);

    await useCase.execute({
      product_code: '654321',
      quantity: 10,
      pick_location: 'A1',
    });

    await expect(
      useCase.execute({
        product_code: '654321',
        quantity: 10,
        pick_location: 'A1',
      })
    ).rejects.toThrow('already exists');
  });

  it('should throw an error if the repository throws an error', async () => {
    const repository = new InMemoryProductRepository();
    const useCase = new CreateProductUseCase(repository);

    jest.spyOn(repository, 'create').mockImplementationOnce(() => {
      throw new AppError(
        `Product with code '123456' already exists`,
        409,
        'Conflict'
      );
    });

    await expect(
      useCase.execute({
        product_code: '123456',
        quantity: 10,
        pick_location: 'A1',
      })
    ).rejects.toThrow('already exists');
  });

  it('should handle unexpected errors properly', async () => {
    const repository = new InMemoryProductRepository();
    const useCase = new CreateProductUseCase(repository);

    jest.spyOn(repository, 'create').mockImplementationOnce(() => {
      throw new Error('Unexpected error');
    });

    await expect(
      useCase.execute({
        product_code: '123456',
        quantity: 10,
        pick_location: 'A1',
      })
    ).rejects.toThrow(
      new AppError('Failed to create data', 500, 'Internal Server Error')
    );
  });
});
