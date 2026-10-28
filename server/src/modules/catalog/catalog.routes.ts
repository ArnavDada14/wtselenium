import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate, validateQuery } from '../../middleware/validate';
import {
  CreateBookSchema,
  UpdateBookSchema,
  CatalogSearchSchema,
  CreateCopySchema,
  UpdateCopySchema,
  CreateCategorySchema,
  UpdateCategorySchema,
} from './catalog.schema';
import * as ctrl from './catalog.controller';

const router = Router();

// Books (public read, librarian write)
router.get('/books', validateQuery(CatalogSearchSchema), ctrl.searchBooks);
router.get('/books/:id', authenticate, ctrl.getBook);
router.post('/books/bulk-import', authenticate, requireRole('LIBRARIAN'), ctrl.bulkImportBooks);
router.post('/books', authenticate, requireRole('LIBRARIAN'), validate(CreateBookSchema), ctrl.createBook);
router.patch('/books/:id', authenticate, requireRole('LIBRARIAN'), validate(UpdateBookSchema), ctrl.updateBook);

// Copies
router.post('/books/:id/copies', authenticate, requireRole('LIBRARIAN'), validate(CreateCopySchema), ctrl.addCopies);
router.patch('/copies/:copyId', authenticate, requireRole('LIBRARIAN'), validate(UpdateCopySchema), ctrl.updateCopy);
router.get('/copies/barcode/:barcode', authenticate, ctrl.getCopyBarcode);
router.get('/copies/barcode/:barcode/image', ctrl.getCopyBarcodeImage);

// Categories
router.get('/categories', ctrl.listCategories);
router.post('/categories', authenticate, requireRole('LIBRARIAN'), validate(CreateCategorySchema), ctrl.createCategory);
router.patch('/categories/:id', authenticate, requireRole('LIBRARIAN'), validate(UpdateCategorySchema), ctrl.updateCategory);
router.delete('/categories/:id', authenticate, requireRole('LIBRARIAN'), ctrl.deleteCategory);

// Fine Policies
router.get('/fine-policies', authenticate, requireRole('LIBRARIAN'), ctrl.listFinePolicies);
router.post('/fine-policies', authenticate, requireRole('SYSTEM_ADMIN'), ctrl.createFinePolicy);

export default router;
