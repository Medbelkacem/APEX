import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model } from 'mongoose';
import { UserRole, UserStatus } from '@dental/shared-types';
import { Dentist, DentistDocument, User } from '../../database/entities';
import { runInTransaction } from '../../database/base.schema';
import { UsersService } from '../users/users.service';
import { AccountEmailsService } from '../../mail/account-emails.service';
import { regexContains } from '../../common/utils/mongo';
import { Paginated, paginate, resolvePagination } from '../../common/utils/pagination';
import {
  CreateDentistDto,
  ListDentistsDto,
  RegisterDentistDto,
  UpdateDentistDto,
} from './dentists.dto';

/**
 * Verification links live longer than password resets. A reset is a deliberate
 * act the user is waiting on; a verification mail is often opened later, and an
 * expired one strands a registration nobody is chasing.
 */
const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 3600;

/** MongoDB duplicate-key violation — a unique index rejected the insert. */
function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: number } | undefined)?.code === 11000;
}

@Injectable()
export class DentistsService {
  constructor(
    @InjectModel(Dentist.name) private readonly dentists: Model<Dentist>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectConnection() private readonly connection: Connection,
    private readonly users: UsersService,
    private readonly accountEmails: AccountEmailsService,
  ) {}

  /** Create the linked User + Dentist atomically, then send an invitation. */
  async create(dto: CreateDentistDto): Promise<Dentist> {
    const email = dto.email.toLowerCase().trim();

    const dentist = await runInTransaction(this.connection, async (session) => {
      if (await this.userModel.findOne({ email }).session(session ?? null).exec()) {
        throw new ConflictException('A user with this email already exists');
      }
      const [user] = await this.userModel.create(
        [
          {
            email,
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone ?? null,
            role: UserRole.DENTIST,
            status: UserStatus.INVITED,
          },
        ],
        { session },
      );
      const [saved] = await this.dentists.create(
        [
          {
            userId: user.id,
            clinicName: dto.clinicName ?? null,
            clinicAddress: dto.clinicAddress ?? null,
            billingAddress: dto.billingAddress ?? null,
            tier: dto.tier ?? null,
            notes: dto.notes ?? null,
          },
        ],
        { session },
      );
      saved.user = user;
      return saved;
    });

    // Invitation token valid for 7 days (first-login setup link).
    const token = await this.users.issueResetToken(dentist.userId, 7 * 24 * 3600);
    await this.accountEmails.sendInvitation(dentist.user!, token);
    return dentist;
  }

  /**
   * Self-registration: create the account in `pending` with the password the
   * registrant chose, and email a verification link.
   *
   * Deliberately says nothing about whether the address was already taken. A
   * registration form that reports "email already in use" is a membership
   * oracle — anyone can ask it whether a given dentist banks with this lab. The
   * controller answers identically either way; the existing owner instead gets
   * an email telling them what happened, which only they can read.
   */
  async register(dto: RegisterDentistDto): Promise<void> {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.userModel.findOne({ email }).exec();
    if (existing) {
      await this.accountEmails.sendRegistrationAttempted(existing);
      return;
    }

    let dentist: Dentist;
    try {
      dentist = await runInTransaction(this.connection, async (session) => {
        const [user] = await this.userModel.create(
          [
            {
              email,
              firstName: dto.firstName,
              lastName: dto.lastName,
              phone: dto.phone ?? null,
              passwordHash: await this.users.hashPassword(dto.password),
              role: UserRole.DENTIST,
              // Pending with no verification stamp: unconfirmed address.
              status: UserStatus.PENDING,
              emailVerifiedAt: null,
            },
          ],
          { session },
        );
        const [saved] = await this.dentists.create(
          [
            {
              userId: user.id,
              clinicName: dto.clinicName,
              clinicAddress: dto.clinicAddress,
            },
          ],
          { session },
        );
        saved.user = user;
        return saved;
      });
    } catch (err) {
      // Two registrations for the same new address raced past the existence
      // check above and both reached the insert; the unique index rejects the
      // loser. Answer exactly as the "already registered" path so the outcome
      // is identical either way and the race can never surface as a 500 (which
      // would itself be a membership oracle).
      if (isUniqueViolation(err)) return;
      throw err;
    }

    const token = await this.users.issueEmailVerificationToken(
      dentist.userId,
      EMAIL_VERIFICATION_TTL_SECONDS,
    );
    await this.accountEmails.sendEmailVerification(dentist.user!, token);
  }

