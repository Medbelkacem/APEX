import { Model } from 'mongoose';
import { CaseType, DentalCase, PricingRule } from '../entities';

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
 * in still carries restorations the laboratory never agreed to make.
 *
 * They are deleted outright, so the catalog holds four rows and not eleven.
 * The one thing a hard delete could break is a document that still points at
 * one, so each is checked first: a placeholder a case or a pricing rule still
 * references is deactivated instead of removed, leaving that reference able to
 * resolve. Nothing else needs it — both the public site and the case form read
 * `isActive`, so either outcome takes it off the site.
 *
 * Matched on the description as well as the slug. If an admin has renamed or
 * rewritten one of these, it is the laboratory's row now and this leaves it
 * alone — the pairing below identifies only a row this seeder wrote and
 * nobody has edited since.
 */
const PLACEHOLDERS: Array<{ slug: string; description: string }> = [
  { slug: 'crown', description: 'Single-unit crown restoration.' },
  { slug: 'bridge', description: 'Multi-unit fixed bridge.' },
  { slug: 'implant', description: 'Implant-supported restoration.' },
  { slug: 'veneer', description: 'Porcelain or composite veneer.' },
  { slug: 'denture', description: 'Full or partial removable denture.' },
  { slug: 'aligner', description: 'Clear orthodontic aligner.' },
  { slug: 'inlay-onlay', description: 'Indirect inlay or onlay.' },
];

export async function seedCaseTypes(
  repo: Model<CaseType>,
  cases: Model<DentalCase>,
  pricingRules: Model<PricingRule>,
): Promise<void> {
  for (const data of DEFAULTS) {
    const existing = await repo.findOne({ slug: data.slug }).exec();
    if (existing) continue;
    await repo.create({ ...data, isActive: true });
  }

  // withDeleted: a placeholder an admin has already soft-deleted is still a row
  // in the collection, and the point here is that only the four remain.
  const stale = await repo
    .find({ $or: PLACEHOLDERS })
    .setOptions({ withDeleted: true })
    .exec();

  let removed = 0;
  let deactivated = 0;
  for (const type of stale) {
    const referenced =
      (await cases
        .countDocuments({ caseTypeId: type._id })
        .setOptions({ withDeleted: true })
        .exec()) > 0 ||
      (await pricingRules
        .countDocuments({ caseTypeId: type._id })
        .setOptions({ withDeleted: true })
        .exec()) > 0;
    if (referenced) {
      if (type.isActive) {
        await repo.updateOne({ _id: type._id }, { $set: { isActive: false } }).exec();
        deactivated += 1;
      }
    } else {
      await repo.deleteOne({ _id: type._id }).exec();
      removed += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`  ✓ case types seeded (${DEFAULTS.length})`);
  if (removed > 0) {
    // eslint-disable-next-line no-console
    console.log(`  ✓ placeholder case types removed (${removed})`);
  }
  if (deactivated > 0) {
    // eslint-disable-next-line no-console
    console.log(`  ✓ placeholder case types still in use, deactivated (${deactivated})`);
  }
}
