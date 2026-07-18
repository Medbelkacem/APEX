import { UserRole } from '@dental/shared-types';
import { PortalShell, NavItem } from '@/components/portal-shell';
import { requireRole } from '@/lib/auth/require-role';

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/cases', label: 'My Cases' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/statements', label: 'Statements' },
  { href: '/profile', label: 'Profile' },
];

export default async function DentistLayout({ children }: { children: React.ReactNode }) {
  // Every portal page reads "own data" endpoints, which need a dentist profile.
  await requireRole([UserRole.DENTIST]);

  return (
    <PortalShell title="Dentist Portal" nav={NAV}>
      {children}
    </PortalShell>
  );
}
