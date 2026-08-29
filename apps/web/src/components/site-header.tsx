'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';
import { SiteNavLinks, useSiteNav } from '@/components/site-nav';
import { cn } from '@/lib/utils/cn';

export function SiteHeader() {
  // The design's anchors on the landing page, the DRS's routes elsewhere —
  // see `site-nav.tsx` for why the header carries two different lists.
  const nav = useSiteNav();
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

      {/*
       * Three tracks rather than `justify-between`: the design centres the nav
       * on the page, and spacing three items apart would instead centre it
       * between the mark and whatever sits opposite, which are not the same
       * width.
       */}
      <Container className="flex h-20 items-center justify-between gap-6 lg:grid lg:h-[6.25rem] lg:grid-cols-[1fr_auto_1fr]">
        <Link href="/" aria-label="Apex — home" className="text-white lg:justify-self-start">
          <Logo size="md" />
        </Link>

        <SiteNavLinks
          ariaLabel="Primary"
          className="hidden items-center gap-9 lg:flex"
          linkClassName="text-lg text-white/80 transition-colors hover:text-white"
        />

        {/*
         * The design's header carries no buttons at all. The portal still needs
         * a way in, so it is a plain text link at the quietest weight the bar
         * has — present for the practices who already have an account, without
         * putting a call to action beside the nav the design does not draw.
         */}
        <div className="hidden lg:flex lg:justify-self-end">
          <Link
            href="/login"
            className="text-sm text-white/60 transition-colors hover:text-white"
          >
            Log in
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

      <div
        className={cn('border-t border-white/10 bg-navy-700 lg:hidden', open ? 'block' : 'hidden')}
      >
        <Container className="flex flex-col gap-1 py-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="mt-2 rounded-lg border-t border-white/10 px-3 pb-2.5 pt-4 text-sm font-medium text-white/60 hover:text-white"
          >
            Log in
          </Link>
        </Container>
      </div>
    </header>
  );
}
