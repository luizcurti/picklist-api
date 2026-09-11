import { Router } from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '@shared/infra/http/middlewares/validation';
import {
  createProductSchema,
  updateProductSchema,
  productCodeParamSchema,
  paginationQuerySchema,
} from '@shared/validation/schemas';

import { CreateProductController } from '@modules/products/useCases/createProduct/createProductController';
import { DeleteProductController } from '@modules/products/useCases/deleteProduct/deleteProductController';
import { UpdateProductController } from '@modules/products/useCases/updateProduct/updateProductController';
import { ListProductsController } from '@modules/products/useCases/listProducts/listProductsController';
import { FindProductController } from '@modules/products/useCases/findProduct/findProductController';

const productRoutes = Router();

const listProductsController = new ListProductsController();
const findProductController = new FindProductController();
const createProductController = new CreateProductController();
const updateProductController = new UpdateProductController();
const deleteProductController = new DeleteProductController();

productRoutes.get(
  '/',
  validateQuery(paginationQuerySchema),
  listProductsController.handle
);

productRoutes.get(
  '/:product_code',
  validateParams(productCodeParamSchema),
  findProductController.handle
);

productRoutes.post(
  '/',
  validateBody(createProductSchema),
  createProductController.handle
);

productRoutes.put(
  '/:product_code',
  validateParams(productCodeParamSchema),
  validateBody(updateProductSchema),
  updateProductController.handle
);

productRoutes.delete(
  '/:product_code',
  validateParams(productCodeParamSchema),
  deleteProductController.handle
);

export { productRoutes };
