import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { InvoiceStatus } from '@dental/shared-types';
import { SoftDeleteEntity } from './base.entity';
import { Dentist } from './dentist.entity';
import { DentalCase } from './case.entity';
import { InvoiceLineItem } from './invoice-line-item.entity';

/** An invoice issued to a dentist, per case or as a batch. */
@Entity('invoices')
export class Invoice extends SoftDeleteEntity {
  /** Sequential, e.g. INV-2026-0001. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  number: string;

  @Column({ type: 'uuid' })
  dentistId: string;

  @ManyToOne(() => Dentist, (d) => d.invoices, { onDelete: 'RESTRICT' })
  @JoinColumn()
  dentist: Dentist;

  /** null for batch invoices spanning multiple cases. */
  @Column({ type: 'uuid', nullable: true })
  caseId: string | null;

  @ManyToOne(() => DentalCase, (c) => c.invoices, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn()
  case: DentalCase | null;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  issueDate: string;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tax: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total: string;

  @Column({ type: 'varchar', length: 3, default: 'DZD' })
  currency: string;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  /** Cached PDF path on the storage backend. */
  @Column({ type: 'varchar', length: 512, nullable: true })
  pdfPath: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripePaymentIntentId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @OneToMany(() => InvoiceLineItem, (li) => li.invoice, { cascade: true })
  lineItems?: InvoiceLineItem[];
}
