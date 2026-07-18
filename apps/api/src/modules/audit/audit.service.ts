import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities';
import { Paginated, paginate, resolvePagination } from '../../common/utils/pagination';

export interface AuditInput {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/** Records sensitive admin actions to the immutable audit log. */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
  ) {}

  async record(input: AuditInput): Promise<void> {
    await this.repo.save(
      this.repo.create({
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? null,
        ipAddress: input.ipAddress ?? null,
      }),
    );
  }

  /** Read the trail. The log is append-only — there is deliberately no update. */
  async list(query: {
    action?: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<Paginated<AuditLog>> {
    const { skip, take, page, limit } = resolvePagination(query.page, query.limit);
    const qb = this.repo.createQueryBuilder('log');
    if (query.action) qb.andWhere('log.action = :action', { action: query.action });
    if (query.entityType) qb.andWhere('log.entityType = :entityType', { entityType: query.entityType });
    if (query.entityId) qb.andWhere('log.entityId = :entityId', { entityId: query.entityId });
    if (query.userId) qb.andWhere('log.userId = :userId', { userId: query.userId });
    qb.orderBy('log.createdAt', 'DESC').skip(skip).take(take);
    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit);
  }
}
