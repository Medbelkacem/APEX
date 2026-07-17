import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '@dental/shared-types';
import { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Inject the authenticated principal (or a single field of it):
 *   @CurrentUser() user: AuthenticatedUser
 *   @CurrentUser('id') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;
    return data ? user?.[data] : user;
  },
);
