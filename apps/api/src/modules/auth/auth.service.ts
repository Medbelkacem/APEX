import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AuthenticatedUser, UserRole, UserStatus } from '@dental/shared-types';
import { User } from '../../database/entities';
import { AuthConfig } from '../../config/auth.config';
import { JwtPayload } from '../../common/types/authenticated-request';
import { AccountEmailsService } from '../../mail/account-emails.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';

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
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly accountEmails: AccountEmailsService,
    private readonly audit: AuditService,
  ) {}

  private get authCfg(): AuthConfig {
    return this.config.get<AuthConfig>('auth')!;
  }

  /** Verify email + password, enforcing lockout and account status. */
  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmailWithSecret(email);
    // Uniform failure to avoid leaking which accounts exist.
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status === UserStatus.DISABLED) {
      throw new ForbiddenException('This account has been disabled');
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new ForbiddenException('Account temporarily locked. Try again later.');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.users.registerFailedLogin(user);
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.users.recordSuccessfulLogin(user.id);
    return user;
  }

  /** Sign the session JWT stored in the HttpOnly cookie. */
  signSessionToken(user: User | PublicUser): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    return this.jwt.sign(payload, { expiresIn: this.authCfg.refreshTtl });
  }

  cookieOptions(): {
    httpOnly: true;
    secure: boolean;
    sameSite: 'lax';
    domain: string;
    path: string;
    maxAge: number;
  } {
    return {
      httpOnly: true,
      secure: this.authCfg.cookieSecure,
      sameSite: 'lax',
      domain: this.authCfg.cookieDomain,
      path: '/',
      maxAge: this.authCfg.refreshTtl * 1000,
    };
  }

  async login(email: string, password: string): Promise<{ token: string; user: PublicUser }> {
    const user = await this.validateCredentials(email, password);
    return { token: this.signSessionToken(user), user: this.toPublic(user) };
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
      await this.users.setStatus(user.id, UserStatus.ACTIVE);
    }
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
    const ok = await bcrypt.compare(current, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    await this.users.setPassword(user.id, next);
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
    const {
      passwordHash: _p,
      passwordResetTokenHash: _t,
      passwordResetExpiresAt: _e,
      failedLoginAttempts: _f,
      lockedUntil: _l,
      deletedAt: _d,
      ...rest
    } = user;
    void _p;
    void _t;
    void _e;
    void _f;
    void _l;
    void _d;
    return { ...rest, fullName: `${user.firstName} ${user.lastName}`.trim() } as PublicUser;
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
