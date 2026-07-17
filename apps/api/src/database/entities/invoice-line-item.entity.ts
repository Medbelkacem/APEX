import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Invoice } from './invoice.entity';

/** A single line on an invoice. */
@Entity('invoice_line_items')
export class InvoiceLineItem extends BaseEntity {
  @Column({ type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (i) => i.lineItems, { onDelete: 'CASCADE' })
  @JoinColumn()
  invoice: Invoice;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: string;
}
