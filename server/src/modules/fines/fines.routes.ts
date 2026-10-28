import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as ctrl from './fines.controller';

const router = Router();
router.use(authenticate);

router.get('/', requireRole('LIBRARIAN'), ctrl.listFines);
router.get('/me', ctrl.getMyFines);
router.get('/me/summary', ctrl.getMyFinesSummary);
router.get('/:id', requireRole('LIBRARIAN'), ctrl.getFine);
router.post('/:id/pay', requireRole('LIBRARIAN'), ctrl.recordPayment);
router.post('/:id/waive', requireRole('LIBRARIAN'), ctrl.waiveFine);

export default router;
