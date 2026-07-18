import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteEntity } from './base.entity';
import { CaseType } from './case-type.entity';

/** Price for a case type, optionally scoped to a dentist tier / material. */
@Entity('pricing_rules')
export class PricingRule extends SoftDeleteEntity {
  @Column({ type: 'uuid' })
  caseTypeId: string;

  @ManyToOne(() => CaseType, { onDelete: 'CASCADE' })
  @JoinColumn()
  caseType: CaseType;

  /** null = default price for the case type. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  dentistTier: string | null;

  /** Optional surcharge scope by material. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  material: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: string;

  @Column({ type: 'varchar', length: 3, default: 'DZD' })
  currency: string;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  effectiveFrom: string;

  @Column({ type: 'date', nullable: true })
  effectiveTo: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
