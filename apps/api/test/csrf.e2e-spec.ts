/**
 * Cross-site request forgery protection.
 *
 * The session is a cookie, so the browser attaches it to requests the user
 * never made. These tests impersonate that: a request carrying a real session
 * plus the markers a browser would add on behalf of an attacker's page.
 *
 * Two independent layers are asserted separately, because either one alone
 * still leaves a gap — an origin check does nothing against a same-site
 * attacker, and a token echo does nothing for a client that holds no token.
 */
import { INestApplication } from '@nestjs/common';
import { createTestApp, TestApp } from './support/app';
import { truncateAll } from './support/database';
import { Fixtures } from './support/factories';
import { api, cookieAttributes, cookieValue, login, Session, setCookies } from './support/http';

const ALLOWED_ORIGIN = 'http://localhost:3000';
const ATTACKER_ORIGIN = 'https://totally-not-evil.test';
const CSRF_COOKIE = 'csrf_token';

describe('CSRF (e2e)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  let fixtures: Fixtures;
  let session: Session;
  let csrf: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    fixtures = new Fixtures(ctx.dataSource);
  });

  afterAll(async () => ctx.close());

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
    const user = await fixtures.user();
    const res = await api(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'TestPassw0rd!' });
    csrf = cookieValue(res, CSRF_COOKIE)!;
    session = await login(app, user.email);
  });

  /** A logged-in browser's cookies, including the CSRF one it can read. */
  const browserCookies = () => `${session.cookies}; ${CSRF_COOKIE}=${csrf}`;

  describe('the CSRF cookie', () => {
    it('is issued at login', () => {
      expect(csrf).toBeTruthy();
    });

    it('is readable by script, unlike the session cookies', async () => {
      const user = await fixtures.user();
      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'TestPassw0rd!' });

      // It has to be readable — the client's job is to echo it in a header.
      // It carries no authority alone, so script access to it grants nothing.
      expect(cookieAttributes(res, CSRF_COOKIE)).not.toContain('httponly');
      expect(cookieAttributes(res, 'access_token')).toContain('httponly');
    });

    it('is cleared at logout', async () => {
      const res = await api(app)
        .post('/api/auth/logout')
        .set('Cookie', browserCookies())
        .set('X-CSRF-Token', csrf);

      const cleared = setCookies(res).find((c) => c.startsWith(`${CSRF_COOKIE}=;`));
      expect(cleared).toBeTruthy();
    });
  });

  describe('origin checking', () => {
    it('refuses a state-changing request from another origin', async () => {
      const res = await api(app)
        .post('/api/auth/logout')
        .set('Cookie', session.cookies)
        .set('Origin', ATTACKER_ORIGIN);

      expect(res.status).toBe(403);
    });

    it('allows one from an origin we serve', async () => {
      const res = await api(app)
        .post('/api/auth/logout')
        .set('Cookie', browserCookies())
        .set('X-CSRF-Token', csrf)
        .set('Origin', ALLOWED_ORIGIN);

      expect(res.status).toBe(200);
    });

    it('falls back to the Referer when no Origin is stated', async () => {
      const res = await api(app)
        .post('/api/auth/logout')
        .set('Cookie', session.cookies)
        .set('Referer', `${ATTACKER_ORIGIN}/landing-page`);

      expect(res.status).toBe(403);
    });

    it('accepts a Referer from an allowed origin', async () => {
      const res = await api(app)
        .post('/api/auth/logout')
        .set('Cookie', browserCookies())
        .set('X-CSRF-Token', csrf)
        .set('Referer', `${ALLOWED_ORIGIN}/dashboard`);

      expect(res.status).toBe(200);
    });

    it('leaves safe methods alone, whatever origin they claim', async () => {
      const res = await api(app)
        .get('/api/auth/me')
        .set('Cookie', session.cookies)
        .set('Origin', ATTACKER_ORIGIN);

      // A GET changes nothing, so forging one achieves nothing; blocking it
      // would only break legitimate cross-origin reads.
      expect(res.status).toBe(200);
    });

    it('allows a client that states no origin at all', async () => {
      // curl, a mobile app, a server-to-server call. None of them has a victim's
      // cookies attached on their behalf, so none of them can be made to forge.
      const res = await api(app).post('/api/auth/logout').set('Cookie', session.cookies);

      expect(res.status).toBe(200);
    });
  });

  describe('double-submit token', () => {
    it('refuses a request whose token is not echoed back', async () => {
      const res = await api(app).post('/api/auth/logout').set('Cookie', browserCookies());

      // The attacker's page gets the cookie sent for it, but cannot read it to
      // build the header — which is precisely the difference being tested.
      expect(res.status).toBe(403);
    });

    it('refuses a request echoing the wrong token', async () => {
      const res = await api(app)
        .post('/api/auth/logout')
        .set('Cookie', browserCookies())
        .set('X-CSRF-Token', 'guessed-it-surely');

      expect(res.status).toBe(403);
    });

    it('accepts a request echoing the right one', async () => {
      const res = await api(app)
        .post('/api/auth/logout')
        .set('Cookie', browserCookies())
        .set('X-CSRF-Token', csrf);

      expect(res.status).toBe(200);
    });

    it('still refuses when the token matches but the origin does not', async () => {
      const res = await api(app)
        .post('/api/auth/logout')
        .set('Cookie', browserCookies())
        .set('X-CSRF-Token', csrf)
        .set('Origin', ATTACKER_ORIGIN);

      // The layers are independent; passing one does not excuse the other.
      expect(res.status).toBe(403);
    });
  });

  describe('exemptions', () => {
    it('does not apply the origin check to the Stripe webhook', async () => {
      const res = await api(app)
        .post('/api/payments/webhook')
        .set('Origin', ATTACKER_ORIGIN)
        .send({});

      // Stripe is not a browser and holds no cookie of ours; the signature is
      // that route's credential, so it must fail on the signature, not on CSRF.
      expect(res.status).not.toBe(403);
      expect(res.status).toBe(400);
    });
  });
});
