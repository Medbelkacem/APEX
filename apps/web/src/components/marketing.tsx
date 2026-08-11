import type { ReactNode } from 'react';
import { Card, Container } from '@/components/ui/card';

/**
 * Chrome shared by the public marketing pages.
 *
 * Each page used to re-derive its own heading sizes, section padding and
 * closing panel, which is why no two of them opened or closed the same way.
 * The pieces live here so there is one definition of the rhythm; the home
 * page's hero is deliberately not one of them, being a different composition.
 */

/**
 * 24px line icons drawn on a shared canvas so every glyph keeps the same
 * stroke weight and optical size. Callers supply only the paths.
 */
export function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** The brand-tinted square the icons sit in, on light surfaces. */
export function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
      {children}
    </span>
  );
}

/** The banner every inner marketing page opens with. */
export function PageHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-brand-50 via-brand-50/40 to-white">
      {/* Soft brand wash behind the copy; purely decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-32 h-[24rem] w-[24rem] rounded-full bg-brand-200/40 blur-3xl"
      />
      <Container className="relative py-12 sm:py-16">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
            {eyebrow}
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {title}
          </h1>
          {lede && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              {lede}
            </p>
          )}
        </div>
      </Container>
    </section>
  );
}

/**
 * A link styled to sit on the brand-700 panel below, where the outline button
 * variant's slate border would all but disappear.
 */
export const outlineOnBrand =
  'inline-flex h-12 items-center justify-center rounded-lg border border-white/40 px-7 text-base font-semibold text-white transition-colors hover:bg-white/10';

/** The closing panel each marketing page signs off with. */
export function CtaBand({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  /*
   * Only a little top padding of its own: the content section above always
   * carries the larger `py-12`/`py-14` bottom gap, and doubling both leaves the
   * panel adrift at the foot of the page.
   */
  return (
    <section className="pb-14 pt-4 sm:pb-20 sm:pt-6">
      <Container>
        <Card className="flex flex-col items-center gap-5 bg-brand-700 p-8 text-center text-white sm:p-12">
          <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
          {body && <p className="max-w-xl text-brand-50">{body}</p>}
          {children && <div className="flex flex-wrap justify-center gap-3">{children}</div>}
        </Card>
      </Container>
    </section>
  );
}
