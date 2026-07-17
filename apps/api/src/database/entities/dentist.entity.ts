import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { SoftDeleteEntity } from './base.entity';
import { User } from './user.entity';
import { DentalCase } from './case.entity';
import { Invoice } from './invoice.entity';
import { MonthlyStatement } from './monthly-statement.entity';

/** Profile data specific to a dentist user. 1-to-1 with User. */
@Entity('dentists')
export class Dentist extends SoftDeleteEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @OneToOne(() => User, (user) => user.dentist, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ type: 'varchar', length: 255, nullable: true })
  clinicName: string | null;

  @Column({ type: 'text', nullable: true })
  clinicAddress: string | null;

  @Column({ type: 'text', nullable: true })
  billingAddress: string | null;

  /** Pricing tier — optional, referenced by PricingRule.dentistTier. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  tier: string | null;

  /** Internal, lab-only notes. */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => DentalCase, (c) => c.dentist)
  cases?: DentalCase[];

  @OneToMany(() => Invoice, (i) => i.dentist)
  invoices?: Invoice[];

  @OneToMany(() => MonthlyStatement, (s) => s.dentist)
  statements?: MonthlyStatement[];
}
