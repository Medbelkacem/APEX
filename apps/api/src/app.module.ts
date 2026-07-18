import { randomUUID } from 'crypto';
import { resolve } from 'path';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';

import { configNamespaces, validateEnv } from './config';
import { AppConfig } from './config/app.config';
import { AuthConfig } from './config/auth.config';

import { QueueModule } from './queue/queue.module';
import { MailModule } from './mail/mail.module';
import { StorageModule } from './storage/storage.module';
import { DocumentsModule } from './documents/documents.module';

import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DentistsModule } from './modules/dentists/dentists.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CasesModule } from './modules/cases/cases.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { StatementsModule } from './modules/statements/statements.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ContactModule } from './modules/contact/contact.module';
import { HealthModule } from './modules/health/health.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Prefer the monorepo-root .env (dev), then a local one; in containers the
      // env comes from the process environment and these files are simply absent.
      envFilePath: [resolve(process.cwd(), '../../.env'), resolve(process.cwd(), '.env')],
      load: configNamespaces,
      validate: validateEnv,
    }),

    // Structured JSON logging with a request id on every line (DRS observability).
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const app = config.get<AppConfig>('app')!;
        return {
          pinoHttp: {
            level: app.logLevel,
            genReqId: (req, res) => {
              const existing = (req.headers['x-request-id'] as string) || randomUUID();
              res.setHeader('x-request-id', existing);
              return existing;
            },
            transport:
              app.env === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
        };
      },
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get<TypeOrmModuleOptions>('database')!,
    }),

    // Global JWT: available to the JwtAuthGuard and AuthService.
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const auth = config.get<AuthConfig>('auth')!;
        return { secret: auth.jwtSecret, signOptions: { expiresIn: auth.accessTtl } };
      },
    }),

    // Baseline rate limiting (per-route overrides via @Throttle).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),

    ScheduleModule.forRoot(),

    // Infrastructure (all @Global)
    QueueModule.register(),
    MailModule,
    StorageModule,
    DocumentsModule,
    AuditModule,
    SettingsModule,

    // Feature modules
    AuthModule,
    UsersModule,
    DentistsModule,
    CatalogModule,
    CasesModule,
    NotificationsModule,
    PricingModule,
    InvoicesModule,
    StatementsModule,
    StatisticsModule,
    ContactModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
