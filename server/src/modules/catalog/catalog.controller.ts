import { Request, Response, NextFunction } from 'express';
import * as svc from './catalog.service';
import { renderBarcodePNG } from '../../lib/barcode';
import { routeParam } from '../../lib/routeParam';
import { z } from 'zod';

const BulkImportSchema = z.object({
  rows: z.array(z.object({
    isbn: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    authors: z.array(z.string()).min(1),
    publisher: z.string().min(1),
    publishedYear: z.number().int(),
    edition: z.string().optional(),
    language: z.string().default('en'),
    pages: z.number().int().positive().optional(),
    categoryId: z.string().min(1),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    copies: z.number().int().min(1).default(1),
    location: z.string().optional(),
  })).min(1).max(200),
});

export async function searchBooks(req: Request, res: Response, next: NextFunction) {
  try {
    // validateQuery stores Zod-parsed values on res.locals.query (Express 5: req.query is read-only)
    const query = res.locals.query ?? req.query;
    const result = await svc.searchCatalog(query as any);
    res.json(result);
  } catch (err) { next(err); }
}

export async function getBook(req: Request, res: Response, next: NextFunction) {
  try {
    const book = await svc.getBook(routeParam(req, 'id'));
    res.json(book);
  } catch (err) { next(err); }
}

export async function createBook(req: Request, res: Response, next: NextFunction) {
  try {
    const book = await svc.createBook(req.body);
    res.status(201).json(book);
  } catch (err) { next(err); }
}

export async function updateBook(req: Request, res: Response, next: NextFunction) {
  try {
    const book = await svc.updateBook(routeParam(req, 'id'), req.body);
    res.json(book);
  } catch (err) { next(err); }
}

export async function addCopies(req: Request, res: Response, next: NextFunction) {
  try {
    const copies = await svc.addCopies(routeParam(req, 'id'), req.body);
    res.status(201).json(copies);
  } catch (err) { next(err); }
}

export async function updateCopy(req: Request, res: Response, next: NextFunction) {
  try {
    const copy = await svc.updateCopy(routeParam(req, 'copyId'), req.body);
    res.json(copy);
  } catch (err) { next(err); }
}

export async function getCopyBarcode(req: Request, res: Response, next: NextFunction) {
  try {
    const copy = await svc.getCopyByBarcode(routeParam(req, 'barcode'));
    res.json(copy);
  } catch (err) { next(err); }
}

export async function getCopyBarcodeImage(req: Request, res: Response, next: NextFunction) {
  try {
    const copy = await svc.getCopyByBarcode(routeParam(req, 'barcode'));
    const png = await renderBarcodePNG(copy.barcode);
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (err) { next(err); }
}

export async function listCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.listCategories());
  } catch (err) { next(err); }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const cat = await svc.createCategory(req.body);
    res.status(201).json(cat);
  } catch (err) { next(err); }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const cat = await svc.updateCategory(routeParam(req, 'id'), req.body);
    res.json(cat);
  } catch (err) { next(err); }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.deleteCategory(routeParam(req, 'id'));
    res.json(result);
  } catch (err) { next(err); }
}

export async function listFinePolicies(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.listFinePolicies());
  } catch (err) { next(err); }
}

export async function createFinePolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const policy = await svc.createFinePolicy(req.body);
    res.status(201).json(policy);
  } catch (err) { next(err); }
}

export async function bulkImportBooks(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = BulkImportSchema.parse(req.body);
    const result = await svc.bulkImportBooks(rows);
    res.status(207).json(result); // 207 Multi-Status
  } catch (err) { next(err); }
}
