/**
 * Tests for public/sw.js.
 *
 * The worker is plain JS loaded by the browser rather than a module the app
 * imports, so it is executed here inside a stand-in `self` and its registered
 * listeners are invoked directly.
 *
 * What matters most is what it declines to handle. A cache is a copy on disk
 * that outlives the session, and this platform carries patient references,
 * clinical notes and invoices — so the assertions below are mostly about
 * responses never being stored, not about hit rates.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SW_SOURCE = readFileSync(resolve(__dirname, '../public/sw.js'), 'utf8');

const ORIGIN = 'https://lab.example.test';

type Listener = (event: FakeFetchEvent) => void;

/**
 * The three properties sw.js reads. A real `Request` cannot stand in here: the
 * spec forbids constructing one with `mode: 'navigate'`, which is exactly the
 * case worth testing, because only the browser may set it.
 */
interface FakeRequest {
  url: string;
  method: string;
  mode: string;
}

interface FakeFetchEvent {
  request: FakeRequest;
  respondWith: (response: Response | Promise<Response>) => void;
}

function request(url: string, { method = 'GET', mode = 'no-cors' } = {}): FakeRequest {
  return { url, method, mode };
}

/** Runs sw.js in a fresh fake global and returns its `fetch` listener. */
function loadWorker(): {
  fetchListener: Listener;
  cachePut: ReturnType<typeof vi.fn>;
  networkFetch: ReturnType<typeof vi.fn>;
} {
  const listeners = new Map<string, Listener>();
  const cachePut = vi.fn();
  // Stubbed rather than real: these tests are about which requests the worker
  // takes on, and nothing here should reach the network.
  const networkFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

  const cache = {
    addAll: vi.fn().mockResolvedValue(undefined),
    put: cachePut,
    match: vi.fn().mockResolvedValue(undefined),
  };

  const self = {
    location: new URL(ORIGIN),
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
    caches: {
      open: vi.fn().mockResolvedValue(cache),
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(true),
      match: vi.fn().mockResolvedValue(undefined),
    },
  };

  new Function('self', 'caches', 'fetch', 'Response', 'URL', SW_SOURCE)(
    self,
    self.caches,
    networkFetch,
    Response,
    URL,
  );

  const fetchListener = listeners.get('fetch');
  if (!fetchListener) throw new Error('sw.js registered no fetch listener');
  return { fetchListener, cachePut, networkFetch };
}

/** Dispatches a request and reports whether the worker took responsibility. */
function handle(
  fetchListener: Listener,
  url: string,
  init: { method?: string; mode?: string } = {},
): boolean {
  let handled = false;
  fetchListener({
    request: request(url, init),
    respondWith: () => {
      handled = true;
    },
  });
  return handled;
}

describe('service worker fetch handling', () => {
  let fetchListener: Listener;

  beforeEach(() => {
    ({ fetchListener } = loadWorker());
  });

  describe('requests it refuses to touch', () => {
    it('ignores API calls on its own origin', () => {
      // Case notes, invoices, patient references. Never stored, never served
      // from a copy — even where a proxy puts the API on this origin.
      expect(handle(fetchListener, `${ORIGIN}/api/cases`)).toBe(false);
    });

    it('ignores the API on its own separate origin', () => {
      expect(handle(fetchListener, 'https://api.example.test/api/cases')).toBe(false);
    });

    it('ignores every cross-origin request', () => {
      expect(handle(fetchListener, 'https://js.stripe.com/v3/')).toBe(false);
    });

    it('ignores non-GET requests', () => {
      // A worker replaying a POST would resubmit a case or a payment.
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        expect(handle(fetchListener, `${ORIGIN}/_next/static/chunk.js`, { method })).toBe(false);
      }
    });

    it('ignores an ordinary same-origin asset it was not told to cache', () => {
      expect(handle(fetchListener, `${ORIGIN}/some-upload.stl`)).toBe(false);
    });
  });

  describe('requests it serves', () => {
    it('handles immutable build output', () => {
      // Content-hashed by Next, so it carries no data and never goes stale.
      expect(handle(fetchListener, `${ORIGIN}/_next/static/chunks/main-abc123.js`)).toBe(true);
    });

    it('handles the precached icons', () => {
      expect(handle(fetchListener, `${ORIGIN}/icon-192.png`)).toBe(true);
    });

    it('handles navigations, for the offline fallback', () => {
      expect(handle(fetchListener, `${ORIGIN}/dashboard`, { mode: 'navigate' })).toBe(true);
    });

    it('does not treat an API path as a navigation', () => {
      // A hard refresh of an API URL is still not something to cache.
      expect(handle(fetchListener, `${ORIGIN}/api/cases`, { mode: 'navigate' })).toBe(false);
    });
  });

  describe('what reaches the cache', () => {
    it('never writes a page response', async () => {
      const { fetchListener: listener, cachePut } = loadWorker();
      const responses: Promise<Response>[] = [];

      listener({
        request: request(`${ORIGIN}/dashboard`, { mode: 'navigate' }),
        respondWith: (r) => responses.push(Promise.resolve(r)),
      });
      await Promise.allSettled(responses);

      // A rendered page is built from the signed-in user's data; it is served
      // but must not be left behind on the device.
      expect(cachePut).not.toHaveBeenCalled();
    });
  });
});
