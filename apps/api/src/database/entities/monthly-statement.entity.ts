import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Dentist } from './dentist.entity';

/** A per-dentist, per-month statement aggregating invoices for the period. */
@Entity('monthly_statements')
@Index(['dentistId', 'periodYear', 'periodMonth'], { unique: true })
export class MonthlyStatement extends BaseEntity {
  @Column({ type: 'uuid' })
  dentistId: string;

  @ManyToOne(() => Dentist, (d) => d.statements, { onDelete: 'CASCADE' })
  @JoinColumn()
  dentist: Dentist;

  @Column({ type: 'int' })
  periodYear: number;

  /** 1–12. */
  @Column({ type: 'int' })
  periodMonth: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  openingBalance: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  closingBalance: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalInvoiced: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalPaid: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  pdfPath: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;
}
