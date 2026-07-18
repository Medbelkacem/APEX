import { EntityManager } from 'typeorm';
import { formatSequence } from './slugify';

/**
 * Allocate the next sequential, year-scoped reference for a table —
 * e.g. `CASE-2026-0001`, `INV-2026-0007`.
 *
 * Concurrency: a transaction-scoped Postgres advisory lock keyed on
 * `prefix:year` serializes concurrent allocations, so two simultaneous
 * submissions can never derive the same number from `MAX(...)`. The lock is
 * released automatically when the surrounding transaction commits or rolls
 * back, so callers must run this inside a transaction.
 */
export async function allocateReference(
  manager: EntityManager,
  options: { table: string; column: string; prefix: string; year?: number },
): Promise<string> {
  const year = options.year ?? new Date().getFullYear();
  const lockKey = `${options.prefix}:${year}`;

  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);

  const pattern = `${options.prefix}-${year}-%`;
  // Read the highest suffix issued this year, ignoring soft-deleted rows so a
  // deletion can never cause a number to be reused.
  const rows: Array<{ max: string | null }> = await manager.query(
    `SELECT MAX(CAST(SUBSTRING("${options.column}" FROM '[0-9]+$') AS INTEGER))::text AS max
       FROM "${options.table}"
      WHERE "${options.column}" LIKE $1`,
    [pattern],
  );

  const next = Number(rows[0]?.max ?? 0) + 1;
  return formatSequence(options.prefix, year, next);
}