  /**
   * Confirm a registrant's email address and put them in the approval queue.
   *
   * Returns the resulting state so the page can say what happens next: an
   * account whose email was already confirmed, or which an admin has since
   * approved, must not read as an error just because the link was opened twice.
   */
  async verifyEmail(userId: string, token: string): Promise<{ status: UserStatus }> {
    const user = await this.users.findByIdWithVerification(userId);
    if (!user) throw new BadRequestException('Invalid verification link');

    const wasUnverified = !user.emailVerifiedAt;
    await this.users.confirmEmail(user, token);

    // Only tell the lab the first time; re-opening the link is not a new
    // application, and a queue that pages people twice stops being read.
    if (wasUnverified && user.status === UserStatus.PENDING) {
      const dentist = await this.dentists.findOne({ userId }).exec();
      await this.accountEmails.sendRegistrationPendingReview(await this.reviewerEmails(), {
        dentistName: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        clinicName: dentist?.clinicName ?? null,
      });
    }

    return { status: user.status };
  }

  /**
   * Approve a registration that has cleared email verification.
   *
   * Refuses an unverified account: approving one would open a login for an
   * address nobody has shown they can receive mail at, which is the only thing
   * tying the account to a real practice.
   */
  async approve(id: string): Promise<Dentist> {
    const dentist = await this.findByIdOrFail(id);
    const user = dentist.user;
    if (!user) throw new NotFoundException('Dentist has no linked account');

    if (user.status !== UserStatus.PENDING) {
      throw new ConflictException('This account is not awaiting approval');
    }
    if (!user.emailVerifiedAt) {
      throw new ConflictException('This applicant has not confirmed their email address yet');
    }

    await this.users.setStatus(user.id, UserStatus.ACTIVE);
    await this.accountEmails.sendAccountApproved(user);
    return this.findByIdOrFail(id);
  }

  /**
   * Decline a registration. The account is disabled rather than deleted, so a
   * reapplication with the same address is visible to whoever handles it.
   */
  async reject(id: string, reason?: string | null): Promise<Dentist> {
    const dentist = await this.findByIdOrFail(id);
    const user = dentist.user;
    if (!user) throw new NotFoundException('Dentist has no linked account');

    if (user.status !== UserStatus.PENDING) {
      throw new ConflictException('This account is not awaiting approval');
    }

    await this.users.setStatus(user.id, UserStatus.DISABLED);
    await this.accountEmails.sendAccountRejected(user, reason);
    return this.findByIdOrFail(id);
  }

