import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Key/value store for global platform configuration (secrets encrypted). */
@Entity('platform_settings')
export class PlatformSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** e.g. stripe.secret_key, smtp.host. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 160 })
  key: string;

  /** Text; encrypted at rest for secret keys. */
  @Column({ type: 'text', nullable: true })
  value: string | null;

  /** Whether `value` is stored encrypted (redacted when listed via the API). */
  @Column({ type: 'boolean', default: false })
  isSecret: boolean;

  @Column({ type: 'uuid', nullable: true })
  updatedByUserId: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
