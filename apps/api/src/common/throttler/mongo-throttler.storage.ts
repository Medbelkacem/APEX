import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Model } from 'mongoose';
import { RateLimitHit } from '../../database/entities';

/** Matches `@nestjs/throttler`'s internal `ThrottlerStorageRecord` shape, which it does not export from its public entry point. */
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/** How long past a bucket's own deadlines to keep it around before the TTL index reaps it. */
const HOUSEKEEPING_GRACE_MS = 60_000;

/**
 * `ThrottlerStorage` backed by MongoDB instead of the in-memory default.
 *
 * The default storage lives in one process's memory, which breaks on
 * anything with more than one live instance — including serverless, where a
 * "warm" instance is just one of however many the platform happens to be
 * running concurrently, each with its own memory. No Redis in this
 * deployment (see docs/DEPLOY-FREE.md), so Mongo is the shared store.
 *
 * This trades the in-memory implementation's per-hit sliding decay (each hit
 * expires on its own timer) for a plain fixed window: hits accumulate until
 * `windowExpiresAt`, then the bucket resets. A timer-per-hit design has
 * nothing to run it between requests in a serverless function anyway.
 * Functionally both still enforce "at most `limit` hits per `ttl`, then
 * blocked for `blockDuration`" — this is the same trade every non-in-memory
 * `ThrottlerStorage` implementation (Redis included) makes.
 */
@Injectable()
export class MongoThrottlerStorage implements ThrottlerStorage {
  constructor(@InjectModel(RateLimitHit.name) private readonly hits: Model<RateLimitHit>) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const now = Date.now();
    const id = `${throttlerName}:${key}`;

    const existing = await this.hits.findById(id).lean().exec();
    const blockLapsed = Boolean(
      existing?.isBlocked && (!existing.blockExpiresAt || existing.blockExpiresAt.getTime() <= now),
    );

    // Already blocked, and the block has not lapsed — no new hit is counted.
    if (existing?.isBlocked && !blockLapsed) {
      return {
        totalHits: existing.hits,
        timeToExpire: this.secondsUntil(existing.windowExpiresAt, now),
        isBlocked: true,
        timeToBlockExpire: this.secondsUntil(existing.blockExpiresAt!, now),
      };
    }

    // No bucket yet, its window lapsed, or its block just lapsed: start a
    // fresh cycle — a lapsed block resets the count even mid-window, or a
    // caller would stay stuck re-blocked until the (usually much longer)
    // window itself expires instead of getting a clean slate right away.
    const windowExpired = !existing || existing.windowExpiresAt.getTime() <= now;
    const freshStart = windowExpired || blockLapsed;
    const windowExpiresAt = freshStart ? new Date(now + ttl) : existing!.windowExpiresAt;
    const expireAt = new Date(
      Math.max(windowExpiresAt.getTime(), now + blockDuration) + HOUSEKEEPING_GRACE_MS,
    );

    const updated = await this.hits
      .findOneAndUpdate(
        { _id: id },
        freshStart
          ? { $set: { hits: 1, windowExpiresAt, isBlocked: false, blockExpiresAt: null, expireAt } }
          : { $inc: { hits: 1 }, $set: { expireAt } },
        { upsert: true, new: true },
      )
      .lean()
      .exec();

    if (updated.hits <= limit) {
      return {
        totalHits: updated.hits,
        timeToExpire: this.secondsUntil(windowExpiresAt, now),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    // Over the limit on this hit: block it, independent of the request window.
    const blockExpiresAt = new Date(now + blockDuration);
    await this.hits
      .updateOne(
        { _id: id },
        {
          $set: {
            isBlocked: true,
            blockExpiresAt,
            expireAt: new Date(blockExpiresAt.getTime() + HOUSEKEEPING_GRACE_MS),
          },
        },
      )
      .exec();

    return {
      totalHits: updated.hits,
      timeToExpire: this.secondsUntil(windowExpiresAt, now),
      isBlocked: true,
      timeToBlockExpire: this.secondsUntil(blockExpiresAt, now),
    };
  }

  private secondsUntil(date: Date, now: number): number {
    return Math.max(0, Math.ceil((date.getTime() - now) / 1000));
  }
}
