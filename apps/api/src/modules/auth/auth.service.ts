import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser, UserRole, UserStatus } from '@dental/shared-types';
import { User } from '../../database/entities';
import { AuthConfig } from '../../config/auth.config';
import { JwtPayload } from '../../common/types/authenticated-request';
import { PasswordService } from '../../common/security/password.service';
import { AccountEmailsService } from '../../mail/account-emails.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { RefreshTokenService, RequestContext } from './refresh-token.service';

/** Public projection of a user (no secrets, no internal auth state). */
export type PublicUser = Omit<
  User,
  | 'passwordHash'
  | 'passwordResetTokenHash'
  | 'passwordResetExpiresAt'
  | 'failedLoginAttempts'
  | 'lockedUntil'
  | 'deletedAt'
  | 'fullName'
> & { fullName: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly accountEmails: AccountEmailsService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  private get authCfg(): AuthConfig {
    return this.config.get<AuthConfig>('auth')!;
  }

  /** Verify email + password, enforcing lockout and account status. */
  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmailWithSecret(email);

    // Lockout is decided before the password so a locked account is refused
    // whatever is submitted. A lock only ever exists on a real account that has
    // already failed several times, so this branch reveals nothing new.
    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new ForbiddenException('Account temporarily locked. Try again later.');
    }

    // Always spend a full verification — against a decoy hash when the account
    // is missing or has no password — so neither the response nor its timing
    // distinguishes a registered address from an unknown one for a caller who
    // cannot supply the password. Account *state* (disabled, pending, …) is
    // disclosed only once the password is proven, never before: the previous
    // ordering answered "is this address registered, and in what state?" to an
    // anonymous probe that never had to hold the password.
    const usableHash = user?.passwordHash ?? (await this.decoyHash());
    const passwordOk = await this.passwords.verify(usableHash, password);

    if (!user || !user.passwordHash || !passwordOk) {
      // Count the attempt only against a real, password-bearing account.
      if (user?.passwordHash) await this.users.registerFailedLogin(user);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === UserStatus.DISABLED) {
      throw new ForbiddenException('This account has been disabled');
    }
    // A self-registration that has not been approved yet. The two halves of
    // PENDING need different advice — chase your inbox, or wait for us — and
    // saying so is safe here because the caller has just proven the password.
    if (user.status === UserStatus.PENDING) {
      throw new ForbiddenException(
        user.emailVerifiedAt
          ? 'Your registration is awaiting approval. We will email you once your account is open.'
          : 'Please confirm your email address first — check your inbox for the verification link.',
      );
    }

    // A successful login is the only point at which the plaintext exists, and
    // therefore the only chance to move a legacy bcrypt hash (or one made with
    // since-raised cost factors) onto the current algorithm.
    if (this.passwords.needsRehash(user.passwordHash)) {
      await this.upgradePasswordHash(user, password);
    }

    await this.users.recordSuccessfulLogin(user.id);
    return user;
  }

  /**
   * A valid current-format hash that no real password matches, computed once
   * and reused. Verifying an absent account against it makes a login for an
   * unknown email do the same argon2 work as one for a real account, so the
   * response time cannot be used to enumerate which addresses are registered.
   */
  private decoyHashPromise: Promise<string> | null = null;
  private decoyHash(): Promise<string> {
    if (!this.decoyHashPromise) {
      this.decoyHashPromise = this.passwords.hash('no-account::decoy::do-not-match');
    }
    return this.decoyHashPromise;
  }

  /**
   * Re-hash a verified password with the current algorithm and parameters.
   *
   * Failure here is logged and swallowed: the user supplied the right password,
   * so refusing the login over a housekeeping write would lock them out of an
   * account that is in no way compromised. The next login retries it.
   */
  private async upgradePasswordHash(user: User, plain: string): Promise<void> {
    try {
      const upgraded = await this.passwords.hash(plain);
      await this.users.replacePasswordHash(user.id, upgraded);
      await this.audit.record({
        userId: user.id,
        action: 'auth.password_hash_upgraded',
        entityType: 'user',
        entityId: user.id,
      });
    } catch (err) {
      this.logger.error(
        `Could not upgrade the password hash for user ${user.id}: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }
  }

  /**
   * Sign the access JWT stored in the HttpOnly cookie.
   *
   * Deliberately short-lived: a JWT is valid because it verifies, so there is
   * no way to withdraw one before it expires. Anything that must take effect
   * promptly — logout, disabling an account, a password change — is enforced at
   * the refresh step, which is why this window has to stay small.
   */
  signAccessToken(user: User | PublicUser): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    return this.jwt.sign(payload, { expiresIn: this.authCfg.accessTtl });
  }

  private baseCookieOptions() {
    return {
      httpOnly: true as const,
      secure: this.authCfg.cookieSecure,
      sameSite: 'lax' as const,
      domain: this.authCfg.cookieDomain,
      path: '/',
    };
  }

  accessCookieOptions(): ReturnType<AuthService['baseCookieOptions']> & { maxAge: number } {
    return { ...this.baseCookieOptions(), maxAge: this.authCfg.accessTtl * 1000 };
  }

  /**
   * The refresh cookie outlives the access cookie by design, but its `maxAge`
   * is only a browser hint — the row in `refresh_tokens` is what decides.
   */
  refreshCookieOptions(): ReturnType<AuthService['baseCookieOptions']> & { maxAge: number } {
    return { ...this.baseCookieOptions(), maxAge: this.authCfg.refreshTtl * 1000 };
  }

  /**
   * The CSRF cookie is the one cookie here that is *not* httpOnly — the client
   * has to read it to echo it back in a header. It carries no authority on its
   * own, so script access to it grants nothing.
   */
  csrfCookieOptions(): Omit<ReturnType<AuthService['baseCookieOptions']>, 'httpOnly'> & {
    httpOnly: false;
    maxAge: number;
  } {
    return {
      ...this.baseCookieOptions(),
      httpOnly: false,
      maxAge: this.authCfg.refreshTtl * 1000,
    };
  }

  /** Options for clearing a cookie: same attributes, no lifetime. */
  clearCookieOptions(): ReturnType<AuthService['baseCookieOptions']> {
    return this.baseCookieOptions();
  }

  async login(
    email: string,
    password: string,
    ctx: RequestContext = {},
  ): Promise<{ accessToken: string; refreshToken: string; user: PublicUser }> {
    const user = await this.validateCredentials(email, password);
    const refresh = await this.refreshTokens.issue(user.id, ctx);
    return {
      accessToken: this.signAccessToken(user),
      refreshToken: refresh.raw,
      user: this.toPublic(user),
    };
  }

  /** Exchange a refresh token for a fresh pair, rotating the refresh token. */
  async refreshSession(
    rawRefreshToken: string,
    ctx: RequestContext = {},
  ): Promise<{ accessToken: string; refreshToken: string; user: PublicUser }> {
    const { token, user } = await this.refreshTokens.rotate(rawRefreshToken, ctx);
    return {
      accessToken: this.signAccessToken(user),
      refreshToken: token.raw,
      user: this.toPublic(user),
    };
  }

  async logout(rawRefreshToken?: string): Promise<void> {
    if (rawRefreshToken) await this.refreshTokens.revoke(rawRefreshToken);
  }

  /** Always resolves (no user enumeration). Sends a reset email only if valid. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmailWithSecret(email);
    if (user && user.status !== UserStatus.DISABLED) {
      const token = await this.users.issueResetToken(user.id);
      await this.accountEmails.sendPasswordReset(user, token);
    }
  }

  async resetPassword(userId: string, token: string, newPassword: string): Promise<void> {
    const user = await this.users.findByIdWithSecret(userId);
    if (!user) throw new UnauthorizedException('Invalid reset link');
    await this.users.assertValidResetToken(user, token);
    await this.users.setPassword(user.id, newPassword);
    if (user.status === UserStatus.INVITED) {
      // Opening the emailed setup link is proof of delivery, the same proof a
      // self-registration's verification link provides.
      await this.users.markEmailVerified(user.id);
      await this.users.setStatus(user.id, UserStatus.ACTIVE);
    }
    // Resetting a password is how someone recovers a compromised account, so it
    // has to end whatever sessions the other party was holding.
    await this.refreshTokens.revokeAllForUser(user.id);
    await this.audit.record({
      userId: user.id,
      action: 'auth.password_reset',
      entityType: 'user',
      entityId: user.id,
    });
  }

  async changePassword(userId: string, current: string, next: string): Promise<void> {
    const user = await this.users.findByIdWithSecret(userId);
    if (!user || !user.passwordHash) throw new UnauthorizedException();
    const ok = await this.passwords.verify(user.passwordHash, current);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    await this.users.setPassword(user.id, next);
    await this.refreshTokens.revokeAllForUser(user.id);
    await this.audit.record({
      userId: user.id,
      action: 'auth.password_changed',
      entityType: 'user',
      entityId: user.id,
    });
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.users.findByIdOrFail(userId);
    return this.toPublic(user);
  }

  async updateProfile(
    userId: string,
    patch: { firstName?: string; lastName?: string; phone?: string | null },
  ): Promise<PublicUser> {
    const user = await this.users.update(userId, patch);
    return this.toPublic(user);
  }

  toPublic(user: User): PublicUser {
    // The user schema's toObject transform already drops every secret/internal
    // field (passwordHash, reset tokens, lockout state, deletedAt) and adds the
    // `id` and `fullName` virtuals — exactly the public projection.
    const doc = user as User & { toObject?: () => Record<string, unknown> };
    const plain = doc.toObject ? doc.toObject() : { ...user };
    return {
      ...plain,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
    } as unknown as PublicUser;
  }

  /** Convenience for guards/tests: shape used as the authenticated principal. */
  toPrincipal(user: User): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}
