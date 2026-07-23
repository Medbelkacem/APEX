import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Connection, FilterQuery, Model } from 'mongoose';
import {
  AuthenticatedUser,
  NotificationType,
  UserRole,
} from '@dental/shared-types';
import {
  CaseStatusHistory,
  Counter,
  DentalCase,
  DentalCaseDocument,
  Dentist,
} from '../../database/entities';
import { runInTransaction } from '../../database/base.schema';
import { AppConfig } from '../../config/app.config';
import { allocateReference } from '../../common/utils/reference';
import { regexContains } from '../../common/utils/mongo';
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

/** Populate spec every case detail view needs (dentist→user, type, status). */
const DETAIL_POPULATE = [
  { path: 'dentist', populate: { path: 'user' } },
  { path: 'caseType' },
  { path: 'currentStatus' },
];

/** True for a 36-char UUID (a status id) rather than a slug. */
const isUuid = (value: string): boolean => /^[0-9a-f-]{36}$/i.test(value);

/** A filter that matches nothing — used when a slug/id resolves to no status. */
const MATCH_NONE = '__no_such_status__';

@Injectable()
export class CasesService {
  constructor(
    @InjectModel(DentalCase.name) private readonly cases: Model<DentalCase>,
    @InjectModel(Dentist.name) private readonly dentists: Model<Dentist>,
    @InjectModel(CaseStatusHistory.name) private readonly history: Model<CaseStatusHistory>,
    @InjectModel(Counter.name) private readonly counters: Model<Counter>,
    @InjectConnection() private readonly connection: Connection,
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
    const dentist = await this.dentists.findOne({ userId }).exec();
    if (!dentist) {
      throw new ForbiddenException('No dentist profile is linked to this account');
    }
    return dentist;
  }

