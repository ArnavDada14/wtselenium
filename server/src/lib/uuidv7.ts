import { randomBytes } from 'crypto';

/**
 * UUIDv7 Generator
 *
 * Layout:
 *   [48 bits unix_ts_ms] [4 bits ver=0111] [12 bits rand_a]
 *   [2 bits variant=10]  [62 bits rand_b]
 *
 * Used exclusively for BookCopy IDs (barcodes).
 * Time-ordered: no server coordination required — scan terminals can
 * generate copy IDs independently without a server roundtrip.
 */
export function uuidv7(): string {
  const now = BigInt(Date.now());
  const randBytes = randomBytes(10);
  const randA = BigInt('0x' + randBytes.slice(0, 2).toString('hex'));
  const randB = BigInt('0x' + randBytes.slice(2, 10).toString('hex'));

  // Set version = 7 (0111)
  const versionedRandA = (randA & 0x0fffn) | 0x7000n;

  // Set variant = 10xx
  const variantedRandB = (randB & 0x3fffffffffffffffn) | 0x8000000000000000n;

  const hi = (now << 16n) | versionedRandA;
  const lo = variantedRandB;

  const pad = (n: bigint, digits: number) =>
    n.toString(16).padStart(digits, '0');

  const hex = pad(hi, 16) + pad(lo, 16);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
