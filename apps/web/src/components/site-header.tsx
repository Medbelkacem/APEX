'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';
import { ctaClasses } from '@/components/marketing';
import { cn } from '@/lib/utils/cn';

const NAV = [
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Services' },
  { href: '/how-to-send-a-case', label: 'How to send a case' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  /*
   * The design floats the nav on the dark band every public page opens with,
   * so the header is taken out of flow rather than sitting above it. Once that
   * band has scrolled past there is nothing dark left behind the links, which
   * is what the solid Oxford Navy fill below is for.
   */
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'site-header fixed inset-x-0 top-0 z-40 text-white transition-colors duration-300',
        scrolled || open ? 'bg-navy-700 shadow-lg shadow-navy-900/20' : 'bg-transparent',
      )}
    >
      {/*
       * The see-through state is the one that needs scripting to undo. With no
       * JS the class never flips, and white links would end up on the white
       * section below the fold — so in that case the header simply starts
       * solid. Done here rather than by seeding the state to `true`, which
       * would flash a navy bar over the hero on every load before hydration.
       */}
      <noscript>
        <style>{`.site-header { background-color: #001e47; }`}</style>
      </noscript>

      <Container className="flex h-20 items-center justify-between gap-6">
        <Link href="/" aria-label="Apex — home" className="text-white">
          <Logo size="md" />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-white/80 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/login"
            className="text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            Log in
          </Link>
          <Link href="/register" className={cn(ctaClasses('pearl'), 'h-11 px-6')}>
            Submit a case
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/40 lg:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="text-xl leading-none">{open ? '✕' : '☰'}</span>
        </button>
      </Container>

      <div className={cn('border-t border-white/10 bg-navy-700 lg:hidden', open ? 'block' : 'hidden')}>
        <Container className="flex flex-col gap-1 py-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className={cn(ctaClasses('onDark'), 'flex-1')}
            >
              Log in
            </Link>
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className={cn(ctaClasses('pearl'), 'flex-1')}
            >
              Submit a case
            </Link>
          </div>
        </Container>
      </div>
    </header>
  );
}
