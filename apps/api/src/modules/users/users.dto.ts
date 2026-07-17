import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { UserRole, UserStatus } from '@dental/shared-types';

/** Staff roles that can be created via the Users API (dentists use Dentists API). */
const staffRole = z.enum([UserRole.ADMIN, UserRole.SUPER_ADMIN]);

export const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  role: staffRole,
  phone: z.string().max(40).nullable().optional(),
});
export class CreateUserDto extends createZodDto(createUserSchema) {}

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  role: staffRole.optional(),
});
export class UpdateUserDto extends createZodDto(updateUserSchema) {}

export const listUsersSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export class ListUsersDto extends createZodDto(listUsersSchema) {}
