import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CaseFileType } from '@dental/shared-types';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date');

export const createCaseSchema = z.object({
  caseTypeId: z.string().uuid(),
  patientReference: z.string().min(1).max(120),
  toothRegion: z.string().max(120).nullable().optional(),
  material: z.string().max(120).nullable().optional(),
  shade: z.string().max(60).nullable().optional(),
  deadline: isoDate.nullable().optional(),
  clinicalNotes: z.string().max(5000).nullable().optional(),
  /** Admin-only: submit on behalf of a dentist. Ignored for dentist callers. */
  dentistId: z.string().uuid().optional(),
});
export class CreateCaseDto extends createZodDto(createCaseSchema) {}

export const updateCaseSchema = createCaseSchema.omit({ dentistId: true }).partial();
export class UpdateCaseDto extends createZodDto(updateCaseSchema) {}

export const listCasesSchema = z.object({
  status: z.string().optional(),
  caseTypeId: z.string().uuid().optional(),
  dentistId: z.string().uuid().optional(),
  search: z.string().optional(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  /** `active` hides terminal statuses, `completed` shows only them. */
  bucket: z.enum(['all', 'active', 'completed']).optional(),
  sort: z.enum(['submittedAt', 'deadline', 'reference']).optional(),
  order: z.enum(['ASC', 'DESC']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export class ListCasesDto extends createZodDto(listCasesSchema) {}

export const changeStatusSchema = z.object({
  caseStatusId: z.string().uuid(),
  note: z.string().max(2000).nullable().optional(),
});
export class ChangeStatusDto extends createZodDto(changeStatusSchema) {}

export const reassignSchema = z.object({
  dentistId: z.string().uuid(),
  note: z.string().max(2000).nullable().optional(),
});
export class ReassignCaseDto extends createZodDto(reassignSchema) {}

/**
 * Optional hint for how to classify an upload. The server still sniffs the
 * bytes; this only distinguishes a lab deliverable from a dentist submission.
 */
export const uploadFilesSchema = z.object({
  fileType: z.nativeEnum(CaseFileType).optional(),
});
export class UploadFilesDto extends createZodDto(uploadFilesSchema) {}
