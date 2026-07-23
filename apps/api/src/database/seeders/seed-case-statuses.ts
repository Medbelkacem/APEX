import { Model } from 'mongoose';
import { CaseStatus } from '../entities';

/**
 * Default lab workflow statuses, in order.
 *
 * The colours are not decorative: they drive status badges and the admin
 * distribution chart, so they were chosen as a *validated categorical palette* —
 * every adjacent pair clears the colour-blind and normal-vision separation
 * floors against a light surface. Statuses are always rendered with their label
 * beside the swatch, which is the secondary encoding the red/green pair needs.
 * Re-validate with the data-viz palette checker before changing any value.
 */
const DEFAULTS: Array<Partial<CaseStatus> & { legacyColor?: string }> = [
  { label: 'Received', slug: 'received', color: '#2a78d6', sortOrder: 1, isTerminal: false, legacyColor: '#64748b' },
  { label: 'In Review', slug: 'in-review', color: '#eda100', sortOrder: 2, isTerminal: false, legacyColor: '#0ea5e9' },
  { label: 'In Production', slug: 'in-production', color: '#4a3aa7', sortOrder: 3, isTerminal: false, legacyColor: '#6366f1' },
  { label: 'Quality Check', slug: 'quality-check', color: '#eb6834', sortOrder: 4, isTerminal: false, legacyColor: '#f59e0b' },
  { label: 'Shipped', slug: 'shipped', color: '#1baf7a', sortOrder: 5, isTerminal: false, legacyColor: '#14b8a6' },
  { label: 'Completed', slug: 'completed', color: '#008300', sortOrder: 6, isTerminal: true, legacyColor: '#22c55e' },
  { label: 'Cancelled', slug: 'cancelled', color: '#e34948', sortOrder: 7, isTerminal: true, legacyColor: '#ef4444' },
];

export async function seedCaseStatuses(repo: Model<CaseStatus>): Promise<void> {
  let recoloured = 0;

  for (const { legacyColor, ...data } of DEFAULTS) {
    const existing = await repo.findOne({ slug: data.slug }).exec();
    if (!existing) {
      await repo.create({ ...data, isActive: true });
      continue;
    }
    // Upgrade installs still on the old palette, but never overwrite a colour
    // an admin has deliberately customised.
    if (legacyColor && existing.color === legacyColor) {
      await repo.updateOne({ _id: existing.id }, { color: data.color }).exec();
      recoloured += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `  ✓ case statuses seeded (${DEFAULTS.length})${recoloured ? `, ${recoloured} recoloured` : ''}`,
  );
}
