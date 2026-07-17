import { DataSource } from 'typeorm';
import { CaseStatus } from '../entities';

/** Default lab workflow statuses, in order. Idempotent by slug. */
const DEFAULTS: Array<Partial<CaseStatus>> = [
  { label: 'Received', slug: 'received', color: '#64748b', sortOrder: 1, isTerminal: false },
  { label: 'In Review', slug: 'in-review', color: '#0ea5e9', sortOrder: 2, isTerminal: false },
  { label: 'In Production', slug: 'in-production', color: '#6366f1', sortOrder: 3, isTerminal: false },
  { label: 'Quality Check', slug: 'quality-check', color: '#f59e0b', sortOrder: 4, isTerminal: false },
  { label: 'Shipped', slug: 'shipped', color: '#14b8a6', sortOrder: 5, isTerminal: false },
  { label: 'Completed', slug: 'completed', color: '#22c55e', sortOrder: 6, isTerminal: true },
  { label: 'Cancelled', slug: 'cancelled', color: '#ef4444', sortOrder: 7, isTerminal: true },
];

export async function seedCaseStatuses(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(CaseStatus);
  for (const data of DEFAULTS) {
    const existing = await repo.findOne({ where: { slug: data.slug } });
    if (existing) continue;
    await repo.save(repo.create({ ...data, isActive: true }));
  }
  // eslint-disable-next-line no-console
  console.log(`  ✓ case statuses seeded (${DEFAULTS.length})`);
}
