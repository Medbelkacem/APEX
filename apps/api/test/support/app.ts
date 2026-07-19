/**
 * Boots the real application for e2e tests.
 *
 * This mirrors `src/main.ts` deliberately rather than importing it: `main.ts`
 * calls `listen()` and owns the process lifecycle. Anything that changes the
 * request pipeline there — the global prefix, cookie parsing, the serializer
 * that strips `@Exclude()` fields, `rawBody` for Stripe signature
 * verification — has to be mirrored here, or the suite tests a pipeline that
 * does not exist in production.
 */
import { ClassSerializerInterceptor, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';

export interface TestApp {
  app: INestApplication;
  moduleRef: TestingModule;
  dataSource: DataSource;
  close: () => Promise<void>;
}

export interface TestAppOptions {
  /**
   * Rate limiting is disabled by default. The login limit is 10 requests per
   * minute, which the lockout tests alone would exhaust — and a test failing
   * with 429 instead of the status it asserted is a confusing failure. The
   * throttler gets its own dedicated spec, which passes `throttle: true`.
   */
  throttle?: boolean;
}

export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const builder = Test.createTestingModule({ imports: [AppModule] });

  if (!options.throttle) {
    // The guard cannot be swapped with `overrideGuard`: it is registered as
    // `{ provide: APP_GUARD, useClass: ThrottlerGuard }`, so the provider token
    // is APP_GUARD and an override keyed on the class silently matches nothing.
    // Replacing the storage it reads is the supported seam — every window
    // reports zero hits, so no request is ever rejected.
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
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.init();

  const dataSource = moduleRef.get(DataSource);

  return {
    app,
    moduleRef,
    dataSource,
    close: async () => {
      await app.close();
    },
  };
}
