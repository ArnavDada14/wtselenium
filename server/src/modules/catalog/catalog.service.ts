import { prisma } from '../../db';
import { snowflake } from '../../lib/snowflake';
import { generateCopyBarcode } from '../../lib/barcode';
import { cacheGet, cacheSet, cacheDeleteByPrefix } from '../../lib/cache';
import { AppError } from '../../lib/errors';
import type {
  CreateBookSchema,
  UpdateBookSchema,
  CatalogSearchSchema,
  CreateCopySchema,
  UpdateCopySchema,
  CreateCategorySchema,
} from './catalog.schema';
import type { z } from 'zod';

export interface BulkImportRow {
  isbn: string;
  title: string;
  subtitle?: string;
  authors: string[];        // pre-split array
  publisher: string;
  publishedYear: number;
  edition?: string;
  language: string;
  pages?: number;
  categoryId: string;       // resolved on client from categoryName
  description?: string;
  tags: string[];           // pre-split array
  copies: number;           // number of physical copies to add
  location?: string;
}

type CreateBookInput = z.infer<typeof CreateBookSchema>;
type UpdateBookInput = z.infer<typeof UpdateBookSchema>;
type CatalogSearchInput = z.infer<typeof CatalogSearchSchema>;
type CreateCopyInput = z.infer<typeof CreateCopySchema>;
type UpdateCopyInput = z.infer<typeof UpdateCopySchema>;
type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

// ─── Books ───────────────────────────────────────────────────────────────────

export async function searchCatalog(input: CatalogSearchInput) {
  const cacheKey = `catalog:search:${JSON.stringify(input)}`;
  const cached = cacheGet<object>(cacheKey);
  if (cached) return cached;

  const { q, categoryId, language, available, page, limit } = input;
  const offset = (page - 1) * limit;

  const where: any = {};

  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { authors: { has: q } },
      { isbn: { contains: q } },
      { tags: { has: q } },
      { publisher: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (categoryId) where.categoryId = categoryId;
  if (language) where.language = language;
  if (available) where.copies = { some: { status: 'AVAILABLE' } };

  const [books, total] = await prisma.$transaction([
    prisma.book.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, maxIssueDays: true } },
        _count: { select: { copies: true } },
        copies: {
          where: { status: 'AVAILABLE' },
          select: { id: true },
        },
      },
      skip: offset,
      take: limit,
      orderBy: { title: 'asc' },
    }),
    prisma.book.count({ where }),
  ]);

  const result = {
    data: books.map((b) => ({
      id: b.id,
      isbn: b.isbn,
      title: b.title,
      subtitle: b.subtitle,
      authors: b.authors,
      publisher: b.publisher,
      publishedYear: b.publishedYear,
      edition: b.edition,
      language: b.language,
      category: b.category,
      coverUrl: b.coverUrl,
      tags: b.tags,
      totalCopies: b._count.copies,
      availableCopies: b.copies.length,
    })),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };

  cacheSet(cacheKey, result, 1000 * 60 * 5);
  return result;
}

export async function getBook(id: string) {
  const cacheKey = `catalog:book:${id}`;
  const cached = cacheGet<object>(cacheKey);
  if (cached) return cached;

  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      category: { include: { finePolicy: true } },
      copies: {
        orderBy: { acquiredAt: 'asc' },
        select: {
          id: true,
          barcode: true,
          condition: true,
          location: true,
          status: true,
          acquiredAt: true,
        },
      },
    },
  });

  if (!book) throw new AppError('NOT_FOUND', 'Book not found', 404);

  cacheSet(cacheKey, book, 1000 * 60 * 5);
  return book;
}

export async function createBook(input: CreateBookInput) {
  const existing = await prisma.book.findUnique({ where: { isbn: input.isbn } });
  if (existing) throw new AppError('CONFLICT', `A book with ISBN ${input.isbn} already exists`, 409);

  const category = await prisma.bookCategory.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new AppError('NOT_FOUND', 'Category not found', 404);

  const book = await prisma.book.create({
    data: { id: snowflake.nextId(), ...input },
  });

  cacheDeleteByPrefix('catalog:search:');
  return book;
}

export async function updateBook(id: string, input: UpdateBookInput) {
  const book = await prisma.book.findUnique({ where: { id } });
  if (!book) throw new AppError('NOT_FOUND', 'Book not found', 404);

  const updated = await prisma.book.update({ where: { id }, data: input });

  cacheDeleteByPrefix('catalog:search:');
  cacheDeleteByPrefix(`catalog:book:${id}`);
  return updated;
}

// ─── Copies ──────────────────────────────────────────────────────────────────

export async function addCopies(bookId: string, input: CreateCopyInput) {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) throw new AppError('NOT_FOUND', 'Book not found', 404);

  const copies = [];
  for (let i = 0; i < input.count; i++) {
    const { copyId, barcode } = generateCopyBarcode();
    copies.push({
      id: copyId,
      barcode,
      bookId,
      condition: input.condition,
      location: input.location,
      notes: input.notes,
    });
  }

  await prisma.bookCopy.createMany({ data: copies });

  cacheDeleteByPrefix(`catalog:book:${bookId}`);
  cacheDeleteByPrefix('catalog:search:');

  return copies.map((c) => ({ id: c.id, barcode: c.barcode, location: c.location }));
}

