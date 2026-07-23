import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole, UserStatus } from '@dental/shared-types';
import { SoftDeleteDocument, applySoftDelete, baseSchemaOptions } from '../base.schema';

/** Secret/internal fields stripped from every serialized user. */
const HIDDEN = [
  'passwordHash',
  'passwordResetTokenHash',
  'passwordResetExpiresAt',
  'emailVerificationTokenHash',
  'emailVerificationExpiresAt',
  'failedLoginAttempts',
  'lockedUntil',
] as const;

/** Every authenticated account — dentist, admin, or super admin. */
@Schema(baseSchemaOptions('users', HIDDEN))
export class User extends SoftDeleteDocument {
  @Prop({ type: String, required: true, unique: true })
  email: string;

  /** Nullable while the account is `invited` (password set on first login). */
  @Prop({ type: String, default: null, select: false })
  passwordHash: string | null;

  @Prop({ type: String, enum: Object.values(UserRole), default: UserRole.DENTIST })
  role: UserRole;

  @Prop({ type: String, required: true })
  firstName: string;

  @Prop({ type: String, required: true })
  lastName: string;

  @Prop({ type: String, default: null })
  phone: string | null;

  @Prop({ type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE })
  status: UserStatus;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;

  // ── Account lockout / brute-force mitigation ──
  @Prop({ type: Number, default: 0 })
  failedLoginAttempts: number;

  @Prop({ type: Date, default: null })
  lockedUntil: Date | null;

  // ── Password reset / invitation (single-use, time-limited) ──
  /** SHA-256 hash of the emailed reset/invitation token — raw token never stored. */
  @Prop({ type: String, default: null, select: false })
  passwordResetTokenHash: string | null;

  @Prop({ type: Date, default: null, select: false })
  passwordResetExpiresAt: Date | null;

  // ── Email verification (self-registration only) ──
  /**
   * When the account holder proved they control the address. Null on a
   * `pending` account means "unconfirmed"; set means "waiting for the lab to
   * approve". Invited accounts are stamped when they complete first-login setup.
   */
  @Prop({ type: Date, default: null })
  emailVerifiedAt: Date | null;

  @Prop({ type: String, default: null, select: false })
  emailVerificationTokenHash: string | null;

  @Prop({ type: Date, default: null, select: false })
  emailVerificationExpiresAt: Date | null;

  // Populated virtuals (see below) — declared for typing only.
  declare dentist?: import('./dentist.entity').Dentist;
  declare notifications?: import('./notification.entity').NotificationEntity[];
  declare fullName: string;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
applySoftDelete(UserSchema);

UserSchema.virtual('fullName').get(function (this: User): string {
  return `${this.firstName} ${this.lastName}`.trim();
});
UserSchema.virtual('dentist', {
  ref: 'Dentist',
  localField: '_id',
  foreignField: 'userId',
  justOne: true,
});
UserSchema.virtual('notifications', {
  ref: 'NotificationEntity',
  localField: '_id',
  foreignField: 'userId',
});
