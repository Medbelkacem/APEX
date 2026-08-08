// Starts a real MongoDB in userspace (no Docker, no root), as a single-node
// replica set so the app's transactions work, then seeds it. Reusable by
// start-local.mjs, or run directly (`pnpm db:local`) to keep just the database
// up. Data persists in .local/mongodata and survives restarts.
//
// It manages `mongod` directly (using the binary mongodb-memory-server already
// downloads/caches) rather than MongoMemoryReplSet, because MMS re-runs
// `replSetInitiate` on every start — which a persisted replica set rejects with
// NodeNotFound, defeating the whole point of persisting to disk. Here the set is
// initiated only on the first run; later runs reuse the stored config untouched.
import { MongoBinary } from 'mongodb-memory-server';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const apiDir = resolve(root, 'apps/api');
const dataDir = resolve(root, '.local/mongodata');
const dbName = process.env.MONGO_DB || 'dental';
const port = Number(process.env.MONGO_PORT || 27017);
const replSetName = process.env.MONGO_REPLICA_SET || 'rs0';
const host = `127.0.0.1:${port}`;

// mongoose lives in the API workspace, not at the repo root; resolve it from there.
const requireFromApi = createRequire(resolve(apiDir, 'package.json'));

function run(cmd, args, label, extraEnv = {}) {
  process.stdout.write(`\n▶ ${label}\n`);
  const res = spawnSync(cmd, args, {
    cwd: apiDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  });
  if (res.status !== 0) throw new Error(`${label} failed (exit ${res.status})`);
}

/** Resolve once a TCP connection to `port` succeeds, or reject after `timeoutMs`. */
function waitForPort(targetPort, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolvePromise, reject) => {
    const attempt = () => {
      const socket = net.connect(targetPort, '127.0.0.1');
      socket.once('connect', () => {
        socket.destroy();
        resolvePromise();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline)
          reject(new Error(`mongod did not open port ${targetPort} in time`));
        else setTimeout(attempt, 150);
      });
    };
    attempt();
  });
}

/**
 * Initiate the replica set if it has never been configured, then wait until the
 * node has elected itself primary (writes, and thus seeding, need a primary).
 * Uses directConnection so the driver talks to the single node before a primary
 * exists — required to run `replSetInitiate` at all.
 */
async function ensureReplicaSet() {
  const mongoose = requireFromApi('mongoose');
  const conn = await mongoose
    .createConnection(`mongodb://${host}/admin?directConnection=true`, {
      serverSelectionTimeoutMS: 5000,
      directConnection: true,
    })
    .asPromise();
  try {
    const admin = conn.db.admin();
    // Initiate on the first ever run; on later runs the set is already configured
    // and mongod answers "already initialized", which is the no-op we want.
    try {
      await admin.command({
        replSetInitiate: { _id: replSetName, members: [{ _id: 0, host }] },
      });
    } catch (err) {
      const alreadyInitialized =
        err?.code === 23 || /already initialized/i.test(err?.errmsg ?? err?.message ?? '');
      if (!alreadyInitialized) throw err;
    }

    const deadline = Date.now() + 30_000;
    for (;;) {
      const hello = await admin.command({ hello: 1 });
      if (hello.isWritablePrimary) break;
      if (Date.now() > deadline) throw new Error('replica set did not elect a primary in time');
      await new Promise((r) => setTimeout(r, 150));
    }
  } finally {
    await conn.close();
  }
}

export async function launchDb() {
  mkdirSync(dataDir, { recursive: true });

  // Resolve the mongod binary, with fallbacks for platforms where the
  // default version is unavailable from MongoDB's fastdl. This avoids a
  // hard failure when MongoDB 7.x builds are missing for the runner.
  async function resolveMongoBinary() {
    try {
      return await MongoBinary.getPath({});
    } catch (err) {
      const fallbacks = ['6.0.14', '6.0.12', '5.0.14'];
      for (const v of fallbacks) {
        try {
          const p = await MongoBinary.getPath({ version: v });
          process.stdout.write(`\n▶ Using fallback mongod version ${v}\n`);
          return p;
        } catch (e) {
          // try next
        }
      }
      throw err;
    }
  }

  const binary = await resolveMongoBinary();
  const mongod = spawn(
    binary,
    [
      '--port',
      String(port),
      '--dbpath',
      dataDir,
      '--replSet',
      replSetName,
      '--bind_ip',
      '127.0.0.1',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );

  // Keep the tail of stderr so a startup failure (e.g. port in use, stale lock)
  // produces a useful message instead of a bare timeout.
  let stderr = '';
  mongod.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-4000);
  });

  let exited = false;
  mongod.once('exit', (code) => {
    exited = true;
    if (code && code !== 0 && !stopping) {
      process.stderr.write(`\nmongod exited unexpectedly (code ${code})\n${stderr}\n`);
    }
  });

  let stopping = false;
  const stop = () =>
    new Promise((resolvePromise) => {
      if (stopping || exited) return resolvePromise();
      stopping = true;
      mongod.once('exit', () => resolvePromise());
      mongod.kill('SIGTERM');
    });

  try {
    await Promise.race([
      waitForPort(port, 30_000),
      new Promise((_, reject) =>
        mongod.once('exit', (code) =>
          reject(new Error(`mongod failed to start (exit ${code})\n${stderr}`)),
        ),
      ),
    ]);
    await ensureReplicaSet();
  } catch (err) {
    await stop();
    throw err;
  }

  const uri = `mongodb://${host}/${dbName}?directConnection=true`;
  process.env.MONGODB_URI = uri;
  process.stdout.write(`✓ MongoDB ready at ${uri}\n`);

  run(
    'pnpm',
    ['exec', 'ts-node', '-r', 'tsconfig-paths/register', 'src/database/seeders/run-seed.ts'],
    'Seeding database',
    { MONGODB_URI: uri },
  );

  return { uri, stop };
}

// When executed directly, keep the DB running until interrupted.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = await launchDb();
  process.stdout.write('\nLocal database is up. Press Ctrl+C to stop.\n');
  const stop = async () => {
    await db.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setInterval(() => {}, 1 << 30);
}
