import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseDocument, baseSchemaOptions } from '../base.schema';
import { User } from './user.entity';

/**
 * One issued refresh token.
 *
 * Rows are kept after they are spent rather than deleted, because a spent token
 * turning up again is the signal that one was stolen — a deleted row is
 * indistinguishable from a token that never existed. `purgeExpired` clears them
 * once they are too old to prove anything.
 */
@Schema(baseSchemaOptions('refresh_tokens', ['tokenHash']))
export class RefreshToken extends BaseDocument {
  @Prop({ type: String, ref: 'User', required: true })
  userId: string;

  /** SHA-256 of the opaque token. The raw value exists only in the cookie. */
  @Prop({ type: String, required: true, unique: true })
  tokenHash: string;

  /**
   * Every token descended from a single login shares this id. Presenting an
   * already-spent token revokes the whole family, which ends both the thief's
   * session and the victim's.
   */
  @Prop({ type: String, required: true })
  familyId: string;

  /** Idle expiry. Each rotation moves it forward; inactivity lets it lapse. */
  @Prop({ type: Date, required: true })
  expiresAt: Date;

  /** Ceiling set at login. Rotation never extends it. */
  @Prop({ type: Date, required: true })
  absoluteExpiresAt: Date;

  /** Set when spent by rotation, at logout, or by a family-wide revocation. */
  @Prop({ type: Date, default: null })
  revokedAt: Date | null;

  /** Recorded for the audit trail — never used to decide whether to accept. */
  @Prop({ type: String, default: null })
  ipAddress: string | null;

  @Prop({ type: String, default: null })
  userAgent: string | null;

  declare user?: User;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

RefreshTokenSchema.index({ userId: 1 });
RefreshTokenSchema.index({ familyId: 1 });
RefreshTokenSchema.index({ userId: 1, revokedAt: 1 });
RefreshTokenSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});
