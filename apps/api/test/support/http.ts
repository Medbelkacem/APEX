/**
 * HTTP helpers for e2e specs.
 *
 * Authentication travels in an httpOnly `access_token` cookie, so tests have to
 * carry that cookie the way a browser would. `login()` performs a real request
 * against `/api/auth/login` rather than signing a JWT directly — signing one
 * would skip the credential check, the lockout counters, and the cookie flags,
 * which are exactly the things worth testing.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TEST_PASSWORD } from './factories';

export const AUTH_COOKIE = 'access_token';

/** Return type is inferred: supertest v7 renamed this to `TestAgent<Test>`. */
export function api(app: INestApplication) {
  return request(app.getHttpServer());
}

/** Raw `Set-Cookie` values from a response, tolerating the single-string form. */
export function setCookies(res: request.Response): string[] {
  const raw = res.headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/** Reads one cookie's value out of a `Set-Cookie` header set. */
export function cookieValue(res: request.Response, name: string): string | undefined {
  const match = setCookies(res).find((c) => c.startsWith(`${name}=`));
  if (!match) return undefined;
  const value = match.split(';')[0].slice(name.length + 1);
  return value.length > 0 ? value : undefined;
}

/** Reads a cookie's attributes (Path, HttpOnly, SameSite, ...) as a lowercased set. */
export function cookieAttributes(res: request.Response, name: string): string[] {
  const match = setCookies(res).find((c) => c.startsWith(`${name}=`));
  if (!match) return [];
  return match
    .split(';')
    .slice(1)
    .map((a) => a.trim().toLowerCase());
}

export interface Session {
  cookie: string;
  token: string;
}

/**
 * Logs in and returns a cookie header ready to attach to later requests.
 * Throws on failure so a broken fixture surfaces here rather than as a
 * confusing 401 in the assertion under test.
 */
export async function login(
  app: INestApplication,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<Session> {
  const res = await api(app).post('/api/auth/login').send({ email, password });

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `login(${email}) expected 200/201 but got ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }

  const token = cookieValue(res, AUTH_COOKIE);
  if (!token) throw new Error(`login(${email}) succeeded but set no ${AUTH_COOKIE} cookie`);

  return { cookie: `${AUTH_COOKIE}=${token}`, token };
}
