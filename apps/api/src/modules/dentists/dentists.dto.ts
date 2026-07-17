import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { UserStatus } from '@dental/shared-types';

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

export const listDentistsSchema = z.object({
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export class ListDentistsDto extends createZodDto(listDentistsSchema) {}
