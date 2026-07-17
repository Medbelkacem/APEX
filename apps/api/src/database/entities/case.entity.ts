import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { SoftDeleteEntity } from './base.entity';
import { Dentist } from './dentist.entity';
import { CaseType } from './case-type.entity';
import { CaseStatus } from './case-status.entity';
import { CaseFile } from './case-file.entity';
import { CaseStatusHistory } from './case-status-history.entity';
import { Invoice } from './invoice.entity';

/** A dental case submitted by a dentist. */
@Entity('cases')
export class DentalCase extends SoftDeleteEntity {
  /** Human-readable reference, e.g. CASE-2026-0001. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  reference: string;

  @Column({ type: 'uuid' })
  dentistId: string;

  @ManyToOne(() => Dentist, (d) => d.cases, { onDelete: 'RESTRICT' })
  @JoinColumn()
  dentist: Dentist;

  @Column({ type: 'uuid' })
  caseTypeId: string;

  @ManyToOne(() => CaseType, (t) => t.cases, { onDelete: 'RESTRICT' })
  @JoinColumn()
  caseType: CaseType;

  /** Anonymized patient label — no PHI beyond what the workflow needs. */
  @Column({ type: 'varchar', length: 120 })
  patientReference: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  toothRegion: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  material: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  shade: string | null;

  @Column({ type: 'date', nullable: true })
  deadline: string | null;

  @Column({ type: 'text', nullable: true })
  clinicalNotes: string | null;

  @Column({ type: 'uuid' })
  currentStatusId: string;

  @ManyToOne(() => CaseStatus, (s) => s.cases, { onDelete: 'RESTRICT' })
  @JoinColumn()
  currentStatus: CaseStatus;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  submittedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @OneToMany(() => CaseFile, (f) => f.case)
  files?: CaseFile[];

  @OneToMany(() => CaseStatusHistory, (h) => h.case)
  statusHistory?: CaseStatusHistory[];

  @OneToMany(() => Invoice, (i) => i.case)
  invoices?: Invoice[];
}
