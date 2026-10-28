import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { LoginSchema } from './auth.service';
import * as ctrl from './auth.controller';

const router = Router();

router.post('/login', validate(LoginSchema), ctrl.loginHandler);
router.post('/refresh', ctrl.refreshHandler);
router.get('/me', authenticate, ctrl.meHandler);
router.post('/bootstrap', ctrl.bootstrapHandler);

export default router;
