import { Router } from 'express';
import { validateBody } from '@shared/infra/http/middlewares/validation';
import { createPickSchema } from '@shared/validation/schemas';
import { CreatePickController } from '@modules/picks/useCases/createPick/createPickController';

const pickRoutes = Router();

const createPickController = new CreatePickController();

pickRoutes.post(
  '/',
  validateBody(createPickSchema),
  createPickController.handle
);

export { pickRoutes };
