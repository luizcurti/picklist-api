import { CreateProductUseCase } from '@modules/products/useCases/createProduct/createProductUseCase';
import { InMemoryProductRepository } from './InMemoryProductRepository';
import { FindProductUseCase } from '@modules/products/useCases/findProduct/findProductUseCase';
import { AppError } from '@errors/appError';

describe('FindProductUseCase', () => {
  it('should list data', async () => {
    const inMemoryLessonsRepository = new InMemoryProductRepository();
    const createProduct = new CreateProductUseCase(inMemoryLessonsRepository);

    await createProduct.execute({
      product_code: '123456',
      quantity: 10,
      pick_location: 'A1',
    });

    await createProduct.execute({
      product_code: '785412',
      quantity: 7,
      pick_location: 'Z5',
    });

    await createProduct.execute({
      product_code: '36925814',
      quantity: 80,
      pick_location: 'G9',
    });

    const listData = new FindProductUseCase(inMemoryLessonsRepository);

    const dataList = await listData.execute({
      product_code: '785412',
    });

    expect(dataList).toHaveProperty('product_code');
    expect(dataList).toHaveProperty('quantity');
    expect(dataList).toHaveProperty('pick_location');
    expect(dataList.product_code).toBe('785412');
    expect(dataList.quantity).toBe(7);
    expect(dataList.pick_location).toBe('Z5');
  });

  it('should not remove a new data', async () => {
    const inMemoryLessonsRepository = new InMemoryProductRepository();
    const listData = new FindProductUseCase(inMemoryLessonsRepository);

    await expect(
      listData.execute({
        product_code: '785412',
      })
    ).rejects.toEqual(new AppError('Product not found', 404, 'Not Found'));
  });
});
