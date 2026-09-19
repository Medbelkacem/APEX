import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronSecretGuard } from './cron-secret.guard';

function contextWithAuthHeader(header: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ get: (name: string) => (name === 'authorization' ? header : undefined) }),
    }),
  } as unknown as ExecutionContext;
}

function guardWithSecret(secret: string | undefined): CronSecretGuard {
  const config = { get: () => secret } as unknown as ConfigService;
  return new CronSecretGuard(config);
}

describe('CronSecretGuard', () => {
  it('refuses every request when CRON_SECRET is unset, rather than leaving the route open', () => {
    const guard = guardWithSecret(undefined);
    expect(() => guard.canActivate(contextWithAuthHeader('Bearer anything'))).toThrow(
      ForbiddenException,
    );
  });

  it('accepts the exact configured secret', () => {
    const guard = guardWithSecret('correct-horse-battery-staple');
    expect(guard.canActivate(contextWithAuthHeader('Bearer correct-horse-battery-staple'))).toBe(
      true,
    );
  });

  it('rejects a wrong secret', () => {
    const guard = guardWithSecret('correct-horse-battery-staple');
    expect(() => guard.canActivate(contextWithAuthHeader('Bearer wrong'))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a missing Authorization header', () => {
    const guard = guardWithSecret('correct-horse-battery-staple');
    expect(() => guard.canActivate(contextWithAuthHeader(undefined))).toThrow(ForbiddenException);
  });

  it('rejects a header with no Bearer prefix', () => {
    const guard = guardWithSecret('correct-horse-battery-staple');
    expect(() => guard.canActivate(contextWithAuthHeader('correct-horse-battery-staple'))).toThrow(
      ForbiddenException,
    );
  });
});
