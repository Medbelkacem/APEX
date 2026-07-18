import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #2563eb');

export const createCaseTypeSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export class CreateCaseTypeDto extends createZodDto(createCaseTypeSchema) {}

export const updateCaseTypeSchema = createCaseTypeSchema.partial();
export class UpdateCaseTypeDto extends createZodDto(updateCaseTypeSchema) {}

export const createCaseStatusSchema = z.object({
  label: z.string().min(1).max(120),
  color: hexColor.optional(),
  sortOrder: z.number().int().min(0).optional(),
  isTerminal: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export class CreateCaseStatusDto extends createZodDto(createCaseStatusSchema) {}

export const updateCaseStatusSchema = createCaseStatusSchema.partial();
export class UpdateCaseStatusDto extends createZodDto(updateCaseStatusSchema) {}

/** Payload for drag-and-drop reordering: the full ordered list of status ids. */
export const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});
export class ReorderDto extends createZodDto(reorderSchema) {}
