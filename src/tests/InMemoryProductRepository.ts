import {
  IProduct,
  IProductRepository,
} from '@modules/products/repositories/iProductRepository';
import { AppError } from '@errors/appError';
import {
  InvalidQuantityDeltaError,
  ProductNotFoundError,
} from '@modules/products/errors/productErrors';

export class InMemoryProductRepository implements IProductRepository {
  public items: IProduct[] = [];

  async create(data: IProduct): Promise<IProduct> {
    const exists = this.items.find(
      (item) => item.product_code === data.product_code
    );
    if (exists) {
      throw new AppError('Product already exists', 409, 'Conflict');
    }

    this.items.push({
      product_code: data.product_code,
      quantity: data.quantity,
      pick_location: data.pick_location,
    });

    return data;
  }

  async findByID(product_code: string) {
    const item = this.items.find((item) => item.product_code === product_code);
    if (!item) {
      throw new AppError('Product not found', 404, 'Not Found');
    }
    return item;
  }

  async findAll(options?: { limit?: number; offset?: number }) {
    const total = this.items.length;
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const paginatedData = this.items.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      data: paginatedData,
      pagination: {
        total,
        limit,
        offset,
        hasMore,
      },
    };
  }

  async update(data: IProduct) {
    const dataUpdate = this.items.find(
      (item) => item.product_code === data.product_code
    );
    if (!dataUpdate) {
      throw new AppError('Product not found', 404, 'Not Found');
    }
    Object.assign(dataUpdate, data);

    return data;
  }

  async applyQuantityDelta(
    product_code: string,
    delta: number,
    pick_location?: string
  ) {
    const item = this.items.find((item) => item.product_code === product_code);
    if (!item) {
      throw new ProductNotFoundError(product_code);
    }
    if (item.quantity + delta < 0) {
      throw new InvalidQuantityDeltaError(product_code, item.quantity, delta);
    }
    item.quantity += delta;
    if (pick_location !== undefined) {
      item.pick_location = pick_location;
    }
    return item;
  }

  async remove(product_code: string) {
    const dataUpdate = this.items.find(
      (item) => item.product_code === product_code
    );
    if (!dataUpdate) {
      throw new AppError('Product not found', 404, 'Not Found');
    }
    this.items.splice(this.items.indexOf(dataUpdate), 1);
  }
}
