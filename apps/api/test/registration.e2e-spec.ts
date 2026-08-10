/**
 * Dentist self-registration: register → verify email → admin approval.
 *
 * The account is created in `pending`, which has two halves that behave
 * differently and are easy to conflate: `emailVerifiedAt` null means the
 * applicant has not proved they can receive mail, set means the lab has not yet
 * decided. Neither can sign in.
 */
import { INestApplication } from '@nestjs/common';
import { UserRole, UserStatus } from '@dental/shared-types';
import { User } from '../src/database/entities/user.entity';
import { Dentist } from '../src/database/entities/dentist.entity';
import { AuditLog } from '../src/database/entities/audit-log.entity';
import { createTestApp, TestApp } from './support/app';
import { truncateAll } from './support/database';
import { Fixtures, TEST_PASSWORD } from './support/factories';
import { api, login, Session } from './support/http';

const APPLICANT = {
  email: 'new.applicant@example.test',
  password: TEST_PASSWORD,
  firstName: 'Nadia',
  lastName: 'Benali',
  clinicName: 'Rue Didouche Dental',
  clinicAddress: '12 Rue Didouche Mourad',
};

describe('Dentist registration (e2e)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  let fixtures: Fixtures;
  let adminSession: Session;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    fixtures = new Fixtures(ctx.dataSource);
  });

  afterAll(async () => ctx.close());

  beforeEach(async () => {
    await truncateAll(ctx.connection);
    const admin = await fixtures.admin();
    adminSession = await login(app, admin.email);
  });

  const users = () => ctx.dataSource.getRepository(User);

  const register = (body: Record<string, unknown> = {}) =>
    api(app)
      .post('/api/auth/register')
      .send({ ...APPLICANT, ...body });

  /** The applicant's user row, including the hidden verification columns. */
  const applicant = (email = APPLICANT.email) =>
    // The adapter re-selects the hidden email-verification columns; stored
    // emails are always lower-cased.
    users().findOneByOrFail({ email: email.toLowerCase() });

  /**
   * Registers and returns the raw verification token.
   *
   * Only the hash is stored, so the raw value cannot be read back — the token
   * is reissued here against the same account, which is what the "resend"
   * path would do anyway.
   */
  async function registerAndGetToken(body: Record<string, unknown> = {}): Promise<string> {
    await register(body);
    const user = await applicant((body.email as string) ?? APPLICANT.email);
    const { UsersService } = await import('../src/modules/users/users.service');
    return ctx.moduleRef.get(UsersService).issueEmailVerificationToken(user.id, 3600);
  }

  const verify = (userId: string, token: string) =>
    api(app).post('/api/auth/verify-email').send({ userId, token });

  describe('POST /api/auth/register', () => {
    it('creates a pending dentist account', async () => {
      const res = await register();

      expect(res.status).toBe(202);
      const user = await applicant();
      expect(user.status).toBe(UserStatus.PENDING);
      expect(user.role).toBe(UserRole.DENTIST);
      expect(user.emailVerifiedAt).toBeNull();
    });

    it('creates the linked dentist profile', async () => {
      await register();

      const user = await applicant();
      const dentist = await ctx.dataSource
        .getRepository(Dentist)
        .findOneByOrFail({ userId: user.id });
      expect(dentist.clinicName).toBe(APPLICANT.clinicName);
      expect(dentist.clinicAddress).toBe(APPLICANT.clinicAddress);
    });

    // The lab reviews applications by hand. One that does not say which
    // practice it comes from, or where the work would be delivered, is not
    // reviewable — so the account is never created in the first place.
    it.each([
      ['a missing clinic name', { clinicName: undefined }],
      ['a missing clinic address', { clinicAddress: undefined }],
      ['a blank clinic name', { clinicName: '   ' }],
      ['a blank clinic address', { clinicAddress: '   ' }],
    ])('rejects a registration with %s', async (_label, patch) => {
      const res = await register(patch);

      expect(res.status).toBe(400);
      expect(await users().findOneBy({ email: APPLICANT.email })).toBeNull();
    });

    it('leaves tier unset, so pricing is not self-assigned', async () => {
      await register({ tier: 'vip' });

      const user = await applicant();
      const dentist = await ctx.dataSource
        .getRepository(Dentist)
        .findOneByOrFail({ userId: user.id });
      // Tier decides what the dentist is charged; an anonymous form must not
      // be able to set it, and the schema strips it rather than trusting it.
      expect(dentist.tier).toBeNull();
    });

    it('ignores an attempt to register as an admin', async () => {
      await register({ role: UserRole.ADMIN, status: UserStatus.ACTIVE });

      const user = await applicant();
      expect(user.role).toBe(UserRole.DENTIST);
      expect(user.status).toBe(UserStatus.PENDING);
    });

    it('answers identically when the address is already registered', async () => {
      const existing = await fixtures.dentist();

      const fresh = await register({ email: 'someone.new@example.test' });
      const taken = await register({ email: existing.user.email });

      // A form that says "email already in use" answers "does this dentist use
      // this lab?" for anyone who asks.
      expect(taken.status).toBe(fresh.status);
      expect(taken.body).toEqual(fresh.body);
    });

    it('does not touch the existing account when the address is taken', async () => {
      const existing = await fixtures.dentist();

      await register({ email: existing.user.email, firstName: 'Impostor' });

      const stored = await users().findOneByOrFail({ id: existing.user.id });
      expect(stored.firstName).toBe(existing.user.firstName);
      expect(stored.status).toBe(existing.user.status);
    });

    it('applies the password policy', async () => {
      const res = await register({ password: 'weak' });

      expect(res.status).toBe(400);
      expect(await users().findOneBy({ email: APPLICANT.email })).toBeNull();
    });

    it('rejects a malformed email', async () => {
      const res = await register({ email: 'not-an-email' });

      expect(res.status).toBe(400);
    });
  });

  describe('sign-in before approval', () => {
    it('refuses an unverified registrant', async () => {
      await register();

      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: APPLICANT.email, password: APPLICANT.password });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/confirm your email/i);
    });

    it('still refuses once verified but not yet approved', async () => {
      const token = await registerAndGetToken();
      const user = await applicant();
      await verify(user.id, token);

      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: APPLICANT.email, password: APPLICANT.password });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/awaiting approval/i);
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('stamps the address as verified', async () => {
      const token = await registerAndGetToken();
      const user = await applicant();

      const res = await verify(user.id, token);

      expect(res.status).toBe(200);
      expect((await applicant()).emailVerifiedAt).not.toBeNull();
    });

    it('leaves the account pending — verification is not approval', async () => {
      const token = await registerAndGetToken();
      const user = await applicant();

      await verify(user.id, token);

      expect((await applicant()).status).toBe(UserStatus.PENDING);
    });

    it('burns the token after a single use', async () => {
      const token = await registerAndGetToken();
      const user = await applicant();
      await verify(user.id, token);

      // A verification mail sitting in an inbox is not a standing credential.
      expect((await applicant()).emailVerificationTokenHash).toBeNull();
    });

    it('treats reopening the link as success, not an error', async () => {
      const token = await registerAndGetToken();
      const user = await applicant();
      await verify(user.id, token);

      const again = await verify(user.id, token);

      // People double-click links; the address is confirmed either way.
      expect(again.status).toBe(200);
    });

    it('rejects a token that was never issued', async () => {
      await register();
      const user = await applicant();

      const res = await verify(user.id, 'not-the-right-token');

      expect(res.status).toBe(400);
      expect((await applicant()).emailVerifiedAt).toBeNull();
    });

    it('rejects an expired token', async () => {
      const token = await registerAndGetToken();
      const user = await applicant();
      await users().update(user.id, { emailVerificationExpiresAt: new Date(Date.now() - 1000) });

      const res = await verify(user.id, token);

      expect(res.status).toBe(400);
      expect((await applicant()).emailVerifiedAt).toBeNull();
    });

    it('rejects another account’s token', async () => {
      const token = await registerAndGetToken();
      const other = await fixtures.user();

      const res = await verify(other.id, token);

      expect(res.status).toBe(400);
    });
  });

  describe('approval', () => {
    /** A registrant who has confirmed their address and awaits a decision. */
    async function awaitingApproval(): Promise<Dentist> {
      const token = await registerAndGetToken();
      const user = await applicant();
      await verify(user.id, token);
      return ctx.dataSource.getRepository(Dentist).findOneByOrFail({ userId: user.id });
    }

    const approve = (id: string) =>
      api(app).post(`/api/dentists/${id}/approve`).set('Cookie', adminSession.cookie);

    const reject = (id: string, reason?: string) =>
      api(app)
        .post(`/api/dentists/${id}/reject`)
        .set('Cookie', adminSession.cookie)
        .send({ reason: reason ?? null });

    it('opens the account', async () => {
      const dentist = await awaitingApproval();

      const res = await approve(dentist.id);

      expect(res.status).toBe(201);
      expect((await applicant()).status).toBe(UserStatus.ACTIVE);
    });

    it('lets the dentist sign in afterwards', async () => {
      const dentist = await awaitingApproval();
      await approve(dentist.id);

      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: APPLICANT.email, password: APPLICANT.password });

      expect(res.status).toBe(200);
    });

    it('refuses to approve an applicant who never confirmed their email', async () => {
      await register();
      const user = await applicant();
      const dentist = await ctx.dataSource
        .getRepository(Dentist)
        .findOneByOrFail({ userId: user.id });

      const res = await approve(dentist.id);

      // The confirmed address is the only thing tying this account to someone
      // real; approving without it opens a login for nobody in particular.
      expect(res.status).toBe(409);
      expect((await applicant()).status).toBe(UserStatus.PENDING);
    });

    it('refuses to approve an account that is already active', async () => {
      const existing = await fixtures.dentist();

      const res = await approve(existing.dentist.id);

      expect(res.status).toBe(409);
    });

    it('disables the account when declined', async () => {
      const dentist = await awaitingApproval();

      const res = await reject(dentist.id, 'Not currently taking new practices');

      expect(res.status).toBe(201);
      expect((await applicant()).status).toBe(UserStatus.DISABLED);
    });

    it('keeps a declined applicant out', async () => {
      const dentist = await awaitingApproval();
      await reject(dentist.id);

      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: APPLICANT.email, password: APPLICANT.password });

      expect(res.status).toBe(403);
    });

    it('records who approved the registration', async () => {
      const dentist = await awaitingApproval();

      await approve(dentist.id);

      const logs = await ctx.dataSource
        .getRepository(AuditLog)
        .find({ where: { entityId: dentist.id }, order: { createdAt: 'DESC' } });
      expect(logs[0].action).toBe('dentist.approved');
    });

    it('is closed to dentists', async () => {
      const dentist = await awaitingApproval();
      const other = await fixtures.dentist();
      const dentistSession = await login(app, other.user.email);

      const res = await api(app)
        .post(`/api/dentists/${dentist.id}/approve`)
        .set('Cookie', dentistSession.cookie);

      expect(res.status).toBe(403);
    });

    it('is closed to anonymous callers', async () => {
      const dentist = await awaitingApproval();

      const res = await api(app).post(`/api/dentists/${dentist.id}/approve`);

      expect(res.status).toBe(401);
    });
  });
});
