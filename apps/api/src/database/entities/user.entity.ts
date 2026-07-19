import { Exclude } from 'class-transformer';
import { Column, Entity, Index, OneToMany, OneToOne } from 'typeorm';
import { UserRole, UserStatus } from '@dental/shared-types';
import { SoftDeleteEntity } from './base.entity';
import { Dentist } from './dentist.entity';
import { NotificationEntity } from './notification.entity';

/** Every authenticated account — dentist, admin, or super admin. */
@Entity('users')
export class User extends SoftDeleteEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  /** Nullable while the account is `invited` (password set on first login). */
  @Exclude()
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  passwordHash: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.DENTIST })
  role: UserRole;

  @Column({ type: 'varchar', length: 120 })
  firstName: string;

  @Column({ type: 'varchar', length: 120 })
  lastName: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  // ── Account lockout / brute-force mitigation ──
  @Exclude()
  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Exclude()
  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  // ── Password reset / invitation (single-use, time-limited) ──
  /** SHA-256 hash of the emailed reset/invitation token — raw token never stored. */
  @Exclude()
  @Column({ type: 'varchar', length: 128, nullable: true, select: false })
  passwordResetTokenHash: string | null;

  @Exclude()
  @Column({ type: 'timestamptz', nullable: true, select: false })
  passwordResetExpiresAt: Date | null;

  // ── Email verification (self-registration only) ──
  /**
   * When the account holder proved they control the address. Null on a
   * `pending` account means "unconfirmed"; set means "waiting for the lab to
   * approve". Invited accounts are stamped when they complete first-login
   * setup, since opening an emailed link is the same proof of delivery.
   *
   * Accounts that predate this column keep a null, which asserts nothing either
   * way — only `pending` accounts are gated on it.
   */
  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Exclude()
  @Column({ type: 'varchar', length: 128, nullable: true, select: false })
  emailVerificationTokenHash: string | null;

  @Exclude()
  @Column({ type: 'timestamptz', nullable: true, select: false })
  emailVerificationExpiresAt: Date | null;

  @OneToOne(() => Dentist, (dentist) => dentist.user)
  dentist?: Dentist;

  @OneToMany(() => NotificationEntity, (n) => n.user)
  notifications?: NotificationEntity[];

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }
}
