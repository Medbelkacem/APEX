import { Model } from 'mongoose';
import { CaseType } from '../entities';

/** Default catalog of dental case types. Idempotent by slug. */
const DEFAULTS: Array<Partial<CaseType>> = [
  { name: 'Crown', slug: 'crown', description: 'Single-unit crown restoration.', sortOrder: 1 },
  { name: 'Bridge', slug: 'bridge', description: 'Multi-unit fixed bridge.', sortOrder: 2 },
  { name: 'Implant', slug: 'implant', description: 'Implant-supported restoration.', sortOrder: 3 },
  { name: 'Veneer', slug: 'veneer', description: 'Porcelain or composite veneer.', sortOrder: 4 },
  { name: 'Denture', slug: 'denture', description: 'Full or partial removable denture.', sortOrder: 5 },
  { name: 'Aligner', slug: 'aligner', description: 'Clear orthodontic aligner.', sortOrder: 6 },
  { name: 'Inlay / Onlay', slug: 'inlay-onlay', description: 'Indirect inlay or onlay.', sortOrder: 7 },
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
