import { resolve } from 'path';
import * as dotenv from 'dotenv';

/**
 * Loads the monorepo-root .env (and a local one) into process.env BEFORE any
 * module is evaluated. Imported first in main.ts so dynamic modules that branch
 * on env (e.g. QueueModule) see the values. In containers/CI the real process
 * environment already holds these, and the files are simply absent.
 */
dotenv.config({ path: resolve(process.cwd(), '../../.env') });
dotenv.config({ path: resolve(process.cwd(), '.env') });
