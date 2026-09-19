import type { NextApiRequest, NextApiResponse } from 'next';
import type { Express } from 'express';

/**
 * Nest/Express does its own body parsing (see apps/api's create-app.ts);
 * Next's default JSON/urlencoded parsing would consume the stream first and
 * leave nothing for it to read. `externalResolver` tells Next this response
 * is fully handled by something else, so it does not warn or time it out
 * itself — Express does its own thing with `req`/`res` here.
 */
export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

let cachedApp: Promise<Express> | undefined;

/**
 * Boot the whole Nest app — Mongo connection included — once per cold start,
 * and reuse it for every request a warm instance handles afterward. A failed
 * boot is not cached: the next request gets a fresh attempt instead of every
 * request on this instance failing until the next cold start replaces it.
 */
async function getApp(): Promise<Express> {
  if (!cachedApp) {
    // Plain console.* rather than the Nest app's own pino logger: pino writes
    // to its own file descriptor rather than through console.log, which is
    // what a serverless platform's log capture actually hooks — without
    // this, a boot failure here is otherwise completely invisible.
    console.log('[api] cold start: booting the app');
    cachedApp = import('@dental/api/app')
      .then((mod) => mod.createExpressApp())
      .catch((err: unknown) => {
        console.error('[api] cold start: boot failed', err);
        cachedApp = undefined;
        throw err;
      });
  }
  return cachedApp;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  try {
    const app = await getApp();
    app(req, res);
  } catch (err) {
    console.error('[api] request failed to boot the app', err);
    if (!res.headersSent) {
      res.status(500).json({ statusCode: 500, error: 'ServerError', message: 'The API failed to start.' });
    }
  }
}
