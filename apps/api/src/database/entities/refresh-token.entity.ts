import { Exclude } from 'class-transformer';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

/**
 * One issued refresh token.
 *
 * Rows are kept after they are spent rather than deleted, because a spent token
 * turning up again is the signal that one was stolen — a deleted row is
 * indistinguishable from a token that never existed. `purgeExpired` clears them
 * once they are too old to prove anything.
 */
@Entity('refresh_tokens')
@Index(['userId', 'revokedAt'])
export class RefreshToken extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** SHA-256 of the opaque token. The raw value exists only in the cookie. */
  @Exclude()
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  tokenHash: string;

  /**
   * Every token descended from a single login shares this id. Presenting an
   * already-spent token revokes the whole family, which ends both the thief's
   * session and the victim's — the alternative is leaving an attacker with a
   * valid chain.
   */
  @Index()
  @Column({ type: 'uuid' })
  familyId: string;

  /** Idle expiry. Each rotation moves it forward; inactivity lets it lapse. */
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  /**
   * Ceiling set at login. Rotation never extends it, so an active session still
   * ends on schedule and re-authentication is periodic rather than theoretical.
   */
  @Column({ type: 'timestamptz' })
  absoluteExpiresAt: Date;

  /** Set when spent by rotation, at logout, or by a family-wide revocation. */
  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  /** Recorded for the audit trail — never used to decide whether to accept. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;
}
