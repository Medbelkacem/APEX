import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/** Immutable audit trail of sensitive admin actions. */
@Entity('audit_logs')
@Index(['entityType', 'entityId'])
export class AuditLog extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  /** e.g. case.status_changed, dentist.disabled, pricing.updated. */
  @Column({ type: 'varchar', length: 120 })
  action: string;

  @Column({ type: 'varchar', length: 120 })
  entityType: string;

  @Column({ type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;
}
