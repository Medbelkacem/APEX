import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { DentalCase } from './case.entity';

/** A configurable workflow status a case can move through. */
@Entity('case_statuses')
export class CaseStatus extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  label: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 140 })
  slug: string;

  /** Hex color for UI badges, e.g. #2563eb. */
  @Column({ type: 'varchar', length: 9, default: '#64748b' })
  color: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  /** Terminal statuses end the workflow (e.g. Completed, Cancelled). */
  @Column({ type: 'boolean', default: false })
  isTerminal: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => DentalCase, (c) => c.currentStatus)
  cases?: DentalCase[];
}
