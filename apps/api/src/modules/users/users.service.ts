import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { FilterQuery, Model } from 'mongoose';
import { UserRole, UserStatus } from '@dental/shared-types';
import { User, UserDocument } from '../../database/entities';
import { AuthConfig } from '../../config/auth.config';
import { PasswordService } from '../../common/security/password.service';
import { generateToken, hashToken } from '../../common/utils/tokens';
import { regexContains } from '../../common/utils/mongo';
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

/** The normally-hidden secret columns, re-selected for the auth flows. */
const SECRET_FIELDS = '+passwordHash +passwordResetTokenHash +passwordResetExpiresAt';

/**
 * Owns all persistence for User accounts. Auth and Dentists build on top of this
 * so password hashing, token issuance, and lookups live in exactly one place.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly repo: Model<User>,
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
    await this.repo.updateOne({ _id: userId }, { passwordHash }).exec();
  }

  /** Includes the normally-hidden secret columns (passwordHash, reset token). */
  findByEmailWithSecret(email: string): Promise<User | null> {
    return this.repo.findOne({ email: email.toLowerCase() }).select(SECRET_FIELDS).exec();
  }

  findByIdWithSecret(id: string): Promise<User | null> {
    return this.repo.findById(id).select(SECRET_FIELDS).exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.repo.findById(id).exec();
  }

  async findByIdOrFail(id: string): Promise<UserDocument> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(input: CreateUserInput): Promise<User> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.repo.findOne({ email }).exec();
    if (existing) throw new ConflictException('A user with this email already exists');

    return this.repo.create({
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      phone: input.phone ?? null,
      status: input.status ?? (input.password ? UserStatus.ACTIVE : UserStatus.INVITED),
      passwordHash: input.password ? await this.hashPassword(input.password) : null,
    });
  }

  async list(query: ListUsersQuery): Promise<Paginated<User>> {
    const { skip, take, page, limit } = resolvePagination(query.page, query.limit);
    const filter: FilterQuery<User> = {};
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;
    if (query.search) {
      const rx = regexContains(query.search);
      filter.$or = [{ email: rx }, { firstName: rx }, { lastName: rx }];
    }

    const [data, total] = await Promise.all([
      this.repo.find(filter).sort({ createdAt: -1 }).skip(skip).limit(take).exec(),
      this.repo.countDocuments(filter).exec(),
    ]);
    return paginate(data, total, page, limit);
  }

  async update(id: string, patch: Partial<User>): Promise<User> {
    const user = await this.findByIdOrFail(id);
    Object.assign(user, patch);
    return user.save();
  }

  async setStatus(id: string, status: UserStatus): Promise<User> {
    return this.update(id, { status });
  }

  async setPassword(id: string, plain: string): Promise<void> {
    const passwordHash = await this.hashPassword(plain);
    await this.repo
      .updateOne(
        { _id: id },
        {
          passwordHash,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      )
      .exec();
  }

  /** Issue a single-use, time-limited setup/reset token; returns the raw token. */
  async issueResetToken(id: string, ttlSeconds?: number): Promise<string> {
    const { raw, hash } = generateToken();
    const expiresAt = new Date(Date.now() + (ttlSeconds ?? this.authCfg.resetTokenTtl) * 1000);
    await this.repo
      .updateOne({ _id: id }, { passwordResetTokenHash: hash, passwordResetExpiresAt: expiresAt })
      .exec();
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
    await this.repo
      .updateOne(
        { _id: id },
        {
          emailVerificationTokenHash: hash,
          emailVerificationExpiresAt: new Date(Date.now() + ttlSeconds * 1000),
        },
      )
      .exec();
    return raw;
  }

  /** Stamp the address as confirmed without going through a token. */
  async markEmailVerified(id: string): Promise<void> {
    await this.repo
      .updateOne(
        { _id: id },
        {
          emailVerifiedAt: new Date(),
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
        },
      )
      .exec();
  }

  /** Includes the normally-hidden email-verification columns. */
  findByIdWithVerification(id: string): Promise<User | null> {
    return this.repo
      .findById(id)
      .select('+emailVerificationTokenHash +emailVerificationExpiresAt')
      .exec();
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

    await this.repo
      .updateOne(
        { _id: user.id },
        {
          emailVerifiedAt: new Date(),
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
        },
      )
      .exec();
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
    return this.repo
      .updateOne({ _id: id }, { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null })
      .exec();
  }

  async registerFailedLogin(user: User): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    const patch: Partial<User> = { failedLoginAttempts: attempts };
    if (attempts >= this.authCfg.loginMaxAttempts) {
      patch.lockedUntil = new Date(Date.now() + this.authCfg.loginLockoutSeconds * 1000);
      patch.failedLoginAttempts = 0;
    }
    await this.repo.updateOne({ _id: user.id }, patch).exec();
  }
}
