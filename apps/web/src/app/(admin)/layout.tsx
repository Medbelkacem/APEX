import { PortalShell, NavItem } from '@/components/portal-shell';

const NAV: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/dentists', label: 'Dentists' },
  { href: '/admin/cases', label: 'Cases' },
  { href: '/admin/pricing', label: 'Pricing' },
  { href: '/admin/workflow', label: 'Workflow' },
  { href: '/admin/invoices', label: 'Invoices' },
  { href: '/admin/statements', label: 'Statements' },
  { href: '/admin/statistics', label: 'Statistics' },
  { href: '/admin/settings', label: 'Settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell title="Admin Dashboard" nav={NAV}>
      {children}
    </PortalShell>
  );
}
