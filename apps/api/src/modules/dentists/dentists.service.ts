import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UserRole, UserStatus } from '@dental/shared-types';
import { Dentist, User } from '../../database/entities';
import { UsersService } from '../users/users.service';
import { AccountEmailsService } from '../../mail/account-emails.service';
import { Paginated, paginate, resolvePagination } from '../../common/utils/pagination';
import { CreateDentistDto, ListDentistsDto, UpdateDentistDto } from './dentists.dto';

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
