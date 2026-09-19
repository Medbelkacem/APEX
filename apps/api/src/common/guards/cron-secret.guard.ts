import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * Authorizes Vercel Cron's HTTP trigger for the jobs @nestjs/schedule's
 * in-process @Cron runs on the Docker/Render process — there is no
 * persistent process on Vercel serverless for that scheduler's timers to
 * fire on, so Vercel Cron calls these routes on the same schedule instead.
 *
 * Vercel signs every cron request with `Authorization: Bearer $CRON_SECRET`
 * when that env var is set (see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
 * Unset CRON_SECRET refuses every request rather than leaving the route
 * silently open — these endpoints trigger real writes (deleting tokens,
 * generating and emailing statements) that must never be reachable by
 * whoever finds the URL.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('CRON_SECRET') ?? '';
    if (!secret) {
      throw new ForbiddenException('Cron endpoints are not configured (CRON_SECRET unset)');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.get('authorization') ?? '';
    const presented = header.startsWith('Bearer ') ? header.slice(7) : '';

    if (!this.matches(`Bearer ${secret}`, `Bearer ${presented}`)) {
      throw new ForbiddenException('Invalid cron secret');
    }
    return true;
  }

  /** Constant-time comparison, so a mismatch cannot be found byte by byte. */
  private matches(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }
}
