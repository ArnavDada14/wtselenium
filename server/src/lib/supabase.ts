import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

/**
 * Supabase admin client using the service role key.
 * Used exclusively for storage operations (book covers, label PDFs).
 * Database access is always via Prisma.
 */
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const COVERS_BUCKET = 'book-covers';

export async function uploadBookCover(
  bookId: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const path = `${bookId}.${ext}`;

  const { error } = await supabase.storage
    .from(COVERS_BUCKET)
    .upload(path, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw new Error(`Cover upload failed: ${error.message}`);

  const { data } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteBookCover(bookId: string): Promise<void> {
  await supabase.storage.from(COVERS_BUCKET).remove([`${bookId}.jpg`, `${bookId}.png`]);
}
