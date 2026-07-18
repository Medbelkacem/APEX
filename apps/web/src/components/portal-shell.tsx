'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/ui/logo';
import { NotificationBell } from '@/components/notification-bell';
import { authApi } from '@/lib/api/auth';
import { cn } from '@/lib/utils/cn';

export interface NavItem {
  href: string;
  label: string;
}

export function PortalShell({
  title,
  nav,
  children,
}: {
  title: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await authApi.logout().catch(() => undefined);
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-6 font-bold text-brand-700">
          <LogoMark className="h-8 w-8" />
          {title}
        </div>
        <nav className="flex-1 space-y-1 p-4" aria-label="Portal">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'block rounded-lg px-3 py-2 text-sm font-medium',
                  active ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="lg:hidden font-bold text-brand-700">{title}</div>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <Button variant="outline" size="sm" onClick={logout}>
              Log out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
