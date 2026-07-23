import { ClientSession, Model } from 'mongoose';
import { Counter } from '../../database/entities';
import { formatSequence } from './slugify';

/**
 * Allocate the next sequential, year-scoped reference for a prefix —
 * e.g. `CASE-2026-0001`, `INV-2026-0007`.
 *
 * Concurrency: a single `findByIdAndUpdate` with `$inc` on the counter document
 * keyed `<prefix>:<year>` is atomic, so two simultaneous submissions can never
 * derive the same number. When a `session` is supplied the increment joins the
 * surrounding transaction and rolls back with it; otherwise it stands alone,
 * which at worst skips a number (gaps were already possible under soft delete).
 */
export async function allocateReference(
  counters: Model<Counter>,
  options: { prefix: string; year?: number },
  session?: ClientSession,
): Promise<string> {
  const year = options.year ?? new Date().getFullYear();
  const key = `${options.prefix}:${year}`;

  const counter = await counters.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );

  return formatSequence(options.prefix, year, counter!.seq);
}