  /** Terminal and non-terminal status ids, for bucket filters. */
  private async statusIdsByTerminality(): Promise<{ terminal: string[]; active: string[] }> {
    const statuses = await this.catalog.listStatuses(true);
    return {
      terminal: statuses.filter((s) => s.isTerminal).map((s) => s.id),
      active: statuses.filter((s) => !s.isTerminal).map((s) => s.id),
    };
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

    const created = await runInTransaction(this.connection, async (session) => {
      const reference = await allocateReference(this.counters, { prefix: 'CASE' }, session);

      const [entity] = await this.cases.create(
        [
          {
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
          },
        ],
        { session },
      );

      // Seed the timeline with the entry status so history is never empty.
      await this.history.create(
        [
          {
            caseId: entity.id,
            caseStatusId: status.id,
            changedByUserId: user.id,
            note: 'Case submitted',
          },
        ],
        { session },
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

    const filter: FilterQuery<DentalCase> = {};
    await this.applyScope(filter, user, query.dentistId);
    await this.applyFilters(filter, query);

    const sortColumn = { submittedAt: 'submittedAt', deadline: 'deadline', reference: 'reference' }[
      query.sort ?? 'submittedAt'
    ];
    const sortDir = (query.order ?? 'DESC') === 'ASC' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.cases
        .find(filter)
        .populate(DETAIL_POPULATE)
        .sort({ [sortColumn]: sortDir })
        .skip(skip)
        .limit(take)
        .exec(),
      this.cases.countDocuments(filter).exec(),
    ]);
    return paginate(data, total, page, limit);
  }

  /** Restrict the filter to what the caller is allowed to see. */
  private async applyScope(
    filter: FilterQuery<DentalCase>,
    user: AuthenticatedUser,
    requestedDentistId?: string,
  ): Promise<void> {
    if (this.isAdmin(user)) {
      if (requestedDentistId) filter.dentistId = requestedDentistId;
      return;
    }
    const dentist = await this.dentistForUser(user.id);
    filter.dentistId = dentist.id;
  }

  private async applyFilters(filter: FilterQuery<DentalCase>, query: ListCasesDto): Promise<void> {
    // Resolve any status / bucket selection into a currentStatusId constraint.
    const constraint = await this.resolveStatusConstraint(query);
    if (constraint !== undefined) filter.currentStatusId = constraint;

    if (query.caseTypeId) filter.caseTypeId = query.caseTypeId;

    if (query.dateFrom || query.dateTo) {
      const submittedAt: Record<string, Date> = {};
      if (query.dateFrom) submittedAt.$gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
      if (query.dateTo) submittedAt.$lt = this.nextDay(query.dateTo);
      filter.submittedAt = submittedAt;
    }

    if (query.search) {
      const rx = regexContains(query.search);
      filter.$or = [
        { reference: rx },
        { patientReference: rx },
        { material: rx },
        { toothRegion: rx },
      ];
    }
  }

  /**
   * Turn `status` (id or slug) and `bucket` (active/completed) into a
   * `currentStatusId` constraint, or `undefined` when neither is set. Returns a
   * never-matching value when a slug/id resolves to no status.
   */
  private async resolveStatusConstraint(
    query: ListCasesDto,
  ): Promise<string | { $in: string[] } | undefined> {
    let explicitId: string | undefined;
    if (query.status) {
      if (isUuid(query.status)) {
        explicitId = query.status;
      } else {
        const found = await this.catalog.findStatusBySlug(query.status);
        explicitId = found?.id ?? MATCH_NONE;
      }
    }

    if (!query.bucket) return explicitId;

    const { terminal, active } = await this.statusIdsByTerminality();
    const bucketIds = query.bucket === 'completed' ? terminal : active;
    if (explicitId) {
      return bucketIds.includes(explicitId) ? explicitId : MATCH_NONE;
    }
    return { $in: bucketIds };
  }

  private nextDay(dateStr: string): Date {
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }

  async findByIdOrFail(id: string): Promise<DentalCaseDocument> {
    const found = await this.cases.findById(id).populate(DETAIL_POPULATE).exec();
    if (!found) throw new NotFoundException('Case not found');
    return found;
  }

  /** Load a case, enforcing that a dentist can only reach their own. */
  async findScoped(id: string, user: AuthenticatedUser): Promise<DentalCaseDocument> {
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
    return this.history
      .find({ caseId: id })
      .populate('caseStatus')
      .populate('changedByUser')
      .sort({ createdAt: 1 })
      .exec();
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

    await entity.save();
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

    await runInTransaction(this.connection, async (session) => {
      await this.cases
        .updateOne(
          { _id: id },
          {
            currentStatusId: status.id,
            // Terminal statuses stamp completion; reopening clears it.
            completedAt: status.isTerminal ? new Date() : null,
          },
          { session },
        )
        .exec();
      await this.history.create(
        [
          {
            caseId: id,
            caseStatusId: status.id,
            changedByUserId: user.id,
            note: dto.note ?? null,
          },
        ],
        { session },
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
    const target = await this.dentists.findById(dto.dentistId).populate('user').exec();
    if (!target) throw new NotFoundException('Target dentist not found');

    await runInTransaction(this.connection, async (session) => {
      await this.cases.updateOne({ _id: id }, { dentistId: target.id }, { session }).exec();
      await this.history.create(
        [
          {
            caseId: id,
            caseStatusId: entity.currentStatusId,
            changedByUserId: user.id,
            note:
              dto.note ??
              `Reassigned to ${target.user?.firstName ?? ''} ${target.user?.lastName ?? ''}`.trim(),
          },
        ],
        { session },
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
    const scope: FilterQuery<DentalCase> = {};
    await this.applyScope(scope, user);
    const { terminal, active } = await this.statusIdsByTerminality();

    // Due within 7 days, inclusive — deadlines are ISO date strings.
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() + 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const [total, completed, activeCount, dueSoon] = await Promise.all([
      this.cases.countDocuments(scope).exec(),
      this.cases.countDocuments({ ...scope, currentStatusId: { $in: terminal } }).exec(),
      this.cases.countDocuments({ ...scope, currentStatusId: { $in: active } }).exec(),
      this.cases
        .countDocuments({
          ...scope,
          currentStatusId: { $in: active },
          deadline: { $ne: null, $lte: cutoffStr },
        })
        .exec(),
    ]);

    return { total, active: activeCount, completed, dueSoon };
  }

  /** Most recent cases for the dashboard feed. */
  async recent(user: AuthenticatedUser, take = 5): Promise<DentalCase[]> {
    const scope: FilterQuery<DentalCase> = {};
    await this.applyScope(scope, user);
    return this.cases
      .find(scope)
      .populate(DETAIL_POPULATE)
      .sort({ submittedAt: -1 })
      .limit(take)
      .exec();
  }
}