  /** Email addresses of everyone who can action an approval queue. */
  async reviewerEmails(): Promise<string[]> {
    const admins = await this.userModel
      .find({ role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }, status: UserStatus.ACTIVE })
      .exec();
    return admins.map((a) => a.email);
  }

  async list(query: ListDentistsDto): Promise<Paginated<Dentist>> {
    const { skip, take, page, limit } = resolvePagination(query.page, query.limit);

    // `status` and `search` both constrain the linked User, so resolve the set
    // of matching user ids first, then filter dentists — keeping the result a
    // hydrated Dentist query whose populated user serializes through the schema
    // transform (which strips secrets), rather than a raw aggregation.
    const filter: FilterQuery<Dentist> = {};

    if (query.search) {
      const rx = regexContains(query.search);
      const userFilter: FilterQuery<User> = {
        $or: [{ email: rx }, { firstName: rx }, { lastName: rx }],
      };
      if (query.status) userFilter.status = query.status;
      const searchUserIds = await this.userModel.find(userFilter).distinct('_id').exec();

      const clinicBranch: FilterQuery<Dentist> = { clinicName: rx };
      if (query.status) {
        const statusUserIds = await this.userModel
          .find({ status: query.status })
          .distinct('_id')
          .exec();
        clinicBranch.userId = { $in: statusUserIds };
      }
      filter.$or = [{ userId: { $in: searchUserIds } }, clinicBranch];
    } else if (query.status) {
      const statusUserIds = await this.userModel
        .find({ status: query.status })
        .distinct('_id')
        .exec();
      filter.userId = { $in: statusUserIds };
    }

    const [data, total] = await Promise.all([
      this.dentists
        .find(filter)
        .populate('user')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .exec(),
      this.dentists.countDocuments(filter).exec(),
    ]);
    return paginate(data, total, page, limit);
  }

  async findByIdOrFail(id: string): Promise<DentistDocument> {
    const dentist = await this.dentists.findById(id).populate('user').exec();
    if (!dentist) throw new NotFoundException('Dentist not found');
    return dentist;
  }

  /** Resolve the dentist record for a given user id (portal "own data" access). */
  async findByUserId(userId: string): Promise<Dentist> {
    const dentist = await this.dentists.findOne({ userId }).populate('user').exec();
    if (!dentist) throw new NotFoundException('Dentist profile not found');
    return dentist;
  }

  async update(id: string, dto: UpdateDentistDto): Promise<Dentist> {
    const dentist = await this.findByIdOrFail(id);
    // Split fields between the User and Dentist rows.
    const userPatch: Partial<User> = {};
    if (dto.firstName !== undefined) userPatch.firstName = dto.firstName;
    if (dto.lastName !== undefined) userPatch.lastName = dto.lastName;
    if (dto.phone !== undefined) userPatch.phone = dto.phone;
    if (Object.keys(userPatch).length) {
      await this.users.update(dentist.userId, userPatch);
    }

    if (dto.clinicName !== undefined) dentist.clinicName = dto.clinicName;
    if (dto.clinicAddress !== undefined) dentist.clinicAddress = dto.clinicAddress;
    if (dto.billingAddress !== undefined) dentist.billingAddress = dto.billingAddress;
    if (dto.tier !== undefined) dentist.tier = dto.tier;
    if (dto.notes !== undefined) dentist.notes = dto.notes;
    await dentist.save();

    return this.findByIdOrFail(id);
  }

  async setStatus(id: string, status: UserStatus): Promise<Dentist> {
    const dentist = await this.findByIdOrFail(id);
    await this.users.setStatus(dentist.userId, status);
    return this.findByIdOrFail(id);
  }

  /**
   * Re-enable a dentist account (the disable → active path).
   *
   * Refuses a PENDING self-registration: those must go through `approve()`,
   * which is the only transition that checks the applicant confirmed their
   * email. Flipping a pending, email-unverified account straight to active
   * here would open a login for an address nobody has shown they can receive
   * mail at — the exact bypass the approval gate exists to prevent.
   */
  async enable(id: string): Promise<Dentist> {
    const dentist = await this.findByIdOrFail(id);
    const user = dentist.user;
    if (!user) throw new NotFoundException('Dentist has no linked account');
    if (user.status === UserStatus.PENDING) {
      throw new ConflictException(
        'This account is awaiting approval — approve it instead of enabling it',
      );
    }
    await this.users.setStatus(user.id, UserStatus.ACTIVE);
    return this.findByIdOrFail(id);
  }

  async sendPasswordReset(id: string): Promise<void> {
    const dentist = await this.findByIdOrFail(id);
    const token = await this.users.issueResetToken(dentist.userId);
    await this.accountEmails.sendPasswordReset(dentist.user!, token);
  }
}
