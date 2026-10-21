import { Router } from 'express';
import { handlingErrors } from '@shared/infra/http/middlewares/handlingErrors';
import { handlingNotFound } from '@shared/infra/http/middlewares/handlingNotFound';
import { apiKeyAuth } from '@shared/infra/http/middlewares/apiKeyAuth';

import { productRoutes } from './productRoute';
import { pickRoutes } from './pickRoute';

const routes = Router();

// Must run inside this router, not in app.ts — handlingErrors below needs
// to be in scope to catch a throw from apiKeyAuth.
routes.use(apiKeyAuth);
routes.use('/products', productRoutes);
routes.use('/picks', pickRoutes);
routes.use(handlingNotFound);
routes.use(handlingErrors);

export { routes };
