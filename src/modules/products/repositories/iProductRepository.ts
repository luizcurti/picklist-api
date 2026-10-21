export interface IProduct {
  product_code: string;
  quantity: number;
  pick_location: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface IProductRepository {
  create(data: IProduct): Promise<IProduct>;
  findByID(product_code: string): Promise<IProduct>;
  findAll(options?: PaginationOptions): Promise<PaginatedResult<IProduct>>;
  // Absolute set — last-write-wins is intentional here, not a race.
  update(data: IProduct): Promise<IProduct>;
  // Atomic relative adjustment (`quantity = quantity + delta` in one
  // statement, not findByID-then-update) — see docs/SYSTEM_FLOW.md §3.
  applyQuantityDelta(
    product_code: string,
    delta: number,
    pick_location?: string
  ): Promise<IProduct>;
  remove(product_code: string): Promise<void>;
}
