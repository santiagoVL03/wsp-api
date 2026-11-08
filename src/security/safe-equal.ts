import { timingSafeEqual } from 'node:crypto';

/**
 * Compara dos secretos sin filtrar por tiempo cuántos bytes coinciden.
 * `timingSafeEqual` exige buffers del mismo tamaño, de ahí la comprobación.
 */
export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  return a.length === b.length && timingSafeEqual(a, b);
}
