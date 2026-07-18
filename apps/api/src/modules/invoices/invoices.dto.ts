import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { InvoiceStatus } from '@dental/shared-types';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date');

export const listInvoicesSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  dentistId: z.string().uuid().optional(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export class ListInvoicesDto extends createZodDto(listInvoicesSchema) {}

export const generateInvoiceSchema = z.object({
  caseId: z.string().uuid(),
  /** Overrides the price resolved from the pricing rules. */
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  dueInDays: z.coerce.number().int().min(0).max(365).optional(),
});
export class GenerateInvoiceDto extends createZodDto(generateInvoiceSchema) {}

export const generateBatchSchema = z.object({
  dentistId: z.string().uuid(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  dueInDays: z.coerce.number().int().min(0).max(365).optional(),
});
export class GenerateBatchDto extends createZodDto(generateBatchSchema) {}

export const markPaidSchema = z.object({
  note: z.string().max(500).nullable().optional(),
});
export class MarkPaidDto extends createZodDto(markPaidSchema) {}
