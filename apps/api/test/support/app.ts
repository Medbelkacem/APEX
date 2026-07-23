/**
 * Boots the real application for e2e tests.
 *
 * This mirrors `src/main.ts` deliberately rather than importing it: `main.ts`
 * calls `listen()` and owns the process lifecycle. Anything that changes the
 * request pipeline there — the global prefix, cookie parsing, `rawBody` for
 * Stripe signature verification — has to be mirrored here.
 *
 * `dataSource` is a thin adapter over the Mongoose connection that exposes the
 * small slice of the old TypeORM `Repository` API the specs use
 * (create/save/findOne(By)/find/update/delete/count), so the specs did not have
 * to be rewritten around Mongoose model calls. `id` in a filter maps to `_id`,
 * and normally-hidden secret fields are re-selected so assertions can read them.
 */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';

/** Secret/select:false paths re-selected so specs can assert on them. */
const HIDDEN =
  '+passwordHash +passwordResetTokenHash +passwordResetExpiresAt ' +
  '+emailVerificationTokenHash +emailVerificationExpiresAt +tokenHash';

type AnyDoc = Record<string, unknown>;

/** Map a TypeORM-style `where` (which may use `id`) onto a Mongo filter. */
function normalize(where: AnyDoc): AnyDoc {
  const out: AnyDoc = { ...where };
  if ('id' in out) {
    out._id = out.id;
    delete out.id;
  }
  return out;
}

function criteriaToFilter(criteria: string | AnyDoc): AnyDoc {
  return typeof criteria === 'string' ? { _id: criteria } : normalize(criteria);
}

function mapOrder(order: Record<string, 'ASC' | 'DESC' | 1 | -1>): Record<string, 1 | -1> {
  const out: Record<string, 1 | -1> = {};
  for (const [key, dir] of Object.entries(order)) {
    const field = key === 'id' ? '_id' : key;
    out[field] = dir === 'ASC' || dir === 1 ? 1 : -1;
  }
  return out;
}

type EntityClass<T> = { name: string; prototype: T };

/** A TypeORM-Repository-shaped wrapper around a Mongoose model. */
class RepoAdapter<T> {
  constructor(private readonly model: Model<AnyDoc>) {}

  create(obj: Partial<T> & AnyDoc): T {
    return new this.model(obj) as unknown as T;
  }

  save(doc: T): Promise<T> {
    if (doc && typeof (doc as { save?: unknown }).save === 'function') {
      return (doc as unknown as { save: () => Promise<T> }).save();
    }
    return this.model.create(doc as AnyDoc) as unknown as Promise<T>;
  }

  findOne(opts?: { where?: AnyDoc }): Promise<T | null> {
    return this.model.findOne(normalize(opts?.where ?? {})).select(HIDDEN).exec() as Promise<T | null>;
  }

  findOneBy(where: AnyDoc): Promise<T | null> {
    return this.model.findOne(normalize(where)).select(HIDDEN).exec() as Promise<T | null>;
  }

  async findOneByOrFail(where: AnyDoc): Promise<T> {
    const doc = await this.findOneBy(where);
    if (!doc) throw new Error(`No entity found matching ${JSON.stringify(where)}`);
    return doc;
  }

  find(opts?: { where?: AnyDoc; order?: Record<string, 'ASC' | 'DESC' | 1 | -1> }): Promise<T[]> {
    let q = this.model.find(normalize(opts?.where ?? {})).select(HIDDEN);
    if (opts?.order) q = q.sort(mapOrder(opts.order));
    return q.exec() as unknown as Promise<T[]>;
  }

  update(criteria: string | AnyDoc, patch: AnyDoc): Promise<unknown> {
    return this.model.updateOne(criteriaToFilter(criteria), patch).exec();
  }

  delete(criteria: string | AnyDoc): Promise<unknown> {
    return this.model.deleteMany(criteriaToFilter(criteria)).exec();
  }

  count(where?: AnyDoc): Promise<number> {
    return this.model.countDocuments(normalize(where ?? {})).exec();
  }
}

export interface TestRepositories {
  getRepository<T>(entity: EntityClass<T>): RepoAdapter<T>;
}

export interface TestApp {
  app: INestApplication;
  moduleRef: TestingModule;
  connection: Connection;
  dataSource: TestRepositories;
  close: () => Promise<void>;
}

export interface TestAppOptions {
  /**
   * Rate limiting is disabled by default. The login limit alone would be
   * exhausted by the lockout tests, and a test failing with 429 is a confusing
   * failure. The throttler gets its own spec, which passes `throttle: true`.
   */
  throttle?: boolean;
}

export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const builder = Test.createTestingModule({ imports: [AppModule] });

  if (!options.throttle) {
    builder.overrideProvider(ThrottlerStorage).useValue({
      increment: async () => ({
        totalHits: 0,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      }),
    });
  }

  const moduleRef = await builder.compile();

  // rawBody is what makes Stripe webhook signature verification possible.
  const app = moduleRef.createNestApplication({ rawBody: true });
  app.setGlobalPrefix('api');
  app.use(cookieParser());

  await app.init();

  const connection = moduleRef.get<Connection>(getConnectionToken());
  // Ensure every unique index is built before the first test inserts, so the
  // duplicate-key races the specs exercise actually reject.
  await Promise.all(Object.values(connection.models).map((m) => m.init()));

  const dataSource: TestRepositories = {
    getRepository: <T>(entity: EntityClass<T>) =>
      new RepoAdapter<T>(connection.model(entity.name) as Model<AnyDoc>),
  };

  return {
    app,
    moduleRef,
    connection,
    dataSource,
    close: async () => {
      await app.close();
    },
  };
}
