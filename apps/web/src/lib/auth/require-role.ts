import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { UserRole } from '@dental/shared-types';
import { API_BASE } from '@/lib/api/client';
import type { PublicUserResponse } from '@/lib/api/auth';

/**
 * Server-side role gate for an authenticated route group.
 *
 * Middleware can only see that a session cookie exists — it is HttpOnly and
 * unverified there — so route groups additionally resolve the real principal
 * from the API before rendering. This is a UX/defence-in-depth layer: the API
 * independently authorises every request, so a bypass here leaks no data, it
 * would just render an empty shell.
 */
export async function requireRole(allowed: UserRole[]): Promise<PublicUserResponse> {
  const cookieHeader = cookies().toString();
  if (!cookieHeader) redirect('/login');

  let user: PublicUserResponse;
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
      // Always reflect the live session; a cached identity could outlive a logout.
      cache: 'no-store',
    });
    if (!res.ok) redirect('/login');
    user = (await res.json()) as PublicUserResponse;
  } catch (err) {
    // `redirect()` works by throwing — never swallow it as a fetch failure.
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    redirect('/login');
  }

  if (!allowed.includes(user.role)) {
    // Send people to the portal they do have, rather than a dead end.
    redirect(user.role === UserRole.DENTIST ? '/dashboard' : '/admin/dashboard');
  }
  return user;
}
