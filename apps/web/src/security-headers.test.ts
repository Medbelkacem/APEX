import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityHeaders } from '../security-headers.mjs';

const API = 'https://api.apex.example';

/** The CSP as a map of directive → source list. */
function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...sources] = part.split(/\s+/);
        return [name, sources] as const;
      }),
  );
}

describe('content security policy', () => {
  const prod = directives(contentSecurityPolicy({ production: true, apiUrl: API }));
  const dev = directives(contentSecurityPolicy({ production: false, apiUrl: 'http://localhost:4000' }));

  it('lets the Stripe card form load and talk to Stripe', () => {
    expect(prod.get('script-src')).toContain('https://js.stripe.com');
    expect(prod.get('frame-src')).toContain('https://js.stripe.com');
    expect(prod.get('frame-src')).toContain('https://hooks.stripe.com');
    expect(prod.get('connect-src')).toContain('https://api.stripe.com');
  });

  it('lets the browser reach the API on its own origin, and nothing else', () => {
    expect(prod.get('connect-src')).toContain(API);
    expect(prod.get('connect-src')).not.toContain('*');
    expect(dev.get('connect-src')).toContain('http://localhost:4000');
  });

  it('allows no script host beyond the site itself and Stripe', () => {
    const hosts = (prod.get('script-src') ?? []).filter((s) => s.startsWith('http'));
    expect(hosts.every((h) => h.includes('stripe.com'))).toBe(true);
  });

  it('cannot be framed, embedded, or made to post elsewhere', () => {
    expect(prod.get('frame-ancestors')).toEqual(["'none'"]);
    expect(prod.get('object-src')).toEqual(["'none'"]);
    expect(prod.get('form-action')).toEqual(["'self'"]);
    expect(prod.get('base-uri')).toEqual(["'self'"]);
  });

  it('permits eval only in development, where hot reload needs it', () => {
    expect(dev.get('script-src')).toContain("'unsafe-eval'");
    expect(prod.get('script-src')).not.toContain("'unsafe-eval'");
  });

  it('upgrades plain-HTTP subresources only in production', () => {
    expect(prod.has('upgrade-insecure-requests')).toBe(true);
    expect(dev.has('upgrade-insecure-requests')).toBe(false);
  });

  it('still produces a usable policy when the API URL is unparseable', () => {
    const broken = directives(contentSecurityPolicy({ production: true, apiUrl: 'not a url' }));
    expect(broken.get('connect-src')).toContain("'self'");
  });
});

describe('security headers', () => {
  const byKey = (production: boolean) =>
    new Map(securityHeaders({ production, apiUrl: API }).map((h) => [h.key, h.value]));

  it('sets the standard hardening headers on every response', () => {
    const headers = byKey(true);
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('Permissions-Policy')).toContain('camera=()');
    expect(headers.get('Content-Security-Policy')).toBeTruthy();
  });

  it('keeps payment available to the Stripe frame', () => {
    expect(byKey(true).get('Permissions-Policy')).toMatch(/payment=\(self "https:\/\/js\.stripe\.com"\)/);
  });

  it('pins HTTPS in production only', () => {
    expect(byKey(true).get('Strict-Transport-Security')).toMatch(/max-age=\d+; includeSubDomains/);
    expect(byKey(false).has('Strict-Transport-Security')).toBe(false);
  });
});
