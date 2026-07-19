import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { UserStatus } from '@dental/shared-types';
import { strongPassword } from '../auth/auth.dto';

export const createDentistSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  phone: z.string().max(40).nullable().optional(),
  clinicName: z.string().max(255).nullable().optional(),
  clinicAddress: z.string().nullable().optional(),
  billingAddress: z.string().nullable().optional(),
  tier: z.string().max(60).nullable().optional(),
  notes: z.string().nullable().optional(),
});
export class CreateDentistDto extends createZodDto(createDentistSchema) {}

export const updateDentistSchema = z.object({
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  clinicName: z.string().max(255).nullable().optional(),
  clinicAddress: z.string().nullable().optional(),
  billingAddress: z.string().nullable().optional(),
  tier: z.string().max(60).nullable().optional(),
  notes: z.string().nullable().optional(),
});
export class UpdateDentistDto extends createZodDto(updateDentistSchema) {}

/**
 * Public self-registration.
 *
 * Notably absent: `role`, `tier`, `status` and `notes`. Role and status decide
 * what the account may do, and tier decides what it is charged — none of them
 * can be accepted from an anonymous form. Tier stays null until an admin sets
 * it, so a self-registered dentist gets default pricing.
 */
export const registerDentistSchema = z.object({
  email: z.string().email(),
  password: strongPassword,
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  phone: z.string().max(40).nullable().optional(),
  clinicName: z.string().max(255).nullable().optional(),
  clinicAddress: z.string().nullable().optional(),
});
export class RegisterDentistDto extends createZodDto(registerDentistSchema) {}

export const verifyEmailSchema = z.object({
  userId: z.string().uuid(),
  token: z.string().min(10),
});
export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}

export const rejectDentistSchema = z.object({
  reason: z.string().max(500).nullable().optional(),
});
export class RejectDentistDto extends createZodDto(rejectDentistSchema) {}

export const listDentistsSchema = z.object({
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export class ListDentistsDto extends createZodDto(listDentistsSchema) {}
