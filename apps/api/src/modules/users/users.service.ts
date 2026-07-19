import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { UserRole, UserStatus } from '@dental/shared-types';
import { User } from '../../database/entities';
import { AuthConfig } from '../../config/auth.config';
import { PasswordService } from '../../common/security/password.service';
import { generateToken, hashToken } from '../../common/utils/tokens';
import { Paginated, paginate, resolvePagination } from '../../common/utils/pagination';

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string | null;
  password?: string;
  status?: UserStatus;
}

export interface ListUsersQuery {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Owns all persistence for User accounts. Auth and Dentists build on top of this
 * so password hashing, token issuance, and lookups live in exactly one place.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly config: ConfigService,
    private readonly passwords: PasswordService,
  ) {}

  private get authCfg(): AuthConfig {
    return this.config.get<AuthConfig>('auth')!;
  }

  hashPassword(plain: string): Promise<string> {
    return this.passwords.hash(plain);
  }

  /**
   * Replace a stored hash in place, without touching anything else on the
   * account. Used to upgrade a legacy hash during login, so it must not disturb
   * the login bookkeeping happening around it.
   */
  async replacePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.repo.update(userId, { passwordHash });
  }

  /** Includes the normally-hidden secret columns (passwordHash, reset token). */
  findByEmailWithSecret(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash', 'user.passwordResetTokenHash', 'user.passwordResetExpiresAt'])
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  findByIdWithSecret(id: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash', 'user.passwordResetTokenHash', 'user.passwordResetExpiresAt'])
      .where('user.id = :id', { id })
      .getOne();
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(input: CreateUserInput): Promise<User> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.repo.findOne({ where: { email } });
    if (existing) throw new ConflictException('A user with this email already exists');

    const user = this.repo.create({
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      phone: input.phone ?? null,
      status: input.status ?? (input.password ? UserStatus.ACTIVE : UserStatus.INVITED),
      passwordHash: input.password ? await this.hashPassword(input.password) : null,
    });
    return this.repo.save(user);
  }

  async list(query: ListUsersQuery): Promise<Paginated<User>> {
    const { skip, take, page, limit } = resolvePagination(query.page, query.limit);
    const qb = this.repo.createQueryBuilder('user');
    if (query.role) qb.andWhere('user.role = :role', { role: query.role });
    if (query.status) qb.andWhere('user.status = :status', { status: query.status });
    if (query.search) {
      qb.andWhere(
        '(user.email ILIKE :q OR user.firstName ILIKE :q OR user.lastName ILIKE :q)',
        { q: `%${query.search}%` },
      );
    }
    qb.orderBy('user.createdAt', 'DESC').skip(skip).take(take);
    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit);
  }

  async update(id: string, patch: Partial<User>): Promise<User> {
    const user = await this.findByIdOrFail(id);
    Object.assign(user, patch);
    return this.repo.save(user);
  }

  async setStatus(id: string, status: UserStatus): Promise<User> {
    return this.update(id, { status });
  }

  async setPassword(id: string, plain: string): Promise<void> {
    const passwordHash = await this.hashPassword(plain);
    await this.repo.update(id, {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  }

  /** Issue a single-use, time-limited setup/reset token; returns the raw token. */
  async issueResetToken(id: string, ttlSeconds?: number): Promise<string> {
    const { raw, hash } = generateToken();
    const expiresAt = new Date(Date.now() + (ttlSeconds ?? this.authCfg.resetTokenTtl) * 1000);
    await this.repo.update(id, {
      passwordResetTokenHash: hash,
      passwordResetExpiresAt: expiresAt,
    });
    return raw;
  }

  /**
   * Issue a single-use email-verification token; returns the raw value.
   *
   * Kept separate from the reset token rather than reusing that column: a
   * registrant may need a password reset before their address is confirmed, and
   * one column cannot hold two live tokens without one silently voiding the
   * other.
   */
  async issueEmailVerificationToken(id: string, ttlSeconds: number): Promise<string> {
    const { raw, hash } = generateToken();
    await this.repo.update(id, {
      emailVerificationTokenHash: hash,
      emailVerificationExpiresAt: new Date(Date.now() + ttlSeconds * 1000),
    });
    return raw;
  }

  /** Stamp the address as confirmed without going through a token. */
  async markEmailVerified(id: string): Promise<void> {
    await this.repo.update(id, {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    });
  }

  /** Includes the normally-hidden email-verification columns. */
  findByIdWithVerification(id: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect(['user.emailVerificationTokenHash', 'user.emailVerificationExpiresAt'])
      .where('user.id = :id', { id })
      .getOne();
  }

  /**
   * Consume a verification token and stamp the address as confirmed.
   *
   * The token is cleared on success, so the link works exactly once — a
   * verification mail sitting in an inbox forever is not a standing credential.
   */
  async confirmEmail(user: User, rawToken: string): Promise<void> {
    if (user.emailVerifiedAt) return; // Already done; a double click is not an error.
    if (!user.emailVerificationTokenHash || !user.emailVerificationExpiresAt) {
      throw new BadRequestException('No pending verification for this account');
    }
    if (user.emailVerificationExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Verification link has expired');
    }
    if (hashToken(rawToken) !== user.emailVerificationTokenHash) {
      throw new BadRequestException('Invalid verification link');
    }

    await this.repo.update(user.id, {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    });
  }

  /** Validate a raw reset token against a user; throws if invalid or expired. */
  async assertValidResetToken(user: User, rawToken: string): Promise<void> {
    if (!user.passwordResetTokenHash || !user.passwordResetExpiresAt) {
      throw new BadRequestException('No active reset request for this account');
    }
    if (user.passwordResetExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Reset link has expired');
    }
    if (hashToken(rawToken) !== user.passwordResetTokenHash) {
      throw new BadRequestException('Invalid reset link');
    }
  }

  recordSuccessfulLogin(id: string): Promise<unknown> {
    return this.repo.update(id, {
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  }

  async registerFailedLogin(user: User): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    const patch: Partial<User> = { failedLoginAttempts: attempts };
    if (attempts >= this.authCfg.loginMaxAttempts) {
      patch.lockedUntil = new Date(Date.now() + this.authCfg.loginLockoutSeconds * 1000);
      patch.failedLoginAttempts = 0;
    }
    await this.repo.update(user.id, patch);
  }
}
