import { UserRole } from '@dental/shared-types';
import { PortalShell, NavItem } from '@/components/portal-shell';
import { requireRole } from '@/lib/auth/require-role';

const NAV: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/dentists', label: 'Dentists' },
  { href: '/admin/cases', label: 'Cases' },
  { href: '/admin/pricing', label: 'Pricing' },
  { href: '/admin/workflow', label: 'Workflow' },
  { href: '/admin/invoices', label: 'Invoices' },
  { href: '/admin/statements', label: 'Statements' },
  { href: '/admin/statistics', label: 'Statistics' },
  { href: '/admin/notifications', label: 'Notifications' },
  { href: '/admin/settings', label: 'Settings' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Dentists who reach an /admin route are bounced to their own portal.
  await requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]);

  return (
    <PortalShell title="Admin Dashboard" nav={NAV}>
      {children}
    </PortalShell>
  );
}
