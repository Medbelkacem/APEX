import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import {
  AuthenticatedUser,
  NotificationType,
  UserRole,
} from '@dental/shared-types';
import {
  CaseStatusHistory,
  DentalCase,
  Dentist,
} from '../../database/entities';
import { AppConfig } from '../../config/app.config';
import { allocateReference } from '../../common/utils/reference';
import { Paginated, paginate, resolvePagination } from '../../common/utils/pagination';
import { emailTemplates } from '../../mail/templates';
import { CatalogService } from '../catalog/catalog.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ChangeStatusDto,
  CreateCaseDto,
  ListCasesDto,
  ReassignCaseDto,
  UpdateCaseDto,
} from './cases.dto';

/** Relations every case detail view needs. */
const DETAIL_RELATIONS = {
  dentist: { user: true },
  caseType: true,
  currentStatus: true,
} as const;

@Injectable()
export class CasesService {
  constructor(
    @InjectRepository(DentalCase) private readonly cases: Repository<DentalCase>,
    @InjectRepository(Dentist) private readonly dentists: Repository<Dentist>,
    @InjectRepository(CaseStatusHistory)
    private readonly history: Repository<CaseStatusHistory>,
    private readonly dataSource: DataSource,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private get webUrl(): string {
    return this.config.get<AppConfig>('app')!.webUrl;
  }

  private isAdmin(user: AuthenticatedUser): boolean {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  }

  /** Resolve the Dentist row backing a dentist principal. */
  private async dentistForUser(userId: string): Promise<Dentist> {
    const dentist = await this.dentists.findOne({ where: { userId } });
    if (!dentist) {
      throw new ForbiddenException('No dentist profile is linked to this account');
    }
    return dentist;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreateCaseDto, user: AuthenticatedUser): Promise<DentalCase> {
    // A dentist may only ever file against their own profile; only an admin can
    // pass an explicit dentistId.
    const dentistId = this.isAdmin(user)
      ? (dto.dentistId ?? null)
      : (await this.dentistForUser(user.id)).id;
    if (!dentistId) {
      throw new ForbiddenException('An admin must specify which dentist the case belongs to');
    }

    const [caseType, status] = await Promise.all([
      this.catalog.findCaseTypeOrFail(dto.caseTypeId),
      this.catalog.defaultStatus(),
    ]);

    const created = await this.dataSource.transaction(async (manager) => {
      const reference = await allocateReference(manager, {
        table: 'cases',
        column: 'reference',
        prefix: 'CASE',
      });

      const repo = manager.getRepository(DentalCase);
      const entity = await repo.save(
        repo.create({
          reference,
          dentistId,
          caseTypeId: dto.caseTypeId,
          patientReference: dto.patientReference,
          toothRegion: dto.toothRegion ?? null,
          material: dto.material ?? null,
          shade: dto.shade ?? null,
          deadline: dto.deadline ?? null,
          clinicalNotes: dto.clinicalNotes ?? null,
          currentStatusId: status.id,
          submittedAt: new Date(),
        }),
      );

      // Seed the timeline with the entry status so history is never empty.
      const historyRepo = manager.getRepository(CaseStatusHistory);
      await historyRepo.save(
        historyRepo.create({
          caseId: entity.id,
          caseStatusId: status.id,
          changedByUserId: user.id,
          note: 'Case submitted',
        }),
      );

      return entity;
    });

    const full = await this.findByIdOrFail(created.id);
    const dentistName = full.dentist?.user
      ? `${full.dentist.user.firstName} ${full.dentist.user.lastName}`.trim()
      : 'A dentist';

    // Notify the lab inbox that work has arrived.
    const tpl = emailTemplates.caseSubmitted({
      reference: full.reference,
      caseType: caseType.name,
      dentistName,
    });
    await this.notifications.notifyAdmins({
      type: NotificationType.CASE_SUBMITTED,
      subject: tpl.subject,
      body: `${dentistName} submitted ${caseType.name} case ${full.reference}.`,
      email: { html: tpl.html, text: tpl.text },
      relatedCaseId: full.id,
    });

    return full;
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async list(query: ListCasesDto, user: AuthenticatedUser): Promise<Paginated<DentalCase>> {
    const { skip, take, page, limit } = resolvePagination(query.page, query.limit);
    const qb = this.cases
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.caseType', 'caseType')
      .leftJoinAndSelect('c.currentStatus', 'status')
      .leftJoinAndSelect('c.dentist', 'dentist')
      .leftJoinAndSelect('dentist.user', 'dentistUser');

    await this.applyScope(qb, user, query.dentistId);
    this.applyFilters(qb, query);

    const sortColumn = { submittedAt: 'c.submittedAt', deadline: 'c.deadline', reference: 'c.reference' }[
      query.sort ?? 'submittedAt'
    ];
    qb.orderBy(sortColumn, query.order ?? 'DESC').skip(skip).take(take);

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit);
  }

  /** Restrict the query to what the caller is allowed to see. */
  private async applyScope(
    qb: SelectQueryBuilder<DentalCase>,
    user: AuthenticatedUser,
    requestedDentistId?: string,
  ): Promise<void> {
    if (this.isAdmin(user)) {
      if (requestedDentistId) {
        qb.andWhere('c.dentistId = :dentistId', { dentistId: requestedDentistId });
      }
      return;
    }
    const dentist = await this.dentistForUser(user.id);
    qb.andWhere('c.dentistId = :ownDentistId', { ownDentistId: dentist.id });
  }

  private applyFilters(qb: SelectQueryBuilder<DentalCase>, query: ListCasesDto): void {
    if (query.status) {
      // Accept either a status id or its slug so links stay readable.
      const key = /^[0-9a-f-]{36}$/i.test(query.status) ? 'status.id' : 'status.slug';
      qb.andWhere(`${key} = :status`, { status: query.status });
    }
    if (query.bucket === 'active') qb.andWhere('status.isTerminal = false');
    if (query.bucket === 'completed') qb.andWhere('status.isTerminal = true');
    if (query.caseTypeId) qb.andWhere('c.caseTypeId = :caseTypeId', { caseTypeId: query.caseTypeId });
    if (query.dateFrom) qb.andWhere('c.submittedAt >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) {
      // Inclusive of the whole end day.
      qb.andWhere("c.submittedAt < (:dateTo::date + INTERVAL '1 day')", { dateTo: query.dateTo });
    }
    if (query.search) {
      qb.andWhere(
        '(c.reference ILIKE :q OR c.patientReference ILIKE :q OR c.material ILIKE :q OR c.toothRegion ILIKE :q)',
        { q: `%${query.search}%` },
      );
    }
  }

  async findByIdOrFail(id: string): Promise<DentalCase> {
    const found = await this.cases.findOne({ where: { id }, relations: DETAIL_RELATIONS });
    if (!found) throw new NotFoundException('Case not found');
    return found;
  }

  /** Load a case, enforcing that a dentist can only reach their own. */
  async findScoped(id: string, user: AuthenticatedUser): Promise<DentalCase> {
    const found = await this.findByIdOrFail(id);
    await this.assertAccess(found, user);
    return found;
  }

  async assertAccess(entity: DentalCase, user: AuthenticatedUser): Promise<void> {
    if (this.isAdmin(user)) return;
    const dentist = await this.dentistForUser(user.id);
    if (entity.dentistId !== dentist.id) {
      // 404 rather than 403 so ids of other dentists' cases stay unconfirmable.
      throw new NotFoundException('Case not found');
    }
  }

  async timeline(id: string, user: AuthenticatedUser): Promise<CaseStatusHistory[]> {
    await this.findScoped(id, user);
    return this.history.find({
      where: { caseId: id },
      relations: { caseStatus: true, changedByUser: true },
      order: { createdAt: 'ASC' },
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  /**
   * Dentists may only revise a case while it is still in the workflow's entry
   * status — once the lab has started work, changes go through an admin.
   */
  async update(id: string, dto: UpdateCaseDto, user: AuthenticatedUser): Promise<DentalCase> {
    const entity = await this.findScoped(id, user);

    if (!this.isAdmin(user)) {
      const entry = await this.catalog.defaultStatus();
      if (entity.currentStatusId !== entry.id) {
        throw new ForbiddenException(
          'This case is already in production — contact the laboratory to request a change',
        );
      }
    }

    if (dto.caseTypeId !== undefined) {
      await this.catalog.findCaseTypeOrFail(dto.caseTypeId);
      entity.caseTypeId = dto.caseTypeId;
    }
    if (dto.patientReference !== undefined) entity.patientReference = dto.patientReference;
    if (dto.toothRegion !== undefined) entity.toothRegion = dto.toothRegion;
    if (dto.material !== undefined) entity.material = dto.material;
    if (dto.shade !== undefined) entity.shade = dto.shade;
    if (dto.deadline !== undefined) entity.deadline = dto.deadline;
    if (dto.clinicalNotes !== undefined) entity.clinicalNotes = dto.clinicalNotes;

    await this.cases.save(entity);
    return this.findByIdOrFail(id);
  }

  /** Advance (or move back) a case through the workflow. Admin only. */
  async changeStatus(
    id: string,
    dto: ChangeStatusDto,
    user: AuthenticatedUser,
  ): Promise<DentalCase> {
    const entity = await this.findByIdOrFail(id);
    const status = await this.catalog.findStatusOrFail(dto.caseStatusId);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(DentalCase).update(id, {
        currentStatusId: status.id,
        // Terminal statuses stamp completion; reopening clears it.
        completedAt: status.isTerminal ? new Date() : null,
      });
      const historyRepo = manager.getRepository(CaseStatusHistory);
      await historyRepo.save(
        historyRepo.create({
          caseId: id,
          caseStatusId: status.id,
          changedByUserId: user.id,
          note: dto.note ?? null,
        }),
      );
    });

    // Tell the dentist their case moved.
    const caseUrl = `${this.webUrl}/cases/${id}`;
    const tpl = emailTemplates.caseStatusChanged({
      reference: entity.reference,
      status: status.label,
      caseUrl,
    });
    if (entity.dentist?.userId) {
      await this.notifications.notify({
        userId: entity.dentist.userId,
        type: NotificationType.CASE_STATUS_CHANGED,
        subject: tpl.subject,
        body: `Case ${entity.reference} is now "${status.label}".`,
        email: { html: tpl.html, text: tpl.text },
        relatedCaseId: id,
      });
    }

    return this.findByIdOrFail(id);
  }

  /** Move a case to a different dentist. Admin only, recorded on the timeline. */
  async reassign(id: string, dto: ReassignCaseDto, user: AuthenticatedUser): Promise<DentalCase> {
    const entity = await this.findByIdOrFail(id);
    const target = await this.dentists.findOne({
      where: { id: dto.dentistId },
      relations: { user: true },
    });
    if (!target) throw new NotFoundException('Target dentist not found');

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(DentalCase).update(id, { dentistId: target.id });
      const historyRepo = manager.getRepository(CaseStatusHistory);
      await historyRepo.save(
        historyRepo.create({
          caseId: id,
          caseStatusId: entity.currentStatusId,
          changedByUserId: user.id,
          note:
            dto.note ??
            `Reassigned to ${target.user?.firstName ?? ''} ${target.user?.lastName ?? ''}`.trim(),
        }),
      );
    });

    return this.findByIdOrFail(id);
  }

