import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@dental/shared-types';

export const ROLES_KEY = 'roles';

/** Restrict a route/controller to one or more roles. Enforced by RolesGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
