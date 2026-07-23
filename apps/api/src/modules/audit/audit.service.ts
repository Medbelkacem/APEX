import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
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
    @InjectModel(AuditLog.name) private readonly repo: Model<AuditLog>,
  ) {}

  async record(input: AuditInput): Promise<void> {
    await this.repo.create({
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
      ipAddress: input.ipAddress ?? null,
    });
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
    const filter: FilterQuery<AuditLog> = {};
    if (query.action) filter.action = query.action;
    if (query.entityType) filter.entityType = query.entityType;
    if (query.entityId) filter.entityId = query.entityId;
    if (query.userId) filter.userId = query.userId;

    const [data, total] = await Promise.all([
      this.repo.find(filter).sort({ createdAt: -1 }).skip(skip).limit(take).exec(),
      this.repo.countDocuments(filter).exec(),
    ]);
    return paginate(data, total, page, limit);
  }
}
