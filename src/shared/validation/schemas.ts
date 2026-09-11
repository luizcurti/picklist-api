import * as Yup from 'yup';

export const productCodeSchema = Yup.string()
  .required('Product code is required')
  .min(1, 'Product code cannot be empty')
  .max(50, 'Product code too long')
  .matches(
    /^[a-zA-Z0-9_-]+$/,
    'Product code can only contain letters, numbers, hyphens and underscores'
  );

// Stock quantity: 0 is a valid, real state (out of stock) — reachable via
// quantity_delta (the repository guard is `quantity + delta >= 0`), so
// creating a product or absolute-setting it to 0 must be allowed too,
// not just decrementing down to it.
const quantityBaseSchema = Yup.number()
  .integer('Quantity must be an integer')
  .min(0, 'Quantity cannot be negative')
  .max(999999, 'Quantity too large');

export const quantitySchema = quantityBaseSchema.required(
  'Quantity is required'
);

// Pick quantity: unlike stock, 0 is never meaningful here — you can't pick
// zero units — so this stays strictly positive, separately from quantitySchema.
const pickQuantityBaseSchema = Yup.number()
  .integer('Quantity must be an integer')
  .positive('Quantity must be positive')
  .max(999999, 'Quantity too large');

export const pickQuantitySchema = pickQuantityBaseSchema.required(
  'Quantity is required'
);

export const quantityDeltaSchema = Yup.number()
  .integer('Quantity delta must be an integer')
  .notOneOf([0], 'Quantity delta cannot be zero')
  .min(-999999, 'Quantity delta too large')
  .max(999999, 'Quantity delta too large');

export const pickLocationSchema = Yup.string()
  .required('Pick location is required')
  .min(1, 'Pick location cannot be empty')
  .max(20, 'Pick location too long')
  .matches(
    /^[A-Z0-9 ]+$/i,
    'Pick location can only contain letters, numbers and spaces'
  );

export const createProductSchema = Yup.object({
  product_code: productCodeSchema,
  quantity: quantitySchema,
  pick_location: pickLocationSchema,
});

export const updateProductSchema = Yup.object({
  quantity: quantityBaseSchema.optional(),
  quantity_delta: quantityDeltaSchema.optional(),
  pick_location: pickLocationSchema,
}).test(
  'quantity-xor-quantity-delta',
  'Provide exactly one of quantity or quantity_delta',
  (value) =>
    (value.quantity !== undefined) !== (value.quantity_delta !== undefined)
);

export const productCodeParamSchema = Yup.object({
  product_code: productCodeSchema,
});

export const createPickSchema = Yup.object({
  product_code: productCodeSchema,
  quantity: pickQuantitySchema,
  pick_location: pickLocationSchema,
});

export const paginationQuerySchema = Yup.object({
  limit: Yup.number()
    .integer('Limit must be an integer')
    .positive('Limit must be positive')
    .max(1000, 'Limit cannot exceed 1000')
    .default(100)
    .optional(),
  offset: Yup.number()
    .integer('Offset must be an integer')
    .min(0, 'Offset cannot be negative')
    .default(0)
    .optional(),
});
