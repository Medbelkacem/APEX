import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Atomic sequence counter, keyed on `<prefix>:<year>` (e.g. `CASE:2026`).
 *
 * Replaces the Postgres `pg_advisory_xact_lock` + `MAX(...)` scheme that
 * produced case/invoice reference numbers. A single `findByIdAndUpdate` with
 * `$inc` is atomic on the counter document, so concurrent allocations can never
 * derive the same number — no advisory lock required.
 */
@Schema({ collection: 'counters', versionKey: false })
export class Counter {
  /** The sequence key, e.g. `INV:2026`. */
  @Prop({ type: String })
  _id: string;

  @Prop({ type: Number, default: 0 })
  seq: number;
}

export type CounterDocument = HydratedDocument<Counter>;
export const CounterSchema = SchemaFactory.createForClass(Counter);
