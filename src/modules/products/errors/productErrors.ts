import { AppError } from '@errors/appError';

// Typed errors so callers can discriminate with `instanceof`, not by parsing AppError's message.
class ProductNotFoundError extends AppError {
  constructor(productCode: string) {
    super(`Product with code '${productCode}' not found`, 404, 'Not Found');
    this.name = 'ProductNotFoundError';
  }
}

class DuplicateProductError extends AppError {
  constructor(productCode: string) {
    super(`Product with code '${productCode}' already exists`, 409, 'Conflict');
    this.name = 'DuplicateProductError';
  }
}

class InvalidQuantityDeltaError extends AppError {
  constructor(productCode: string, currentQuantity: number, delta: number) {
    super(
      `Applying delta ${delta} to product '${productCode}' (current quantity: ${currentQuantity}) would result in negative stock`,
      409,
      'Conflict'
    );
    this.name = 'InvalidQuantityDeltaError';
  }
}

export {
  ProductNotFoundError,
  DuplicateProductError,
  InvalidQuantityDeltaError,
};