  // ── Dashboard aggregates ──────────────────────────────────────────────────

  /** Summary cards for the dentist dashboard (or lab-wide when admin). */
  async summary(user: AuthenticatedUser): Promise<{
    total: number;
    active: number;
    completed: number;
    dueSoon: number;
  }> {
    const base = (): SelectQueryBuilder<DentalCase> =>
      this.cases
        .createQueryBuilder('c')
        .leftJoin('c.currentStatus', 'status');

    const scope = async (qb: SelectQueryBuilder<DentalCase>) => {
      await this.applyScope(qb, user);
      return qb;
    };

    const [total, active, completed, dueSoon] = await Promise.all([
      scope(base()).then((qb) => qb.getCount()),
      scope(base()).then((qb) => qb.andWhere('status.isTerminal = false').getCount()),
      scope(base()).then((qb) => qb.andWhere('status.isTerminal = true').getCount()),
      scope(base()).then((qb) =>
        qb
          .andWhere('status.isTerminal = false')
          .andWhere('c.deadline IS NOT NULL')
          .andWhere("c.deadline <= CURRENT_DATE + INTERVAL '7 days'")
          .getCount(),
      ),
    ]);

    return { total, active, completed, dueSoon };
  }

  /** Most recent cases for the dashboard feed. */
  async recent(user: AuthenticatedUser, take = 5): Promise<DentalCase[]> {
    const qb = this.cases
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.caseType', 'caseType')
      .leftJoinAndSelect('c.currentStatus', 'status')
      .leftJoinAndSelect('c.dentist', 'dentist')
      .leftJoinAndSelect('dentist.user', 'dentistUser');
    await this.applyScope(qb, user);
    return qb.orderBy('c.submittedAt', 'DESC').take(take).getMany();
  }
}
