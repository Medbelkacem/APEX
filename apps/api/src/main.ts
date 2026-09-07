import './load-env';
import 'reflect-metadata';
import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { patchNestJsSwagger } from 'nestjs-zod';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';

async function bootstrap(): Promise<void> {
  // rawBody enables Stripe webhook signature verification later.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));
  app.flushLogs();

  const config = app.get(ConfigService);
  const appCfg = config.get<AppConfig>('app')!;

  app.setGlobalPrefix('api');

  // Behind a reverse proxy the socket peer is the proxy; `req.ip` (rate
  // limiting, the audit trail) only names the real client once Express is told
  // how many hops to look through. Left off unless configured, because trusting
  // X-Forwarded-For from anyone lets a caller pick their own address.
  if (appCfg.trustProxy !== false) {
    app.getHttpAdapter().getInstance().set('trust proxy', appCfg.trustProxy);
  }

  // The Swagger UI maps every route for whoever can reach it. Always on for
  // development; in production only when explicitly enabled.
  const docsEnabled = appCfg.env !== 'production' || appCfg.apiDocsEnabled;

  // CSP relaxed only as far as the self-hosted Swagger UI at /docs needs, and
  // only while it is served; all other helmet protections (HSTS, noSniff,
  // frameguard, etc.) stay at their defaults.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: docsEnabled ? ["'self'", "'unsafe-inline'"] : ["'self'"],
          styleSrc: docsEnabled ? ["'self'", "'unsafe-inline'"] : ["'self'"],
          imgSrc: ["'self'", 'data:'],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
        },
      },
    }),
  );
  app.use(cookieParser());
  app.use(compression());
  app.enableCors({ origin: appCfg.corsOrigins, credentials: true });
  // Secret fields (passwordHash, tokens, internal auth state) are hidden at the
  // schema level: `select: false` keeps them out of query results, and each
  // schema's toJSON transform drops the rest — see database/base.schema.ts.
  app.enableShutdownHooks();

  // OpenAPI docs (Zod DTOs made Swagger-aware via patchNestjsSwagger).
  if (docsEnabled) {
    patchNestJsSwagger();
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Apex Digital Lab API')
      .setDescription('REST API for the dentist portal, admin dashboard, and public site.')
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(appCfg.port);
  new NestLogger('Bootstrap').log(
    `API listening on ${appCfg.apiUrl}${docsEnabled ? ` (docs at ${appCfg.apiUrl}/docs)` : ''}`,
  );
}

void bootstrap();
