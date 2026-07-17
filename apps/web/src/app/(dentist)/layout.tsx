import { PortalShell, NavItem } from '@/components/portal-shell';

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/cases', label: 'My Cases' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/statements', label: 'Statements' },
  { href: '/profile', label: 'Profile' },
];

export default function DentistLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell title="Dentist Portal" nav={NAV}>
      {children}
    </PortalShell>
  );
}
