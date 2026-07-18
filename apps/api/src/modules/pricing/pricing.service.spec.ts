import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { PricingRule } from '../../database/entities';
import { PricingService } from './pricing.service';

const CASE_TYPE = 'ct-1';

function rule(partial: Partial<PricingRule>): PricingRule {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    caseTypeId: CASE_TYPE,
    dentistTier: null,
    material: null,
    price: '100.00',
    currency: 'USD',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    isActive: true,
    ...partial,
  } as PricingRule;
}

/**
 * The service only ever reads candidate rules through one query builder, so the
 * repository is stubbed down to that: `getMany` returns whatever the test set up,
 * and the service's own precedence logic is what's under test.
 */
function serviceWith(rules: PricingRule[]): PricingService {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rules),
  };
  const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) } as unknown as Repository<PricingRule>;
  const config = { get: () => ({ defaultCurrency: 'USD' }) } as unknown as ConfigService;
  return new PricingService(repo, config);
}

describe('PricingService.quote', () => {
  it('falls back to zero with basis "none" when nothing is configured', async () => {
    const quote = await serviceWith([]).quote(CASE_TYPE);
    expect(quote).toEqual({ price: '0.00', currency: 'USD', ruleId: null, basis: 'none' });
  });

  it('uses the case type default when no tier or material matches', async () => {
    const quote = await serviceWith([rule({ id: 'default', price: '149.00' })]).quote(CASE_TYPE);
    expect(quote.basis).toBe('default');
    expect(quote.price).toBe('149.00');
  });

  it('prefers a tier rule over the default', async () => {
    const service = serviceWith([
      rule({ id: 'default', price: '149.00' }),
      rule({ id: 'gold', dentistTier: 'gold', price: '129.00' }),
    ]);
    const quote = await service.quote(CASE_TYPE, null, 'gold');
    expect(quote).toMatchObject({ ruleId: 'gold', price: '129.00', basis: 'tier' });
  });

  it('prefers a material rule over the default', async () => {
    const service = serviceWith([
      rule({ id: 'default', price: '149.00' }),
      rule({ id: 'zirconia', material: 'Zirconia', price: '179.00' }),
    ]);
    const quote = await service.quote(CASE_TYPE, 'Zirconia');
    expect(quote).toMatchObject({ ruleId: 'zirconia', price: '179.00', basis: 'material' });
  });

  it('prefers the most specific rule — tier + material beats either alone', async () => {
    const service = serviceWith([
      rule({ id: 'default', price: '149.00' }),
      rule({ id: 'gold', dentistTier: 'gold', price: '129.00' }),
      rule({ id: 'zirconia', material: 'Zirconia', price: '179.00' }),
      rule({ id: 'gold-zirconia', dentistTier: 'gold', material: 'Zirconia', price: '159.00' }),
    ]);
    const quote = await service.quote(CASE_TYPE, 'Zirconia', 'gold');
    expect(quote).toMatchObject({ ruleId: 'gold-zirconia', basis: 'tier+material' });
  });

  it('matches material case-insensitively', async () => {
    const service = serviceWith([rule({ id: 'zirconia', material: 'Zirconia', price: '179.00' })]);
    await expect(service.quote(CASE_TYPE, 'zirconia')).resolves.toMatchObject({
      ruleId: 'zirconia',
    });
  });

  it('does not apply a tier rule to a dentist without that tier', async () => {
    const service = serviceWith([
      rule({ id: 'default', price: '149.00' }),
      rule({ id: 'gold', dentistTier: 'gold', price: '129.00' }),
    ]);
    // Untiered dentist, and a dentist on a different tier, both get the default.
    await expect(service.quote(CASE_TYPE)).resolves.toMatchObject({ basis: 'default' });
    await expect(service.quote(CASE_TYPE, null, 'silver')).resolves.toMatchObject({
      basis: 'default',
    });
  });

  it('breaks ties on the newest effective date', async () => {
    // The query orders by effectiveFrom DESC, so the first match wins.
    const service = serviceWith([
      rule({ id: 'new', price: '169.00', effectiveFrom: '2026-06-01' }),
      rule({ id: 'old', price: '149.00', effectiveFrom: '2026-01-01' }),
    ]);
    await expect(service.quote(CASE_TYPE)).resolves.toMatchObject({
      ruleId: 'new',
      price: '169.00',
    });
  });

  it('returns the rule currency rather than the platform default', async () => {
    const service = serviceWith([rule({ id: 'eur', price: '140.00', currency: 'EUR' })]);
    await expect(service.quote(CASE_TYPE)).resolves.toMatchObject({ currency: 'EUR' });
  });
});
