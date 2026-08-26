import { Model } from 'mongoose';
import { CaseType } from '../entities';

/**
 * The laboratory's catalog: the four restorations Apex actually produces.
 *
 * The focused-SKU model is the product, not a starting point to grow from —
 * "we do four things flawlessly" is the promise the marketing site makes — so
 * this list is deliberately short and deliberately complete. An admin can add
 * to it, but nothing may be seeded here that the laboratory has not confirmed
 * it makes.
 *
 * Idempotent by slug: re-running the seeder against a database that already
 * carries a type leaves the admin's own edits to it alone.
 */
const DEFAULTS: Array<Partial<CaseType>> = [
  {
    name: 'Full Contour Zirconia',
    slug: 'full-contour-zirconia',
    description: 'Reliable fit for everyday restorations.',
    sortOrder: 1,
  },
  {
    name: 'IPS e.max Crown',
    slug: 'ips-emax-crown',
    description: 'High aesthetics with controlled turnaround.',
    sortOrder: 2,
  },
  {
    name: 'Screw-Retained Zirconia',
    slug: 'screw-retained-zirconia',
    description: 'Reduced complication risk.',
    sortOrder: 3,
  },
  {
    name: 'Zirconia Full-Arch Implant',
    slug: 'zirconia-full-arch-implant',
    description: 'Structured, predictable workflow for high-value cases.',
    sortOrder: 4,
  },
];

export async function seedCaseTypes(repo: Model<CaseType>): Promise<void> {
  for (const data of DEFAULTS) {
    const existing = await repo.findOne({ slug: data.slug }).exec();
    if (existing) continue;
    await repo.create({ ...data, isActive: true });
  }
  // eslint-disable-next-line no-console
  console.log(`  ✓ case types seeded (${DEFAULTS.length})`);
}
