'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';
import { buttonClasses } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

const NAV = [
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Services' },
  { href: '/how-to-send-a-case', label: 'How to Send a Case' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="text-brand-700" aria-label="Dental Lab — home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-600 hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className={buttonClasses('outline', 'sm')}>
            Log in
          </Link>
          <Link href="/contact" className={buttonClasses('primary', 'sm')}>
            Get started
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="text-xl leading-none">{open ? '✕' : '☰'}</span>
        </button>
      </Container>

      <div className={cn('border-t border-slate-200 bg-white md:hidden', open ? 'block' : 'hidden')}>
        <Container className="flex flex-col gap-1 py-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 flex gap-3">
            <Link href="/login" className={cn(buttonClasses('outline', 'sm'), 'flex-1')}>
              Log in
            </Link>
            <Link href="/contact" className={cn(buttonClasses('primary', 'sm'), 'flex-1')}>
              Get started
            </Link>
          </div>
        </Container>
      </div>
    </header>
  );
}
