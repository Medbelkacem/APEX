/**
 * Authentication, session handling, and RBAC — end to end.
 *
 * These go through the HTTP layer on purpose. The guards are registered
 * globally (`APP_GUARD`), the session lives in an httpOnly cookie, and the
 * serializer is what strips `passwordHash` from responses — none of which a
 * service-level unit test exercises.
 */
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { UserStatus } from '@dental/shared-types';
import { User } from '../src/database/entities/user.entity';
import { RefreshToken } from '../src/database/entities/refresh-token.entity';
import { UsersService } from '../src/modules/users/users.service';
import { hashToken } from '../src/common/utils/tokens';
import { createTestApp, TestApp } from './support/app';
import { truncateAll } from './support/database';
import { Fixtures, TEST_PASSWORD } from './support/factories';
import {
  api,
  AUTH_COOKIE,
  cookieAttributes,
  cookieValue,
  login,
  REFRESH_COOKIE,
} from './support/http';

describe('Authentication (e2e)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  let fixtures: Fixtures;
  let users: UsersService;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    fixtures = new Fixtures(ctx.dataSource);
    users = ctx.moduleRef.get(UsersService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.connection);
  });

  describe('POST /api/auth/login', () => {
    it('accepts valid credentials and issues a session cookie', async () => {
      const user = await fixtures.user();

      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: user.id, email: user.email });
      expect(cookieValue(res, AUTH_COOKIE)).toBeTruthy();
    });

    it('marks the session cookie httpOnly, lax, and root-scoped', async () => {
      const user = await fixtures.user();

      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD });

      const attributes = cookieAttributes(res, AUTH_COOKIE);
      // httpOnly is what keeps the token out of reach of injected script.
      expect(attributes).toEqual(expect.arrayContaining(['httponly', 'samesite=lax', 'path=/']));
    });

    it('never returns the password hash or internal auth state', async () => {
      const user = await fixtures.user();

      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD });

      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain('passwordHash');
      expect(serialized).not.toContain('passwordResetTokenHash');
      expect(serialized).not.toContain('failedLoginAttempts');
      expect(serialized).not.toContain('lockedUntil');
    });

    it('rejects a wrong password', async () => {
      const user = await fixtures.user();

      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'WrongPassw0rd!' });

      expect(res.status).toBe(401);
    });

    it('answers an unknown email exactly as a wrong password, to prevent enumeration', async () => {
      const user = await fixtures.user();

      const wrongPassword = await api(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'WrongPassw0rd!' });
      const unknownEmail = await api(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@dental-lab.test', password: 'WrongPassw0rd!' });

      expect(unknownEmail.status).toBe(wrongPassword.status);
      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    });

    it('refuses a disabled account', async () => {
      const user = await fixtures.user({ status: UserStatus.DISABLED });

      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD });

      expect(res.status).toBe(403);
    });

    it('refuses an invited account that has not set a password yet', async () => {
      const user = await fixtures.user({ status: UserStatus.INVITED, passwordHash: null });

      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD });

      expect(res.status).toBe(401);
    });

    it('rejects a malformed email before touching the database', async () => {
      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: TEST_PASSWORD });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/refresh', () => {
    const refreshWith = (refreshCookie: string) =>
      api(app).post('/api/auth/refresh').set('Cookie', refreshCookie);

    /** Seconds a signed access token is valid for, read from the token itself. */
    const accessTokenLifetime = (token: string): number => {
      const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as {
        iat: number;
        exp: number;
      };
      return claims.exp - claims.iat;
    };

    it('issues a short-lived access token, not a week-long one', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);

      // The access token cannot be revoked once signed, so its blast radius is
      // its lifetime. JWT_ACCESS_TTL is 900s; the session lasts via refresh.
      expect(accessTokenLifetime(session.token)).toBe(900);
    });

    it('exchanges the refresh cookie for a new session pair', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);

      const res = await refreshWith(session.refreshCookie);

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: user.id });
      expect(cookieValue(res, AUTH_COOKIE)).toBeTruthy();
      expect(cookieValue(res, REFRESH_COOKIE)).toBeTruthy();
    });

    it('rotates the refresh token rather than reissuing the same one', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);

      const res = await refreshWith(session.refreshCookie);

      expect(cookieValue(res, REFRESH_COOKIE)).not.toBe(session.refreshToken);
    });

    /** Ages a spend past the leeway, so a replay reads as theft not as a race. */
    const ageTheSpend = (rawToken: string) =>
      ctx.dataSource
        .getRepository(RefreshToken)
        .update({ tokenHash: hashToken(rawToken) }, { revokedAt: new Date(Date.now() - 60_000) });

    it('refuses a refresh token that has already been spent', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);
      await refreshWith(session.refreshCookie);
      await ageTheSpend(session.refreshToken);

      const replay = await refreshWith(session.refreshCookie);

      expect(replay.status).toBe(401);
    });

    it('revokes the whole session family when a spent token reappears later', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);
      const rotated = await refreshWith(session.refreshCookie);
      const live = cookieValue(rotated, REFRESH_COOKIE)!;

      await ageTheSpend(session.refreshToken);

      // Someone replays the old token: two parties now hold tokens from this
      // login, and there is no way to tell which one is the legitimate holder.
      await refreshWith(session.refreshCookie);

      // So the successor dies too, rather than leaving a thief a working chain.
      const res = await refreshWith(`${REFRESH_COOKIE}=${live}`);
      expect(res.status).toBe(401);
    });

    it('treats a token presented twice at once as a race, not as theft', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);

      // Two tabs waking from the same idle session replay one token. Revoking
      // the family here would log people out for using the product normally.
      const [first, second] = await Promise.all([
        refreshWith(session.refreshCookie),
        refreshWith(session.refreshCookie),
      ]);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
    });

    it('leaves the session usable after such a race', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);

      const [, second] = await Promise.all([
        refreshWith(session.refreshCookie),
        refreshWith(session.refreshCookie),
      ]);

      const live = cookieValue(second, REFRESH_COOKIE)!;
      expect((await refreshWith(`${REFRESH_COOKIE}=${live}`)).status).toBe(200);
    });

    it('clears both cookies when the refresh is refused', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);
      await refreshWith(session.refreshCookie);
      await ageTheSpend(session.refreshToken);

      const replay = await refreshWith(session.refreshCookie);

      // Leaving them in place would produce a client that retries forever.
      expect(cookieValue(replay, AUTH_COOKIE)).toBeUndefined();
      expect(cookieValue(replay, REFRESH_COOKIE)).toBeUndefined();
    });

    it('rejects a request with no refresh cookie', async () => {
      const res = await api(app).post('/api/auth/refresh');

      expect(res.status).toBe(401);
    });

    it('rejects a refresh token that was never issued', async () => {
      const res = await refreshWith(`${REFRESH_COOKIE}=not-a-real-token`);

      expect(res.status).toBe(401);
    });

    it('refuses once the idle window has passed', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);
      await ctx.dataSource
        .getRepository(RefreshToken)
        .update({ userId: user.id }, { expiresAt: new Date(Date.now() - 1000) });

      const res = await refreshWith(session.refreshCookie);

      expect(res.status).toBe(401);
    });

    it('does not let rotation push back the absolute session ceiling', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);
      const repo = ctx.dataSource.getRepository(RefreshToken);
      const ceiling = (await repo.findOneByOrFail({ userId: user.id })).absoluteExpiresAt;

      await refreshWith(session.refreshCookie);

      // Otherwise an attacker with a live token could refresh indefinitely and
      // the session would never require re-authentication.
      const after = await repo.find({ where: { userId: user.id }, order: { createdAt: 'DESC' } });
      expect(after[0].absoluteExpiresAt).toEqual(ceiling);
    });

    it('refuses to refresh a session whose account was disabled', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);
      await ctx.dataSource
        .getRepository(User)
        .update(user.id, { status: UserStatus.DISABLED });

      const res = await refreshWith(session.refreshCookie);

      // Disabling an account must end the sessions it already has, not merely
      // stop new logins — otherwise it takes effect only when the user leaves.
      expect(res.status).toBe(401);
    });

    it('ends the session at logout, server-side', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);

      await api(app).post('/api/auth/logout').set('Cookie', session.cookies);

      // Clearing the cookie alone would leave a copied token usable for a week.
      const res = await refreshWith(session.refreshCookie);
      expect(res.status).toBe(401);
    });

    it('ends every session when the password is changed', async () => {
      const user = await fixtures.user();
      const elsewhere = await login(app, user.email);
      const here = await login(app, user.email);

      await api(app)
        .post('/api/auth/change-password')
        .set('Cookie', here.cookie)
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'BrandNewPassw0rd!' });

      // Changing a password after a compromise is meant to lock the other
      // party out; leaving their refresh token alive would defeat that.
      expect((await refreshWith(elsewhere.refreshCookie)).status).toBe(401);
    });

    it('ends every session when the password is reset', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);
      const token = await users.issueResetToken(user.id);

      await api(app)
        .post('/api/auth/reset-password')
        .send({ userId: user.id, token, password: 'BrandNewPassw0rd!' });

      expect((await refreshWith(session.refreshCookie)).status).toBe(401);
    });

    it('keeps sessions independent across users', async () => {
      const alice = await fixtures.user();
      const bob = await fixtures.user();
      const aliceSession = await login(app, alice.email);
      const bobSession = await login(app, bob.email);

      await api(app).post('/api/auth/logout').set('Cookie', aliceSession.cookies);

      expect((await refreshWith(bobSession.refreshCookie)).status).toBe(200);
    });
  });

  describe('legacy password hashes', () => {
    const storedHash = async (id: string): Promise<string> => {
      // The adapter re-selects the normally-hidden passwordHash column.
      const row = await ctx.dataSource.getRepository(User).findOneByOrFail({ id });
      return row.passwordHash!;
    };

    /** An account created before the Argon2id migration. */
    const withBcryptHash = async (): Promise<User> => {
      const user = await fixtures.user();
      await ctx.dataSource
        .getRepository(User)
        .update(user.id, { passwordHash: await bcrypt.hash(TEST_PASSWORD, 10) });
      return user;
    };

    it('lets a user with a bcrypt hash log in', async () => {
      const user = await withBcryptHash();

      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
    });

    it('upgrades the stored hash to Argon2id on that login', async () => {
      const user = await withBcryptHash();
      expect(await storedHash(user.id)).toMatch(/^\$2[aby]\$/);

      await api(app).post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD });

      // A successful login is the only moment the plaintext is available, so it
      // is the only chance to re-hash without asking the user to do anything.
      expect(await storedHash(user.id)).toMatch(/^\$argon2id\$/);
    });

    it('leaves the password working after the upgrade', async () => {
      const user = await withBcryptHash();
      await api(app).post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD });

      const again = await api(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD });

      expect(again.status).toBe(200);
      expect(
        (await api(app).post('/api/auth/login').send({
          email: user.email,
          password: 'WrongPassw0rd!',
        })).status,
      ).toBe(401);
    });

    it('does not upgrade on a failed login', async () => {
      const user = await withBcryptHash();

      await api(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'WrongPassw0rd!' });

      expect(await storedHash(user.id)).toMatch(/^\$2[aby]\$/);
    });
  });

  describe('account lockout', () => {
    /** Mirrors LOGIN_MAX_ATTEMPTS; the schema default is 5. */
    const maxAttempts = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5);

    const failLogin = (email: string) =>
      api(app).post('/api/auth/login').send({ email, password: 'WrongPassw0rd!' });

    it(`locks the account after ${maxAttempts} consecutive failures`, async () => {
      const user = await fixtures.user();

      for (let i = 0; i < maxAttempts; i++) {
        const res = await failLogin(user.email);
        expect(res.status).toBe(401);
      }

      // The next attempt is refused on lockout grounds, not credentials.
      const locked = await failLogin(user.email);
      expect(locked.status).toBe(403);
    });

    it('refuses the correct password while the account is locked', async () => {
      const user = await fixtures.user();
      for (let i = 0; i < maxAttempts; i++) await failLogin(user.email);

      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD });

      expect(res.status).toBe(403);
    });

    it('clears the failure counter on a successful login', async () => {
      const user = await fixtures.user();
      for (let i = 0; i < maxAttempts - 1; i++) await failLogin(user.email);

      await login(app, user.email);

      const stored = await ctx.dataSource.getRepository(User).findOneByOrFail({ id: user.id });
      expect(stored.failedLoginAttempts).toBe(0);
      expect(stored.lockedUntil).toBeNull();
      expect(stored.lastLoginAt).not.toBeNull();
    });

    it('lets a lock lapse once its window has passed', async () => {
      const user = await fixtures.user();
      for (let i = 0; i < maxAttempts; i++) await failLogin(user.email);

      // Rewind the lock into the past rather than waiting out the 15-minute window.
      await ctx.dataSource
        .getRepository(User)
        .update(user.id, { lockedUntil: new Date(Date.now() - 1000) });

      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
    });
  });

  describe('session', () => {
    it('returns the current profile for a cookie session', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);

      const res = await api(app).get('/api/auth/me').set('Cookie', session.cookie);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: user.id, email: user.email });
    });

    it('also accepts the token as a bearer header', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);

      const res = await api(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${session.token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(user.id);
    });

    it('rejects a request with no credentials', async () => {
      const res = await api(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('rejects a forged token', async () => {
      const res = await api(app)
        .get('/api/auth/me')
        .set('Cookie', `${AUTH_COOKIE}=not.a.real.jwt`);

      expect(res.status).toBe(401);
    });

    it('clears the cookie on logout', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);

      const res = await api(app).post('/api/auth/logout').set('Cookie', session.cookie);

      expect(res.status).toBe(200);
      // An empty value is how Express expires a cookie.
      expect(cookieValue(res, AUTH_COOKIE)).toBeUndefined();
    });

    it('updates the profile of the caller', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);

      const res = await api(app)
        .patch('/api/auth/me')
        .set('Cookie', session.cookie)
        .send({ firstName: 'Renamed' });

      expect(res.status).toBe(200);
      expect(res.body.firstName).toBe('Renamed');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('accepts a known address', async () => {
      const user = await fixtures.user();

      const res = await api(app).post('/api/auth/forgot-password').send({ email: user.email });

      expect(res.status).toBe(202);
    });

    it('answers an unknown address identically, to prevent enumeration', async () => {
      const user = await fixtures.user();

      const known = await api(app).post('/api/auth/forgot-password').send({ email: user.email });
      const unknown = await api(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@dental-lab.test' });

      expect(unknown.status).toBe(known.status);
      expect(unknown.body).toEqual(known.body);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    const NEW_PASSWORD = 'BrandNewPassw0rd!';

    it('sets a new password and invalidates the old one', async () => {
      const user = await fixtures.user();
      const token = await users.issueResetToken(user.id);

      const res = await api(app)
        .post('/api/auth/reset-password')
        .send({ userId: user.id, token, password: NEW_PASSWORD });

      expect(res.status).toBe(200);
      await expect(login(app, user.email, NEW_PASSWORD)).resolves.toBeDefined();

      const stale = await api(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD });
      expect(stale.status).toBe(401);
    });

    it('burns the token after a single use', async () => {
      const user = await fixtures.user();
      const token = await users.issueResetToken(user.id);

      await api(app)
        .post('/api/auth/reset-password')
        .send({ userId: user.id, token, password: NEW_PASSWORD });

      const replay = await api(app)
        .post('/api/auth/reset-password')
        .send({ userId: user.id, token, password: 'AnotherPassw0rd!' });

      expect(replay.status).toBe(400);
    });

    it('rejects an expired token', async () => {
      const user = await fixtures.user();
      const token = await users.issueResetToken(user.id, 1);

      await ctx.dataSource
        .getRepository(User)
        .update(user.id, { passwordResetExpiresAt: new Date(Date.now() - 1000) });

      const res = await api(app)
        .post('/api/auth/reset-password')
        .send({ userId: user.id, token, password: NEW_PASSWORD });

      expect(res.status).toBe(400);
    });

    it("rejects another user's token", async () => {
      const victim = await fixtures.user();
      const attacker = await fixtures.user();
      await users.issueResetToken(victim.id);
      const attackerToken = await users.issueResetToken(attacker.id);

      const res = await api(app)
        .post('/api/auth/reset-password')
        .send({ userId: victim.id, token: attackerToken, password: NEW_PASSWORD });

      expect(res.status).toBe(400);
    });

    it('rejects a password that fails the policy', async () => {
      const user = await fixtures.user();
      const token = await users.issueResetToken(user.id);

      const res = await api(app)
        .post('/api/auth/reset-password')
        .send({ userId: user.id, token, password: 'short' });

      expect(res.status).toBe(400);
    });

    it('promotes an invited account to active', async () => {
      const user = await fixtures.user({ status: UserStatus.INVITED, passwordHash: null });
      const token = await users.issueResetToken(user.id);

      const res = await api(app)
        .post('/api/auth/setup-password')
        .send({ userId: user.id, token, password: NEW_PASSWORD });

      expect(res.status).toBe(200);
      const stored = await ctx.dataSource.getRepository(User).findOneByOrFail({ id: user.id });
      expect(stored.status).toBe(UserStatus.ACTIVE);
    });

    it('releases an account lock', async () => {
      const user = await fixtures.user({
        lockedUntil: new Date(Date.now() + 900_000),
        failedLoginAttempts: 4,
      });
      const token = await users.issueResetToken(user.id);

      await api(app)
        .post('/api/auth/reset-password')
        .send({ userId: user.id, token, password: NEW_PASSWORD });

      const stored = await ctx.dataSource.getRepository(User).findOneByOrFail({ id: user.id });
      expect(stored.lockedUntil).toBeNull();
      expect(stored.failedLoginAttempts).toBe(0);
    });
  });

  describe('POST /api/auth/change-password', () => {
    const NEW_PASSWORD = 'RotatedPassw0rd!';

    it('rotates the password when the current one is correct', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);

      const res = await api(app)
        .post('/api/auth/change-password')
        .set('Cookie', session.cookie)
        .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });

      expect(res.status).toBe(200);
      await expect(login(app, user.email, NEW_PASSWORD)).resolves.toBeDefined();
    });

    it('refuses when the current password is wrong', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);

      const res = await api(app)
        .post('/api/auth/change-password')
        .set('Cookie', session.cookie)
        .send({ currentPassword: 'NotMyPassw0rd!', newPassword: NEW_PASSWORD });

      expect(res.status).toBe(401);
    });

    it('applies the password policy to the replacement', async () => {
      const user = await fixtures.user();
      const session = await login(app, user.email);

      const res = await api(app)
        .post('/api/auth/change-password')
        .set('Cookie', session.cookie)
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'password' });

      expect(res.status).toBe(400);
    });

    it('requires authentication', async () => {
      const res = await api(app)
        .post('/api/auth/change-password')
        .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });

      expect(res.status).toBe(401);
    });
  });

  describe('role-based access control', () => {
    it('denies a dentist an admin-only route', async () => {
      const { user } = await fixtures.dentist();
      const session = await login(app, user.email);

      const res = await api(app).get('/api/dentists').set('Cookie', session.cookie);

      expect(res.status).toBe(403);
    });

    it('allows an admin the same route', async () => {
      const admin = await fixtures.admin();
      const session = await login(app, admin.email);

      const res = await api(app).get('/api/dentists').set('Cookie', session.cookie);

      expect(res.status).toBe(200);
    });

    it('denies an admin a super-admin-only route', async () => {
      const admin = await fixtures.admin();
      const session = await login(app, admin.email);

      // Method-level @Roles(SUPER_ADMIN) overrides the class-level pair.
      const res = await api(app)
        .post('/api/users')
        .set('Cookie', session.cookie)
        .send({
          email: 'new-admin@dental-lab.test',
          firstName: 'New',
          lastName: 'Admin',
          role: 'admin',
        });

      expect(res.status).toBe(403);
    });

    it('allows a super admin the same route', async () => {
      const superAdmin = await fixtures.superAdmin();
      const session = await login(app, superAdmin.email);

      const res = await api(app)
        .post('/api/users')
        .set('Cookie', session.cookie)
        .send({
          email: 'new-admin@dental-lab.test',
          firstName: 'New',
          lastName: 'Admin',
          role: 'admin',
        });

      expect([200, 201]).toContain(res.status);
    });
  });
});
