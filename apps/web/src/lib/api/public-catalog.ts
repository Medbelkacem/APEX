import type { CaseType } from '@dental/shared-types';
import { API_BASE } from './client';

/** Rebuild hourly so a catalog change reaches the marketing site on its own. */
export const PUBLIC_CATALOG_REVALIDATE = 3600;

/**
 * The admin-managed catalog backing the public marketing pages.
 *
 * Returns an empty list when the API is unreachable rather than falling back to
 * a hard-coded one: the laboratory's real offering is the only thing the site is
 * allowed to advertise, so showing nothing is preferable to showing something
 * invented. Callers are expected to handle the empty case.
 */
export async function loadPublicCaseTypes(): Promise<CaseType[]> {
  try {
    const res = await fetch(`${API_BASE}/api/catalog/case-types`, {
      next: { revalidate: PUBLIC_CATALOG_REVALIDATE },
    });
    if (!res.ok) return [];
    return (await res.json()) as CaseType[];
  } catch {
    return [];
  }
}
