import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const money = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v.toFixed(2) : v))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), 'Expected a monetary amount like 149.00');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date');

export const createPricingRuleSchema = z.object({
  caseTypeId: z.string().uuid(),
  dentistTier: z.string().max(60).nullable().optional(),
  material: z.string().max(120).nullable().optional(),
  price: money,
  currency: z.string().length(3).optional(),
  effectiveFrom: isoDate.optional(),
  effectiveTo: isoDate.nullable().optional(),
  isActive: z.boolean().optional(),
});
export class CreatePricingRuleDto extends createZodDto(createPricingRuleSchema) {}

export const updatePricingRuleSchema = createPricingRuleSchema.partial().omit({ caseTypeId: true });
export class UpdatePricingRuleDto extends createZodDto(updatePricingRuleSchema) {}

export const listPricingRulesSchema = z.object({
  caseTypeId: z.string().uuid().optional(),
  dentistTier: z.string().optional(),
  includeInactive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export class ListPricingRulesDto extends createZodDto(listPricingRulesSchema) {}

/** Preview what a case would be priced at, before generating an invoice. */
export const quoteSchema = z.object({
  caseTypeId: z.string().uuid(),
  material: z.string().max(120).nullable().optional(),
  dentistTier: z.string().max(60).nullable().optional(),
});
export class QuoteDto extends createZodDto(quoteSchema) {}
