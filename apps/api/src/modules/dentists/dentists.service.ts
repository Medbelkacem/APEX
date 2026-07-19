import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UserRole, UserStatus } from '@dental/shared-types';
import { Dentist, User } from '../../database/entities';
import { UsersService } from '../users/users.service';
import { AccountEmailsService } from '../../mail/account-emails.service';
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

@Injectable()
export class DentistsService {
  constructor(
    @InjectRepository(Dentist) private readonly dentists: Repository<Dentist>,
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly accountEmails: AccountEmailsService,
  ) {}

  /** Create the linked User + Dentist atomically, then send an invitation. */
  async create(dto: CreateDentistDto): Promise<Dentist> {
    const email = dto.email.toLowerCase().trim();

    const dentist = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      if (await userRepo.findOne({ where: { email } })) {
        throw new ConflictException('A user with this email already exists');
      }
      const user = await userRepo.save(
        userRepo.create({
          email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone ?? null,
          role: UserRole.DENTIST,
          status: UserStatus.INVITED,
        }),
      );
      const dentistRepo = manager.getRepository(Dentist);
      const saved = await dentistRepo.save(
        dentistRepo.create({
          userId: user.id,
          clinicName: dto.clinicName ?? null,
          clinicAddress: dto.clinicAddress ?? null,
          billingAddress: dto.billingAddress ?? null,
          tier: dto.tier ?? null,
          notes: dto.notes ?? null,
        }),
      );
      saved.user = user;
      return saved;
    });

    // Invitation token valid for 7 days (first-login setup link).
    const token = await this.users.issueResetToken(dentist.userId, 7 * 24 * 3600);
    await this.accountEmails.sendInvitation(dentist.user, token);
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

    const existing = await this.dataSource.getRepository(User).findOne({ where: { email } });
    if (existing) {
      await this.accountEmails.sendRegistrationAttempted(existing);
      return;
    }

    const dentist = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await userRepo.save(
        userRepo.create({
          email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone ?? null,
          passwordHash: await this.users.hashPassword(dto.password),
          role: UserRole.DENTIST,
          // Pending with no verification stamp: unconfirmed address.
          status: UserStatus.PENDING,
          emailVerifiedAt: null,
        }),
      );
      const dentistRepo = manager.getRepository(Dentist);
      const saved = await dentistRepo.save(
        dentistRepo.create({
          userId: user.id,
          clinicName: dto.clinicName ?? null,
          clinicAddress: dto.clinicAddress ?? null,
        }),
      );
      saved.user = user;
      return saved;
    });

    const token = await this.users.issueEmailVerificationToken(
      dentist.userId,
      EMAIL_VERIFICATION_TTL_SECONDS,
    );
    await this.accountEmails.sendEmailVerification(dentist.user, token);
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
      const dentist = await this.dentists.findOne({ where: { userId } });
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
    const admins = await this.dataSource.getRepository(User).find({
      where: [
        { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
        { role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
      ],
    });
    return admins.map((a) => a.email);
  }

  async list(query: ListDentistsDto): Promise<Paginated<Dentist>> {
    const { skip, take, page, limit } = resolvePagination(query.page, query.limit);
    const qb = this.dentists
      .createQueryBuilder('dentist')
      .leftJoinAndSelect('dentist.user', 'user');
    if (query.status) qb.andWhere('user.status = :status', { status: query.status });
    if (query.search) {
      qb.andWhere(
        '(user.email ILIKE :q OR user.firstName ILIKE :q OR user.lastName ILIKE :q OR dentist.clinicName ILIKE :q)',
        { q: `%${query.search}%` },
      );
    }
    qb.orderBy('dentist.createdAt', 'DESC').skip(skip).take(take);
    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit);
  }

  async findByIdOrFail(id: string): Promise<Dentist> {
    const dentist = await this.dentists.findOne({ where: { id }, relations: { user: true } });
    if (!dentist) throw new NotFoundException('Dentist not found');
    return dentist;
  }

  /** Resolve the dentist record for a given user id (portal "own data" access). */
  async findByUserId(userId: string): Promise<Dentist> {
    const dentist = await this.dentists.findOne({
      where: { userId },
      relations: { user: true },
    });
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
    await this.dentists.save(dentist);

    return this.findByIdOrFail(id);
  }

  async setStatus(id: string, status: UserStatus): Promise<Dentist> {
    const dentist = await this.findByIdOrFail(id);
    await this.users.setStatus(dentist.userId, status);
    return this.findByIdOrFail(id);
  }

  async sendPasswordReset(id: string): Promise<void> {
    const dentist = await this.findByIdOrFail(id);
    const token = await this.users.issueResetToken(dentist.userId);
    await this.accountEmails.sendPasswordReset(dentist.user, token);
  }
}
