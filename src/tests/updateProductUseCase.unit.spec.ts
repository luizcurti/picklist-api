import { CreateProductUseCase } from '@modules/products/useCases/createProduct/createProductUseCase';
import { InMemoryProductRepository } from './InMemoryProductRepository';
import { UpdateProductUseCase } from '@modules/products/useCases/updateProduct/updateProductUseCase';
import { AppError } from '@errors/appError';

describe('CreateProductUseCase', () => {
  it('should remove a new data', async () => {
    const inMemoryLessonsRepository = new InMemoryProductRepository();
    const createProduct = new CreateProductUseCase(inMemoryLessonsRepository);

    await createProduct.execute({
      product_code: '123456',
      quantity: 10,
      pick_location: 'A1',
    });

    const updateProduct = new UpdateProductUseCase(inMemoryLessonsRepository);

    const dataEdit = await updateProduct.execute({
      product_code: '123456',
      quantity: 20,
      pick_location: 'A2',
    });

    expect(dataEdit).toHaveProperty('product_code');
    expect(dataEdit).toHaveProperty('quantity');
    expect(dataEdit).toHaveProperty('pick_location');

    expect(dataEdit.product_code).toBe('123456');
    expect(dataEdit.quantity).toBe(20);
    expect(dataEdit.pick_location).toBe('A2');
  });

  it('should not remove a new data', async () => {
    const inMemoryLessonsRepository = new InMemoryProductRepository();
    const updateProduct = new UpdateProductUseCase(inMemoryLessonsRepository);

    await expect(
      updateProduct.execute({
        product_code: '123456',
        quantity: 20,
        pick_location: 'A2',
      })
    ).rejects.toEqual(new AppError('Product not found', 404, 'Not Found'));
  });

  it('should apply a positive quantity_delta relative to current stock', async () => {
    const inMemoryLessonsRepository = new InMemoryProductRepository();
    const createProduct = new CreateProductUseCase(inMemoryLessonsRepository);

    await createProduct.execute({
      product_code: '123456',
      quantity: 10,
      pick_location: 'A1',
    });

    const updateProduct = new UpdateProductUseCase(inMemoryLessonsRepository);

    const dataEdit = await updateProduct.execute({
      product_code: '123456',
      quantity_delta: 5,
      pick_location: 'A1',
    });

    expect(dataEdit.quantity).toBe(15);
  });

  it('should apply a negative quantity_delta relative to current stock', async () => {
    const inMemoryLessonsRepository = new InMemoryProductRepository();
    const createProduct = new CreateProductUseCase(inMemoryLessonsRepository);

    await createProduct.execute({
      product_code: '123456',
      quantity: 10,
      pick_location: 'A1',
    });

    const updateProduct = new UpdateProductUseCase(inMemoryLessonsRepository);

    const dataEdit = await updateProduct.execute({
      product_code: '123456',
      quantity_delta: -4,
      pick_location: 'A1',
    });

    expect(dataEdit.quantity).toBe(6);
  });

  it('should reject a quantity_delta that would result in negative stock', async () => {
    const inMemoryLessonsRepository = new InMemoryProductRepository();
    const createProduct = new CreateProductUseCase(inMemoryLessonsRepository);

    await createProduct.execute({
      product_code: '123456',
      quantity: 3,
      pick_location: 'A1',
    });

    const updateProduct = new UpdateProductUseCase(inMemoryLessonsRepository);

    await expect(
      updateProduct.execute({
        product_code: '123456',
        quantity_delta: -5,
        pick_location: 'A1',
      })
    ).rejects.toMatchObject({
      name: 'InvalidQuantityDeltaError',
      code: 409,
      type: 'Conflict',
    });
  });
});
