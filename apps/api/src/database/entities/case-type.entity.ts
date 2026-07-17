import { Column, Entity, Index, OneToMany } from 'typeorm';
import { SoftDeleteEntity } from './base.entity';
import { DentalCase } from './case.entity';

/** Catalog of dental case types (Crown, Bridge, Implant, ...). */
@Entity('case_types')
export class CaseType extends SoftDeleteEntity {
  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 140 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => DentalCase, (c) => c.caseType)
  cases?: DentalCase[];
}
