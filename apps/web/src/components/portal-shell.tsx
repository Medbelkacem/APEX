'use client';

import { useEffect, useRef, useState } from 'react';
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

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

/** The link list, shared by the fixed desktop sidebar and the mobile drawer. */
function PortalNav({
  nav,
  pathname,
  onNavigate,
}: {
  nav: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Portal">
      {nav.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              // min-h-11 keeps every row at a comfortable touch target on phones.
              'flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium',
              active ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
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
  const [menuOpen, setMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Below `lg` the sidebar is a slide-over, so a tap that navigates has to put
  // it away — otherwise the drawer sits on top of the page it just opened.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Escape closes the drawer, and the page behind it must not scroll while the
  // overlay is up. Both are undone on close so a desktop resize leaves nothing
  // stuck.
  useEffect(() => {
    if (!menuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  async function logout() {
    await authApi.logout().catch(() => undefined);
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar — laptops and up. */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-6 font-bold text-brand-700">
          <LogoMark className="h-8 w-8" />
          {title}
        </div>
        <PortalNav nav={nav} pathname={pathname} />
      </aside>

      {/* Mobile and tablet drawer. */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-slate-900/50"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setMenuOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Portal navigation"
            className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl"
          >
            <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-4 font-bold text-brand-700">
              <LogoMark className="h-8 w-8 shrink-0" />
              <span className="truncate">{title}</span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-600"
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  ✕
                </span>
              </button>
            </div>
            <PortalNav nav={nav} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* min-w-0 stops wide tables from stretching the column past the viewport. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky so the menu, the bell, and Log out stay reachable on a phone,
            where the sidebar is behind the drawer and pages run long. */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 lg:hidden"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ☰
            </span>
          </button>
          <div className="truncate font-bold text-brand-700 lg:hidden">{title}</div>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <NotificationBell />
            <Button variant="outline" size="sm" onClick={logout}>
              Log out
            </Button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
