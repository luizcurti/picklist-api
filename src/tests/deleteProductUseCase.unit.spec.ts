import { CreateProductUseCase } from '@modules/products/useCases/createProduct/createProductUseCase';
import { DeleteProductUseCase } from '@modules/products/useCases/deleteProduct/deleteProductUseCase';
import { InMemoryProductRepository } from './InMemoryProductRepository';
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

    const deleteProduct = new DeleteProductUseCase(inMemoryLessonsRepository);

    await deleteProduct.execute({
      product_code: '123456',
    });

    // Verify the product was deleted by checking the repository is empty
    const listRepository = inMemoryLessonsRepository.items;
    expect(listRepository).toHaveLength(0);
  });

  it('should not remove a new data', async () => {
    const inMemoryLessonsRepository = new InMemoryProductRepository();
    const deleteProduct = new DeleteProductUseCase(inMemoryLessonsRepository);

    await expect(
      deleteProduct.execute({
        product_code: '123456',
      })
    ).rejects.toEqual(new AppError('Product not found', 404, 'Not Found'));
  });
});
