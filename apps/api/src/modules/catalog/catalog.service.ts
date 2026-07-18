import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CaseStatus, CaseType, DentalCase } from '../../database/entities';
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
    @InjectRepository(CaseType) private readonly caseTypes: Repository<CaseType>,
    @InjectRepository(CaseStatus) private readonly caseStatuses: Repository<CaseStatus>,
    @InjectRepository(DentalCase) private readonly cases: Repository<DentalCase>,
  ) {}

  // ── Case types ────────────────────────────────────────────────────────────

  listCaseTypes(includeInactive = false): Promise<CaseType[]> {
    return this.caseTypes.find({
      where: includeInactive ? {} : { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findCaseTypeOrFail(id: string): Promise<CaseType> {
    const found = await this.caseTypes.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Case type not found');
    return found;
  }

  async createCaseType(dto: CreateCaseTypeDto): Promise<CaseType> {
    const slug = await this.uniqueSlug(this.caseTypes, slugify(dto.name));
    return this.caseTypes.save(
      this.caseTypes.create({
        name: dto.name,
        slug,
        description: dto.description ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      }),
    );
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
    return this.caseTypes.save(entity);
  }

  /**
   * Soft-delete a case type. Types already referenced by a case are deactivated
   * instead of removed, so historical cases keep a resolvable type.
   */
  async removeCaseType(id: string): Promise<{ deleted: boolean; deactivated: boolean }> {
    await this.findCaseTypeOrFail(id);
    const inUse = await this.cases.count({ where: { caseTypeId: id } });
    if (inUse > 0) {
      await this.caseTypes.update(id, { isActive: false });
      return { deleted: false, deactivated: true };
    }
    await this.caseTypes.softDelete(id);
    return { deleted: true, deactivated: false };
  }

  // ── Workflow statuses ─────────────────────────────────────────────────────

  listStatuses(includeInactive = false): Promise<CaseStatus[]> {
    return this.caseStatuses.find({
      where: includeInactive ? {} : { isActive: true },
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
  }

  async findStatusOrFail(id: string): Promise<CaseStatus> {
    const found = await this.caseStatuses.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Workflow status not found');
    return found;
  }

  async findStatusBySlug(slug: string): Promise<CaseStatus | null> {
    return this.caseStatuses.findOne({ where: { slug } });
  }

  /** The status new cases enter — the lowest-ordered active, non-terminal one. */
  async defaultStatus(): Promise<CaseStatus> {
    const status = await this.caseStatuses.findOne({
      where: { isActive: true, isTerminal: false },
      order: { sortOrder: 'ASC' },
    });
    if (!status) {
      throw new BadRequestException(
        'No active workflow status is configured — an admin must define one first',
      );
    }
    return status;
  }

  async createStatus(dto: CreateCaseStatusDto): Promise<CaseStatus> {
    const slug = await this.uniqueSlug(this.caseStatuses, slugify(dto.label));
    const max = await this.caseStatuses
      .createQueryBuilder('s')
      .select('MAX(s.sortOrder)', 'max')
      .getRawOne<{ max: number | null }>();
    return this.caseStatuses.save(
      this.caseStatuses.create({
        label: dto.label,
        slug,
        color: dto.color ?? '#64748b',
        sortOrder: dto.sortOrder ?? Number(max?.max ?? 0) + 1,
        isTerminal: dto.isTerminal ?? false,
        isActive: dto.isActive ?? true,
      }),
    );
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
        const remaining = await this.caseStatuses.count({
          where: { isActive: true, isTerminal: false },
        });
        if (remaining <= 1) {
          throw new BadRequestException(
            'At least one active, non-terminal status must remain in the workflow',
          );
        }
      }
      entity.isActive = dto.isActive;
    }
    return this.caseStatuses.save(entity);
  }

  /** Persist a new drag-and-drop ordering; ids must cover the listed statuses. */
  async reorderStatuses(ids: string[]): Promise<CaseStatus[]> {
    const found = await this.caseStatuses.find({ where: { id: In(ids) } });
    if (found.length !== ids.length) {
      throw new BadRequestException('Reorder payload references an unknown status');
    }
    await Promise.all(
      ids.map((id, index) => this.caseStatuses.update(id, { sortOrder: index + 1 })),
    );
    return this.listStatuses(true);
  }

  /** Statuses can never be hard-deleted while cases point at them. */
  async removeStatus(id: string): Promise<{ deactivated: boolean }> {
    const status = await this.findStatusOrFail(id);
    const inUse = await this.cases.count({ where: { currentStatusId: id } });
    if (inUse > 0) {
      throw new BadRequestException(
        `${inUse} case(s) are currently in "${status.label}" — move them before removing it`,
      );
    }
    await this.caseStatuses.update(id, { isActive: false });
    return { deactivated: true };
  }

  /** Append -2, -3, … until the slug is free (ignoring the row being updated). */
  private async uniqueSlug<T extends { id: string; slug: string }>(
    repo: Repository<T>,
    base: string,
    excludeId?: string,
  ): Promise<string> {
    let candidate = base;
    for (let n = 2; ; n += 1) {
      const clash = await repo
        .createQueryBuilder('e')
        .withDeleted()
        .where('e.slug = :slug', { slug: candidate })
        .andWhere(excludeId ? 'e.id != :excludeId' : '1=1', { excludeId })
        .getOne();
      if (!clash) return candidate;
      candidate = `${base}-${n}`;
    }
  }
}
