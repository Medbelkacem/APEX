/*
 * Service worker: installability and an offline shell. Nothing more.
 *
 * WHAT IS DELIBERATELY NOT CACHED
 *
 * No API response is ever stored, and no page HTML is either. This platform
 * carries patient references, clinical notes, scans and invoices, and a cache
 * is a copy on disk that outlives the session — it survives logout, it is not
 * cleared when the session cookie expires, and on a shared clinic machine the
 * next person to open the browser can be served it. "Offline access to your
 * cases" is a feature someone has to ask for deliberately, with an eviction
 * story attached; it is not something to switch on as a side effect of adding
 * a manifest.
 *
 * So the cache holds exactly two kinds of thing:
 *   - Next's content-hashed build output under /_next/static, which is
 *     immutable and carries no data.
 *   - The offline fallback page and the icons, which are public.
 *
 * Bump CACHE_VERSION to evict everything from prior versions.
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `dental-lab-shell-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';

/** Public, data-free assets worth having before the network is lost. */
const PRECACHE_URLS = [OFFLINE_URL, '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // A failed precache must not leave a half-installed worker in place.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Immutable build output — safe to serve from cache without revalidating. */
function isStaticBuildAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/');
}

function isPrecachedAsset(url) {
  return url.origin === self.location.origin && PRECACHE_URLS.includes(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET is ever cacheable, and a non-GET reaching here is a mutation the
  // worker has no business replaying.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Anything cross-origin is somebody else's data — the API included, since it
  // is served from its own origin. Left entirely to the network.
  if (url.origin !== self.location.origin) return;

  // Belt and braces for a deployment that reverse-proxies the API onto this
  // origin, where the check above would no longer exclude it.
  if (url.pathname.startsWith('/api/')) return;

  if (isStaticBuildAsset(url) || isPrecachedAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkOnlyWithOfflineFallback(request));
  }

  // Everything else falls through to the network untouched.
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

/**
 * Navigations always hit the network — the response is a page that may be built
 * from the signed-in user's data, so it is served but never stored. When the
 * network is gone there is nothing meaningful to show, so the offline page
 * stands in.
 */
async function networkOnlyWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(OFFLINE_URL);
    return cached ?? Response.error();
  }
}
