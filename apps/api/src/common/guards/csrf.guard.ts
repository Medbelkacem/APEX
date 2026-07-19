import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { AppConfig } from '../../config/app.config';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator';

/** Methods that cannot change state, and so cannot be abused by forgery. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Cross-site request forgery protection, in two independent layers.
 *
 * The session rides in a cookie, which the browser attaches to requests the
 * user never intended to make. `SameSite=lax` already blocks the common form of
 * that, but it is a single control implemented by the browser, and it does not
 * help against a same-site attacker (a compromised sibling subdomain).
 *
 * First layer: a stated origin must be one we allow. Browsers send `Origin` on
 * every state-changing request, so a forged one announces itself. An absent
 * `Origin` is not treated as failure — non-browser clients (curl, a mobile app,
 * a server-to-server call) omit it, and those are not susceptible to CSRF in
 * the first place, since nothing is attaching a victim's cookies for them.
 *
 * Second layer: double-submit. When the caller holds a CSRF cookie it must echo
 * it in a header. A forged request carries the victim's cookies — that is the
 * whole mechanism — but same-origin policy stops the attacker from reading them
 * to construct the header, so the echo is what they cannot forge.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  private get allowedOrigins(): string[] {
    return this.config.get<AppConfig>('app')!.corsOrigins;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    this.assertOriginAllowed(request);
    this.assertTokenEchoed(request);
    return true;
  }

  private assertOriginAllowed(request: Request): void {
    const stated = request.get('origin') ?? this.originOf(request.get('referer'));
    // Absent is not a failure — see the class comment.
    if (!stated) return;

    if (!this.allowedOrigins.includes(stated)) {
      throw new ForbiddenException('Request blocked: origin not allowed');
    }
  }

  private assertTokenEchoed(request: Request): void {
    const cookie = (request.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE];
    // No cookie means no browser session to forge against. Clients that
    // authenticate by bearer token cannot be attacked this way, so requiring an
    // echo of something they were never given would only lock them out.
    if (!cookie) return;

    const header = request.get(CSRF_HEADER);
    if (!header || !this.matches(cookie, header)) {
      throw new ForbiddenException('Request blocked: CSRF token missing or invalid');
    }
  }

  /** Constant-time comparison, so a mismatch cannot be found byte by byte. */
  private matches(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }

  /** The scheme+host+port of a Referer, or undefined if it is unparseable. */
  private originOf(referer: string | undefined): string | undefined {
    if (!referer) return undefined;
    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }
}
