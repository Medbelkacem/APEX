import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CaseStatus,
  CaseStatusDocument,
  CaseType,
  CaseTypeDocument,
  DentalCase,
} from '../../database/entities';
import { slugify } from '../../common/utils/slugify';
import {
  CreateCaseStatusDto,
  CreateCaseTypeDto,
  UpdateCaseStatusDto,
  UpdateCaseTypeDto,
} from './catalog.dto';

/**
 * Reference data behind the case workflow: the case-type catalog (also powering
 * the public Services page) and the admin-configurable workflow statuses.
 */
@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(CaseType.name) private readonly caseTypes: Model<CaseType>,
    @InjectModel(CaseStatus.name) private readonly caseStatuses: Model<CaseStatus>,
    @InjectModel(DentalCase.name) private readonly cases: Model<DentalCase>,
  ) {}

  // ── Case types ────────────────────────────────────────────────────────────

  listCaseTypes(includeInactive = false): Promise<CaseType[]> {
    return this.caseTypes
      .find(includeInactive ? {} : { isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }

  async findCaseTypeOrFail(id: string): Promise<CaseTypeDocument> {
    const found = await this.caseTypes.findById(id).exec();
    if (!found) throw new NotFoundException('Case type not found');
    return found;
  }

  async createCaseType(dto: CreateCaseTypeDto): Promise<CaseType> {
    const slug = await this.uniqueSlug(this.caseTypes, slugify(dto.name));
    return this.caseTypes.create({
      name: dto.name,
      slug,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async updateCaseType(id: string, dto: UpdateCaseTypeDto): Promise<CaseType> {
    const entity = await this.findCaseTypeOrFail(id);
    if (dto.name !== undefined && dto.name !== entity.name) {
      entity.name = dto.name;
      entity.slug = await this.uniqueSlug(this.caseTypes, slugify(dto.name), id);
    }
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.isActive !== undefined) entity.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) entity.sortOrder = dto.sortOrder;
    return entity.save();
  }

  /**
   * Soft-delete a case type. Types already referenced by a case are deactivated
   * instead of removed, so historical cases keep a resolvable type.
   */
  async removeCaseType(id: string): Promise<{ deleted: boolean; deactivated: boolean }> {
    await this.findCaseTypeOrFail(id);
    const inUse = await this.cases.countDocuments({ caseTypeId: id }).exec();
    if (inUse > 0) {
      await this.caseTypes.updateOne({ _id: id }, { isActive: false }).exec();
      return { deleted: false, deactivated: true };
    }
    await this.caseTypes.updateOne({ _id: id }, { deletedAt: new Date() }).exec();
    return { deleted: true, deactivated: false };
  }

  // ── Workflow statuses ─────────────────────────────────────────────────────

  listStatuses(includeInactive = false): Promise<CaseStatus[]> {
    return this.caseStatuses
      .find(includeInactive ? {} : { isActive: true })
      .sort({ sortOrder: 1, label: 1 })
      .exec();
  }

  async findStatusOrFail(id: string): Promise<CaseStatusDocument> {
    const found = await this.caseStatuses.findById(id).exec();
    if (!found) throw new NotFoundException('Workflow status not found');
    return found;
  }

  async findStatusBySlug(slug: string): Promise<CaseStatus | null> {
    return this.caseStatuses.findOne({ slug }).exec();
  }

  /** The status new cases enter — the lowest-ordered active, non-terminal one. */
  async defaultStatus(): Promise<CaseStatus> {
    const status = await this.caseStatuses
      .findOne({ isActive: true, isTerminal: false })
      .sort({ sortOrder: 1 })
      .exec();
    if (!status) {
      throw new BadRequestException(
        'No active workflow status is configured — an admin must define one first',
      );
    }
    return status;
  }

  async createStatus(dto: CreateCaseStatusDto): Promise<CaseStatus> {
    const slug = await this.uniqueSlug(this.caseStatuses, slugify(dto.label));
    const highest = await this.caseStatuses.findOne().sort({ sortOrder: -1 }).exec();
    return this.caseStatuses.create({
      label: dto.label,
      slug,
      color: dto.color ?? '#64748b',
      sortOrder: dto.sortOrder ?? (highest?.sortOrder ?? 0) + 1,
      isTerminal: dto.isTerminal ?? false,
      isActive: dto.isActive ?? true,
    });
  }

  async updateStatus(id: string, dto: UpdateCaseStatusDto): Promise<CaseStatus> {
    const entity = await this.findStatusOrFail(id);
    if (dto.label !== undefined && dto.label !== entity.label) {
      entity.label = dto.label;
      entity.slug = await this.uniqueSlug(this.caseStatuses, slugify(dto.label), id);
    }
    if (dto.color !== undefined) entity.color = dto.color;
    if (dto.sortOrder !== undefined) entity.sortOrder = dto.sortOrder;
    if (dto.isTerminal !== undefined) entity.isTerminal = dto.isTerminal;
    if (dto.isActive !== undefined) {
      // Never leave the workflow without an entry point for new cases.
      if (!dto.isActive && !entity.isTerminal) {
        const remaining = await this.caseStatuses
          .countDocuments({ isActive: true, isTerminal: false })
          .exec();
        if (remaining <= 1) {
          throw new BadRequestException(
            'At least one active, non-terminal status must remain in the workflow',
          );
        }
      }
      entity.isActive = dto.isActive;
    }
    return entity.save();
  }

  /** Persist a new drag-and-drop ordering; ids must cover the listed statuses. */
  async reorderStatuses(ids: string[]): Promise<CaseStatus[]> {
    const found = await this.caseStatuses.countDocuments({ _id: { $in: ids } }).exec();
    if (found !== ids.length) {
      throw new BadRequestException('Reorder payload references an unknown status');
    }
    await Promise.all(
      ids.map((id, index) => this.caseStatuses.updateOne({ _id: id }, { sortOrder: index + 1 }).exec()),
    );
    return this.listStatuses(true);
  }

  /** Statuses can never be hard-deleted while cases point at them. */
  async removeStatus(id: string): Promise<{ deactivated: boolean }> {
    const status = await this.findStatusOrFail(id);
    const inUse = await this.cases.countDocuments({ currentStatusId: id }).exec();
    if (inUse > 0) {
      throw new BadRequestException(
        `${inUse} case(s) are currently in "${status.label}" — move them before removing it`,
      );
    }
    await this.caseStatuses.updateOne({ _id: id }, { isActive: false }).exec();
    return { deactivated: true };
  }

  /** Append -2, -3, … until the slug is free (ignoring the row being updated). */
  private async uniqueSlug(
    repo: Model<CaseType> | Model<CaseStatus>,
    base: string,
    excludeId?: string,
  ): Promise<string> {
    let candidate = base;
    for (let n = 2; ; n += 1) {
      const filter: Record<string, unknown> = { slug: candidate };
      if (excludeId) filter._id = { $ne: excludeId };
      // withDeleted so a soft-deleted row's slug is still treated as taken.
      const clash = await (repo as Model<CaseType>)
        .findOne(filter)
        .setOptions({ withDeleted: true })
        .exec();
      if (!clash) return candidate;
      candidate = `${base}-${n}`;
    }
  }
}
