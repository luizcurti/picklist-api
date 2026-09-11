import { CreateProductUseCase } from '@modules/products/useCases/createProduct/createProductUseCase';
import { InMemoryProductRepository } from './InMemoryProductRepository';
import { ListProductsUseCase } from '@modules/products/useCases/listProducts/listProductsUseCase';

describe('CreateProductUseCase', () => {
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

    const listData = new ListProductsUseCase(inMemoryLessonsRepository);

    const result = await listData.execute();

    expect(result.data).toHaveLength(3);
    expect(result.pagination.total).toBe(3);
    expect(result.pagination.limit).toBe(100);
    expect(result.pagination.offset).toBe(0);
    expect(result.pagination.hasMore).toBe(false);

    expect(result.data[0]).toHaveProperty('product_code');
    expect(result.data[1]).toHaveProperty('quantity');
    expect(result.data[2]).toHaveProperty('pick_location');
    expect(result.data[0].product_code).toBe('123456');
    expect(result.data[1].product_code).toBe('785412');
    expect(result.data[2].product_code).toBe('36925814');
  });

  it('should list empty data', async () => {
    const inMemoryLessonsRepository = new InMemoryProductRepository();
    const listData = new ListProductsUseCase(inMemoryLessonsRepository);

    const result = await listData.execute();

    expect(result.data).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.hasMore).toBe(false);
  });

  it('should paginate data correctly', async () => {
    const inMemoryLessonsRepository = new InMemoryProductRepository();
    const createProduct = new CreateProductUseCase(inMemoryLessonsRepository);

    // Create 5 items
    for (let i = 0; i < 5; i++) {
      await createProduct.execute({
        product_code: `CODE_${i}`,
        quantity: i + 1,
        pick_location: `A${i}`,
      });
    }

    const listData = new ListProductsUseCase(inMemoryLessonsRepository);

    // Test with limit
    const result1 = await listData.execute({ limit: 2 });
    expect(result1.data).toHaveLength(2);
    expect(result1.pagination.total).toBe(5);
    expect(result1.pagination.limit).toBe(2);
    expect(result1.pagination.offset).toBe(0);
    expect(result1.pagination.hasMore).toBe(true);

    // Test with offset
    const result2 = await listData.execute({ limit: 2, offset: 2 });
    expect(result2.data).toHaveLength(2);
    expect(result2.pagination.total).toBe(5);
    expect(result2.pagination.offset).toBe(2);
    expect(result2.pagination.hasMore).toBe(true);

    // Test last page
    const result3 = await listData.execute({ limit: 2, offset: 4 });
    expect(result3.data).toHaveLength(1);
    expect(result3.pagination.total).toBe(5);
    expect(result3.pagination.hasMore).toBe(false);
  });
});
