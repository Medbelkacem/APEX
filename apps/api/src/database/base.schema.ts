import { Prop } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import type { Connection, Schema } from 'mongoose';

/**
 * Foundations shared by every document schema.
 *
 * The stack moved from Postgres/TypeORM to MongoDB/Mongoose. Two decisions keep
 * that swap invisible to the rest of the platform (DTOs, the shared-types
 * package, the web client):
 *
 *  1. `_id` stays a UUID string rather than becoming an ObjectId, so every id
 *     the API has ever emitted keeps its shape and every stored foreign key is
 *     a plain string.
 *  2. Documents serialize with an `id` field (never `_id`/`__v`), matching what
 *     the old class-transformer pipeline produced.
 */

/**
 * Build the JSON/object transform. Always drops Mongo internals and the
 * soft-delete marker; `extraHidden` removes anything else that must never reach
 * a response (the equivalent of the old class-transformer `@Exclude()` list —
 * password hashes, reset tokens, and other internal auth state).
 */
function serializeTransform(extraHidden: readonly string[]) {
  return (_doc: unknown, ret: Record<string, unknown>): Record<string, unknown> => {
    delete ret._id;
    delete ret.__v;
    delete ret.deletedAt;
    for (const field of extraHidden) delete ret[field];
    return ret;
  };
}

/**
 * `@Schema()` options every collection uses: a fixed collection name, automatic
 * `createdAt`/`updatedAt`, and a JSON/object transform that exposes `id` and
 * hides internals. `virtuals: true` surfaces the `id` virtual and the
 * populate/`fullName` virtuals declared per schema.
 */
export const baseSchemaOptions = (collection: string, extraHidden: readonly string[] = []) => ({
  collection,
  timestamps: true,
  toJSON: { virtuals: true, versionKey: false, transform: serializeTransform(extraHidden) },
  toObject: { virtuals: true, versionKey: false, transform: serializeTransform(extraHidden) },
});

/** UUID primary key + created/updated timestamps shared by every schema. */
export class BaseDocument {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  // Provided at runtime by Mongoose (the `id` virtual and `timestamps`);
  // declared here only so services can read them with types.
  declare id: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

/** Base + a soft-delete marker for documents that must never be hard-deleted. */
export class SoftDeleteDocument extends BaseDocument {
  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

const SOFT_DELETE_HOOKS = [
  'count',
  'countDocuments',
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'updateOne',
  'updateMany',
] as const;

/**
 * Make a schema soft-delete aware. TypeORM silently excluded soft-deleted rows
 * from every read; this reproduces that by injecting `deletedAt: null` into any
 * find/count/update filter that does not already constrain `deletedAt`.
 *
 * Opt back in to deleted rows with `.setOptions({ withDeleted: true })` (the
 * equivalent of TypeORM's `.withDeleted()`). Aggregation pipelines are not
 * intercepted — add an explicit `{ $match: { deletedAt: null } }` there.
 */
/** The slice of a Mongoose query the soft-delete hook touches. */
interface SoftDeleteQueryContext {
  getOptions?: () => { withDeleted?: boolean };
  getFilter?: () => Record<string, unknown>;
  where: (condition: Record<string, unknown>) => unknown;
}

export function applySoftDelete(schema: Schema): void {
  for (const op of SOFT_DELETE_HOOKS) {
    schema.pre(op as never, function (this: SoftDeleteQueryContext, next: (err?: Error) => void) {
      if (!this.getOptions?.().withDeleted) {
        const filter = this.getFilter?.() ?? {};
        if (filter.deletedAt === undefined) this.where({ deletedAt: null });
      }
      next();
    });
  }
}

/**
 * Detect the "this deployment is not a replica set" error so single-node Mongo
 * (a bare `docker run mongo`) still works, just without cross-document atomicity.
 */
function transactionsUnsupported(err: unknown): boolean {
  const e = err as { code?: number; codeName?: string; message?: string };
  return (
    e?.code === 20 ||
    e?.code === 263 ||
    e?.codeName === 'IllegalOperation' ||
    /Transaction numbers are only allowed on a replica set/i.test(e?.message ?? '') ||
    /Transactions are not supported/i.test(e?.message ?? '')
  );
}

/**
 * Run `work` inside a MongoDB transaction when the server supports them
 * (a replica set — which both the docker stack and the in-memory test/dev
 * server are), falling back to a plain, session-less run otherwise so the app
 * still boots against a standalone mongod. `work` receives the session to pass
 * through to every write (`{ session }`); it is `undefined` on the fallback path.
 */
export async function runInTransaction<T>(
  connection: Connection,
  work: (session?: import('mongoose').ClientSession) => Promise<T>,
): Promise<T> {
  const session = await connection.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result!;
  } catch (err) {
    if (transactionsUnsupported(err)) return work(undefined);
    throw err;
  } finally {
    await session.endSession();
  }
}
