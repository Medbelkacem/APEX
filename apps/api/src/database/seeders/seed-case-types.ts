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

/**
 * The seven case types this seeder used to ship. All seven were invented by
 * the development team, so any database seeded before the catalog above went
 * in is still advertising restorations the laboratory never agreed to make —
 * adding the real four alongside them does not fix that.
 *
 * They are deactivated rather than deleted, which is how the catalog service
 * retires a type that is already in use: a case submitted against one still
 * has to be able to resolve its own type, and the public site and the case
 * form both read `isActive` anyway, so deactivating is what takes them off
 * the site.
 *
 * Matched on the description as well as the slug. If an admin has renamed or
 * rewritten one of these, it is the laboratory's row now and this leaves it
 * alone — the pairing below identifies only a row this seeder wrote and
 * nobody has touched since.
 */
const RETIRED: Array<{ slug: string; description: string }> = [
  { slug: 'crown', description: 'Single-unit crown restoration.' },
  { slug: 'bridge', description: 'Multi-unit fixed bridge.' },
  { slug: 'implant', description: 'Implant-supported restoration.' },
  { slug: 'veneer', description: 'Porcelain or composite veneer.' },
  { slug: 'denture', description: 'Full or partial removable denture.' },
  { slug: 'aligner', description: 'Clear orthodontic aligner.' },
  { slug: 'inlay-onlay', description: 'Indirect inlay or onlay.' },
];

export async function seedCaseTypes(repo: Model<CaseType>): Promise<void> {
  for (const data of DEFAULTS) {
    const existing = await repo.findOne({ slug: data.slug }).exec();
    if (existing) continue;
    await repo.create({ ...data, isActive: true });
  }

  const retired = await repo
    .updateMany({ $or: RETIRED, isActive: true }, { $set: { isActive: false } })
    .exec();

  // eslint-disable-next-line no-console
  console.log(`  ✓ case types seeded (${DEFAULTS.length})`);
  if (retired.modifiedCount > 0) {
    // eslint-disable-next-line no-console
    console.log(`  ✓ placeholder case types retired (${retired.modifiedCount})`);
  }
}
