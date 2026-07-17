import './load-env';
import 'reflect-metadata';
import { ClassSerializerInterceptor, Logger as NestLogger } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
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
  // CSP relaxed just enough for the self-hosted Swagger UI at /docs; all other
  // helmet protections (HSTS, noSniff, frameguard, etc.) stay at their defaults.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );
  app.use(cookieParser());
  app.use(compression());
  app.enableCors({ origin: appCfg.corsOrigins, credentials: true });
  // Strip @Exclude()-marked fields (passwordHash, tokens, internal auth state)
  // from every serialized response.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.enableShutdownHooks();

  // OpenAPI docs (Zod DTOs made Swagger-aware via patchNestjsSwagger).
  patchNestJsSwagger();
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Dental Laboratory Management Platform API')
    .setDescription('REST API for the dentist portal, admin dashboard, and public site.')
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(appCfg.port);
  new NestLogger('Bootstrap').log(
    `API listening on ${appCfg.apiUrl} (docs at ${appCfg.apiUrl}/docs)`,
  );
}

void bootstrap();
