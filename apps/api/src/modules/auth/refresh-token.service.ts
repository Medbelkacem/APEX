import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { ClientSession, Connection, Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { UserStatus } from '@dental/shared-types';
import { RefreshToken, User } from '../../database/entities';
import { runInTransaction } from '../../database/base.schema';
import { AuthConfig } from '../../config/auth.config';
import { generateToken, hashToken } from '../../common/utils/tokens';

/** Where a token was presented from, recorded for the audit trail. */
export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface IssuedRefreshToken {
  /** The raw token — returned once, to be put in the cookie, and never stored. */
  raw: string;
  expiresAt: Date;
}

/**
 * Refresh-token issuance, rotation, and revocation.
 *
 * Refresh tokens are opaque random strings rather than JWTs. A JWT is valid
 * because it verifies, which makes revoking one before it expires impossible
 * without a server-side list anyway; if the list is unavoidable, the token may
 * as well be a plain lookup key. Only the SHA-256 is persisted, so a leaked
 * database backup does not hand over live sessions.
 *
 * Every token is single-use. Rotation spends the presented token and issues a
 * successor in the same family, which is what makes theft detectable: a token
 * that is used twice was held by two parties.
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectModel(RefreshToken.name) private readonly tokens: Model<RefreshToken>,
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService,
  ) {}

  private get authCfg(): AuthConfig {
    return this.config.get<AuthConfig>('auth')!;
  }

  private idleExpiry(from: Date = new Date()): Date {
    return new Date(from.getTime() + this.authCfg.sessionIdleTtl * 1000);
  }

  /** Begin a new session family. Called on login, never on rotation. */
  async issue(userId: string, ctx: RequestContext = {}): Promise<IssuedRefreshToken> {
    const now = new Date();
    return this.persist({
      userId,
      familyId: randomUUID(),
      absoluteExpiresAt: new Date(now.getTime() + this.authCfg.refreshTtl * 1000),
      ctx,
    });
  }

  /**
   * Spend a refresh token and issue its successor.
   *
   * Every rejection here is the same `UnauthorizedException`: the client's only
   * useful response to any of them is to log in again, and distinguishing
   * "expired" from "revoked" from "never existed" would tell someone probing
   * with stolen tokens which of them were once real.
   */
  async rotate(
    rawToken: string,
    ctx: RequestContext = {},
  ): Promise<{ token: IssuedRefreshToken; user: User }> {
    const existing = await this.tokens.findOne({ tokenHash: hashToken(rawToken) }).populate('user').exec();

    if (!existing) throw new UnauthorizedException('Session expired — please sign in again');

    const now = new Date();

    // A spent token presented again means two parties hold it, and which one is
    // the thief is unknowable — so the whole family goes. Unless it is merely a
    // race, which is common enough to be worth distinguishing.
    if (existing.revokedAt && !(await this.isConcurrentRotation(existing.id, now))) {
      this.logger.warn(
        `Refresh token reuse detected for user ${existing.userId}; revoking session family ${existing.familyId}`,
      );
      await this.revokeFamily(existing.familyId);
      throw new UnauthorizedException('Session expired — please sign in again');
    }

    if (existing.expiresAt <= now || existing.absoluteExpiresAt <= now) {
      await this.revokeFamily(existing.familyId);
      throw new UnauthorizedException('Session expired — please sign in again');
    }

    // A soft-deleted user does not populate, so a missing user here is either a
    // deleted account or a dangling token — both end the session.
    const user = existing.user;
    if (!user) {
      await this.revokeFamily(existing.familyId);
      throw new UnauthorizedException('Session expired — please sign in again');
    }
    if (user.status === UserStatus.DISABLED) {
      // Disabling an account has to end its live sessions, not merely stop new
      // logins — otherwise a disabled user keeps working for the session's life.
      await this.revokeAllForUser(user.id);
      throw new UnauthorizedException('This account has been disabled');
    }

    const successor = {
      userId: user.id,
      familyId: existing.familyId,
      // Carried over, not recomputed: rotation must not extend the ceiling.
      absoluteExpiresAt: existing.absoluteExpiresAt,
      ctx,
    };

    /*
     * Spending the token and issuing its successor have to commit together.
     *
     * Two refreshes racing on one token both read it unrevoked, and the
     * conditional update lets only one through. The loser then has to decide
     * whether it raced or is a replay, and it answers that by looking for a
     * live token in the family — which only exists once the winner's successor
     * is committed. Inside one transaction there is no gap: by the time the
     * loser's update reports zero rows, the successor is already visible.
     */
    const issued = await runInTransaction(this.connection, async (session) => {
      if (!existing.revokedAt) {
        const spent = await this.tokens
          .updateOne({ _id: existing.id, revokedAt: null }, { revokedAt: now }, { session })
          .exec();
        if (spent.modifiedCount !== 1) return null;
      }
      return this.persist(successor, session);
    });

    if (issued) return { token: issued, user };

    // Lost the race. Same question as above, now with the winner committed.
    if (!(await this.isConcurrentRotation(existing.id, now))) {
      this.logger.warn(
        `Refresh token reuse detected for user ${existing.userId}; revoking session family ${existing.familyId}`,
      );
      await this.revokeFamily(existing.familyId);
      throw new UnauthorizedException('Session expired — please sign in again');
    }

    return { token: await this.persist(successor), user };
  }

  /**
   * Whether a spent token is being replayed by a request that merely raced the
   * one that spent it, rather than by a second holder.
   */
  private async isConcurrentRotation(tokenId: string, now: Date): Promise<boolean> {
    const fresh = await this.tokens.findById(tokenId).exec();
    if (!fresh?.revokedAt) return false;

    const elapsedMs = now.getTime() - fresh.revokedAt.getTime();
    if (elapsedMs > this.authCfg.refreshReuseLeeway * 1000) return false;

    const liveInFamily = await this.tokens
      .countDocuments({ familyId: fresh.familyId, revokedAt: null })
      .exec();
    return liveInFamily > 0;
  }

  /** Revoke a single token — the logout path. Unknown tokens are ignored. */
  async revoke(rawToken: string): Promise<void> {
    await this.tokens
      .updateOne({ tokenHash: hashToken(rawToken), revokedAt: null }, { revokedAt: new Date() })
      .exec();
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.tokens.updateMany({ familyId, revokedAt: null }, { revokedAt: new Date() }).exec();
  }

  /**
   * End every session a user has. Used when the password changes or is reset,
   * and when an account is disabled — the point of changing a password after a
   * compromise is that whoever else had it is logged out.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.tokens.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() }).exec();
  }

  /**
   * Drop rows that can no longer prove anything.
   *
   * Spent tokens are deliberately retained so reuse stays detectable, so this
   * deletes on the absolute ceiling rather than on `revokedAt`: past it, no
   * token in the family could be accepted regardless.
   */
  async purgeExpired(): Promise<number> {
    const result = await this.tokens.deleteMany({ absoluteExpiresAt: { $lt: new Date() } }).exec();
    return result.deletedCount ?? 0;
  }

  private async persist(
    input: {
      userId: string;
      familyId: string;
      absoluteExpiresAt: Date;
      ctx: RequestContext;
    },
    session?: ClientSession,
  ): Promise<IssuedRefreshToken> {
    const { raw, hash } = generateToken();
    // The idle window is capped by the absolute ceiling, so a token can never
    // outlive the session that produced it.
    const idle = this.idleExpiry();
    const expiresAt = idle < input.absoluteExpiresAt ? idle : input.absoluteExpiresAt;

    await this.tokens.create(
      [
        {
          userId: input.userId,
          tokenHash: hash,
          familyId: input.familyId,
          expiresAt,
          absoluteExpiresAt: input.absoluteExpiresAt,
          revokedAt: null,
          ipAddress: input.ctx.ipAddress ?? null,
          userAgent: input.ctx.userAgent?.slice(0, 255) ?? null,
        },
      ],
      { session },
    );

    return { raw, expiresAt };
  }
}
