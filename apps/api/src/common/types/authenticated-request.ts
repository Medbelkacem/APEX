import { Request } from 'express';
import { AuthenticatedUser, UserRole } from '@dental/shared-types';

/** Express request after the JwtAuthGuard has attached the principal. */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/** Claims embedded in the signed access token. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}
