import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { DentalCase } from './case.entity';
import { CaseStatus } from './case-status.entity';
import { User } from './user.entity';

/** Append-only log of a case's status transitions. */
@Entity('case_status_history')
export class CaseStatusHistory extends BaseEntity {
  @Column({ type: 'uuid' })
  caseId: string;

  @ManyToOne(() => DentalCase, (c) => c.statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn()
  case: DentalCase;

  @Column({ type: 'uuid' })
  caseStatusId: string;

  @ManyToOne(() => CaseStatus, { onDelete: 'RESTRICT' })
  @JoinColumn()
  caseStatus: CaseStatus;

  @Column({ type: 'uuid', nullable: true })
  changedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn()
  changedByUser: User | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
