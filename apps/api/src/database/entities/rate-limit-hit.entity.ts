import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * One rate-limit bucket, keyed `<throttlerName>:<tracker>` (e.g. an IP or
 * user id). Backs `MongoThrottlerStorage` — see its class comment for why
 * this exists instead of the in-memory default.
 */
@Schema({ collection: 'rate_limit_hits', versionKey: false })
export class RateLimitHit {
  @Prop({ type: String })
  _id: string;

  @Prop({ type: Number, default: 0 })
  hits: number;

  /** End of the current fixed window; a hit past this starts a fresh one. */
  @Prop({ type: Date, required: true })
  windowExpiresAt: Date;

  @Prop({ type: Boolean, default: false })
  isBlocked: boolean;

  @Prop({ type: Date, default: null })
  blockExpiresAt: Date | null;

  /**
   * Housekeeping only — a TTL index that removes an abandoned bucket once
   * both its window and any block are long over. Never read to decide
   * whether a request is throttled; `increment()` compares the timestamps
   * above against the current time for that.
   */
  @Prop({ type: Date, required: true })
  expireAt: Date;
}

export type RateLimitHitDocument = HydratedDocument<RateLimitHit>;
export const RateLimitHitSchema = SchemaFactory.createForClass(RateLimitHit);

RateLimitHitSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
