// One-command local dev with NO Docker and NO Redis:
//   1. starts a userspace MongoDB (single-node replica set) and seeds it
//   2. runs the API + web in watch mode (turbo)
// Emails print to the API logs (MAIL_DRIVER=log) and the queue runs inline.
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchDb } from './local-db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const mongo = await launchDb();

process.stdout.write('\n▶ Starting API + web (turbo dev)…\n\n');
const dev = spawn('pnpm', ['dev'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    // launchDb set MONGODB_URI to the in-memory server; pass it through.
    MONGODB_URI: process.env.MONGODB_URI,
    // Ensure no external infra is required regardless of .env contents.
    QUEUE_DRIVER: process.env.QUEUE_DRIVER || 'inline',
    MAIL_DRIVER: process.env.MAIL_DRIVER || 'log',
  },
});

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stdout.write('\n▶ Shutting down…\n');
  dev.kill('SIGINT');
  await mongo.stop().catch(() => {});
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
dev.on('exit', shutdown);
