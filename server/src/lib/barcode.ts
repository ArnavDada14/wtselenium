import bwipjs from 'bwip-js';
import { uuidv7 } from './uuidv7';

const LIBRARY_PREFIX = process.env.LIBRARY_PREFIX ?? 'LIB';

/**
 * Generates a new BookCopy ID (UUIDv7) and its corresponding barcode string.
 * The barcode is Code 128 compatible: prefix + stripped UUID hex.
 */
export function generateCopyBarcode(): { copyId: string; barcode: string } {
  const copyId = uuidv7();
  const barcode = `${LIBRARY_PREFIX}-${copyId.replace(/-/g, '').toUpperCase()}`;
  return { copyId, barcode };
}

/**
 * Renders a barcode as a PNG buffer using Code 128 symbology.
 * The buffer can be returned directly as image/png from an API route
 * or embedded into a PDF label sheet.
 */
export async function renderBarcodePNG(barcode: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: barcode,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: 'center',
    textsize: 10,
  });
}
