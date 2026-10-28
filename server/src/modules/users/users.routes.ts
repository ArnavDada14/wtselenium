import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as ctrl from './users.controller';

const router = Router();
router.use(authenticate);

router.get('/dashboard/stats', requireRole('LIBRARIAN'), ctrl.getDashboardStats);
router.get('/audit', requireRole('SYSTEM_ADMIN'), ctrl.getAuditLog);
router.get('/', requireRole('LIBRARIAN'), ctrl.listUsers);
router.post('/', requireRole('SYSTEM_ADMIN'), ctrl.createUser);
router.get('/:id', requireRole('LIBRARIAN'), ctrl.getUser);
router.patch('/:id', requireRole('LIBRARIAN'), ctrl.updateUser);  // Librarians can toggle active
router.get('/:id/history', ctrl.getUserHistory);

export default router;
