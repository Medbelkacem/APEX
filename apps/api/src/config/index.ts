export * from './env';
export * from './app.config';
export * from './auth.config';
export * from './database';
export * from './stripe';
export * from './mail';
export * from './storage';

import { appConfig } from './app.config';
import { authConfig } from './auth.config';
import { databaseConfig } from './database';
import { stripeConfig } from './stripe';
import { mailConfig } from './mail';
import { storageConfig } from './storage';

/** All registerAs namespaces, loaded by ConfigModule.forRoot({ load }). */
export const configNamespaces = [
  appConfig,
  authConfig,
  databaseConfig,
  stripeConfig,
  mailConfig,
  storageConfig,
];
