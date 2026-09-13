/**
 * HTTP security headers for every page the web app serves.
 *
 * Kept out of `next.config.mjs` so the policy can be unit-tested with fixed
 * inputs; the config only calls `securityHeaders()` with the real environment.
 *
 * The Content-Security-Policy is the one that needs explaining. Stripe's card
 * form is an iframe from js.stripe.com driven by a script from the same host,
 * which is why those origins appear in frame-src and script-src; the API is a
 * separate origin, which is why its URL appears in connect-src. `'unsafe-inline'`
 * for scripts is the price of not running a nonce through middleware on every
 * route: Next.js hydrates through inline scripts, and without a per-request
 * nonce they can only be allowed wholesale. The rest of the policy still holds —
 * no third-party script hosts, no framing, no plugins, no form posts elsewhere.
 */

const STRIPE_SCRIPT_HOSTS = ['https://js.stripe.com', 'https://*.js.stripe.com'];
const STRIPE_FRAME_HOSTS = [
  'https://js.stripe.com',
  'https://*.js.stripe.com',
  'https://hooks.stripe.com',
  'https://m.stripe.network',
];
const STRIPE_CONNECT_HOSTS = ['https://api.stripe.com', 'https://*.stripe.com', 'https://m.stripe.network'];

/** scheme://host[:port] of a URL, or null when it cannot be parsed. */
function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * @param {{ production: boolean, apiUrl: string }} options
 * @returns {string} the Content-Security-Policy header value
 */
export function contentSecurityPolicy({ production, apiUrl }) {
  const apiOrigin = originOf(apiUrl);
  const scriptSrc = ["'self'", "'unsafe-inline'", ...STRIPE_SCRIPT_HOSTS];
  // Development builds evaluate source maps and hot-reload modules with eval;
  // production bundles never do, so the allowance is dropped there.
  if (!production) scriptSrc.push("'unsafe-eval'");

  const connectSrc = ["'self'", ...(apiOrigin ? [apiOrigin] : []), ...STRIPE_CONNECT_HOSTS];
  // The dev server's hot-reload channel is a websocket back to itself.
  if (!production) connectSrc.push('ws:', 'wss:');

  const directives = [
    ["default-src", "'self'"],
    ['script-src', scriptSrc.join(' ')],
    // Tailwind emits no inline styles, but Next's font loader and Stripe's
    // Elements both set them; a nonce cannot reach either.
    ['style-src', "'self' 'unsafe-inline'"],
    ['img-src', "'self' data: blob:"],
    ['font-src', "'self' data:"],
    ['connect-src', connectSrc.join(' ')],
    ['frame-src', STRIPE_FRAME_HOSTS.join(' ')],
    ['worker-src', "'self'"],
    ['manifest-src', "'self'"],
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'self'"],
    ['frame-ancestors', "'none'"],
  ];
  if (production) directives.push(['upgrade-insecure-requests', '']);

  return directives.map(([name, value]) => (value ? `${name} ${value}` : name)).join('; ');
}

/**
 * @param {{ production: boolean, apiUrl: string }} options
 * @returns {Array<{ key: string, value: string }>} headers for every route
 */
export function securityHeaders({ production, apiUrl }) {
  const headers = [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy({ production, apiUrl }) },
    // Belt and braces alongside frame-ancestors for browsers that predate it.
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // Full URL to our own pages, origin only to anyone else — so a case or
    // invoice id in a path never travels to Stripe or a linked site.
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Nothing on this site needs the camera, microphone or location. Payment
    // stays open for Stripe's wallet buttons inside its own frame.
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")',
    },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
  ];
  if (production) {
    // Two years, subdomains included. Only meaningful over TLS, and a
    // development origin on plain HTTP must never be pinned to HTTPS.
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains',
    });
  }
  return headers;
}
