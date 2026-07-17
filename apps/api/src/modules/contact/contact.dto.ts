import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createContactSchema = z.object({
  name: z.string().min(1).max(150),
  email: z.string().email(),
  subject: z.string().min(1).max(255),
  message: z.string().min(1).max(5000),
});
export class CreateContactDto extends createZodDto(createContactSchema) {}

export const listContactSchema = z.object({
  handled: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export class ListContactDto extends createZodDto(listContactSchema) {}
