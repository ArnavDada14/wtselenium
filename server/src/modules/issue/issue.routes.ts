import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as ctrl from './issue.controller';

const router = Router();

router.use(authenticate);

// Issue & Return (Librarian only)
router.post('/', requireRole('LIBRARIAN'), ctrl.issueBook);
router.post('/:id/return', requireRole('LIBRARIAN'), ctrl.returnBook);
router.post('/:id/renew', ctrl.renewIssue); // Both student and librarian can renew

// Issue list & detail
router.get('/', requireRole('LIBRARIAN'), ctrl.listIssues);
router.get('/me', ctrl.getMyIssues); // Student's own issues
router.get('/:id', ctrl.getIssue);

// Reservations
router.post('/reservations', ctrl.createReservation);
router.delete('/reservations/:id', ctrl.cancelReservation);

export default router;
