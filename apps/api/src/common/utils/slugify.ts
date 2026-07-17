/** Convert an arbitrary label into a URL/DB-safe slug. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Zero-pad a sequence number, e.g. formatSequence('CASE', 2026, 1) → CASE-2026-0001. */
export function formatSequence(prefix: string, year: number, seq: number, width = 4): string {
  return `${prefix}-${year}-${String(seq).padStart(width, '0')}`;
}
