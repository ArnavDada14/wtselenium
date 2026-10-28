import { z } from 'zod';

export const CreateBookSchema = z.object({
  isbn: z.string().min(10).max(17),
  title: z.string().min(1).max(500),
  subtitle: z.string().optional(),
  authors: z.array(z.string()).min(1),
  publisher: z.string().min(1),
  publishedYear: z.number().int().min(1800).max(new Date().getFullYear() + 1),
  edition: z.string().optional(),
  language: z.string().default('en'),
  pages: z.number().int().positive().optional(),
  categoryId: z.string().uuid(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const UpdateBookSchema = CreateBookSchema.partial().omit({ isbn: true });

export const CatalogSearchSchema = z.object({
  q: z.string().optional(),
  categoryId: z.string().optional(),
  language: z.string().optional(),
  available: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const CreateCopySchema = z.object({
  condition: z.enum(['NEW', 'GOOD', 'WORN', 'DAMAGED']).default('GOOD'),
  location: z.string().optional(),
  notes: z.string().optional(),
  count: z.number().int().min(1).max(50).default(1),
});

export const UpdateCopySchema = z.object({
  condition: z.enum(['NEW', 'GOOD', 'WORN', 'DAMAGED']).optional(),
  location: z.string().optional(),
  status: z.enum(['AVAILABLE', 'MAINTENANCE', 'RETIRED']).optional(),
  notes: z.string().optional(),
});

export const CreateCategorySchema = z.object({
  name: z.string().min(1),
  maxIssueDays: z.number().int().min(1).default(14),
  maxRenewals: z.number().int().min(0).default(2),
  finePolicyId: z.string().uuid().optional(),
});

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  maxIssueDays: z.number().int().min(1).optional(),
  maxRenewals: z.number().int().min(0).optional(),
  finePolicyId: z.string().uuid().nullable().optional(),
});