export async function updateCopy(copyId: string, input: UpdateCopyInput) {
  const copy = await prisma.bookCopy.findUnique({ where: { id: copyId } });
  if (!copy) throw new AppError('NOT_FOUND', 'Copy not found', 404);

  if (input.status && copy.status === 'ISSUED') {
    throw new AppError('INVALID_STATE', 'Cannot change status of an issued copy', 409);
  }

  const updated = await prisma.bookCopy.update({ where: { id: copyId }, data: input });
  cacheDeleteByPrefix(`catalog:book:${copy.bookId}`);
  return updated;
}

export async function getCopyByBarcode(barcode: string) {
  const copy = await prisma.bookCopy.findUnique({
    where: { barcode },
    include: { book: { include: { category: { include: { finePolicy: true } } } } },
  });
  if (!copy) throw new AppError('NOT_FOUND', `No copy found for barcode: ${barcode}`, 404);
  return copy;
}

// ─── Categories ──────────────────────────────────────────────────────────────

export async function listCategories() {
  const cacheKey = 'catalog:categories';
  const cached = cacheGet<object[]>(cacheKey);
  if (cached) return cached;

  const categories = await prisma.bookCategory.findMany({
    include: { finePolicy: true, _count: { select: { books: true } } },
    orderBy: { name: 'asc' },
  });

  cacheSet(cacheKey, categories, 1000 * 60 * 30);
  return categories;
}

export async function createCategory(input: CreateCategoryInput) {
  const existing = await prisma.bookCategory.findUnique({ where: { name: input.name } });
  if (existing) throw new AppError('CONFLICT', `Category "${input.name}" already exists`, 409);

  const category = await prisma.bookCategory.create({ data: input });
  cacheDeleteByPrefix('catalog:categories');
  return category;
}

export async function updateCategory(id: string, input: Partial<CreateCategoryInput>) {
  const existing = await prisma.bookCategory.findUnique({ where: { id } });
  if (!existing) throw new AppError('NOT_FOUND', 'Category not found', 404);

  if (input.name && input.name !== existing.name) {
    const nameTaken = await prisma.bookCategory.findUnique({ where: { name: input.name } });
    if (nameTaken) throw new AppError('CONFLICT', `Category "${input.name}" already exists`, 409);
  }

  const category = await prisma.bookCategory.update({ where: { id }, data: input });
  cacheDeleteByPrefix('catalog:categories');
  cacheDeleteByPrefix('catalog:search:');
  return category;
}

export async function deleteCategory(id: string) {
  const existing = await prisma.bookCategory.findUnique({
    where: { id },
    include: { _count: { select: { books: true } } },
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Category not found', 404);
  if (existing._count.books > 0) {
    throw new AppError(
      'CONFLICT',
      `Cannot delete — ${existing._count.books} book(s) are assigned to this category`,
      409
    );
  }

  await prisma.bookCategory.delete({ where: { id } });
  cacheDeleteByPrefix('catalog:categories');
  return { deleted: true };
}

// ─── Fine Policies ───────────────────────────────────────────────────────────

export async function listFinePolicies() {
  return prisma.finePolicy.findMany({ orderBy: { name: 'asc' } });
}

export async function createFinePolicy(data: {
  name: string;
  ratePerDay: number;
  gracePeriodDays: number;
  maxFineAmount?: number;
}) {
  return prisma.finePolicy.create({ data });
}

// ─── Bulk Import ─────────────────────────────────────────────────────────────

export interface BulkImportResult {
  index: number;
  isbn: string;
  title: string;
  success: boolean;
  error?: string;
}

export async function bulkImportBooks(
  rows: BulkImportRow[]
): Promise<{ imported: number; failed: number; results: BulkImportResult[] }> {
  const results: BulkImportResult[] = [];
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Validate category exists
      const category = await prisma.bookCategory.findUnique({ where: { id: row.categoryId } });
      if (!category) throw new Error(`Category not found`);

      // Check duplicate ISBN
      const existing = await prisma.book.findUnique({ where: { isbn: row.isbn } });
      if (existing) throw new Error(`ISBN ${row.isbn} already exists in catalog`);

      // Create book
      const book = await prisma.book.create({
        data: {
          id: snowflake.nextId(),
          isbn: row.isbn,
          title: row.title,
          subtitle: row.subtitle,
          authors: row.authors,
          publisher: row.publisher,
          publishedYear: row.publishedYear,
          edition: row.edition,
          language: row.language ?? 'en',
          pages: row.pages,
          categoryId: row.categoryId,
          description: row.description,
          tags: row.tags ?? [],
        },
      });

      // Add physical copies
      const copyCount = Math.max(1, row.copies ?? 1);
      const copies = [];
      for (let c = 0; c < copyCount; c++) {
        const { copyId, barcode } = generateCopyBarcode();
        copies.push({ id: copyId, barcode, bookId: book.id, condition: 'NEW' as const, location: row.location });
      }
      await prisma.bookCopy.createMany({ data: copies });

      results.push({ index: i, isbn: row.isbn, title: row.title, success: true });
      imported++;
    } catch (err: any) {
      results.push({
        index: i,
        isbn: row.isbn ?? '',
        title: row.title ?? '',
        success: false,
        error: err?.message ?? 'Unknown error',
      });
      failed++;
    }
  }

  // Bust catalog caches after bulk operation
  cacheDeleteByPrefix('catalog:search:');
  cacheDeleteByPrefix('catalog:categories');

  return { imported, failed, results };
}
