import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Container } from '@/components/ui/card';

/**
 * The Apex marketing language, factored out of the pages that use it.
 *
 * Every element here is lifted from the landing-page design: the short Super
 * Blue rule that opens a section, the display-serif headline under it, the blue
 * pill with a navy icon disc that carries each feature, and the pill-shaped
 * uppercase CTAs. Keeping them in one place is what stops the five public pages
 * from each re-deriving their own version of the same rhythm.
 */

/** Pill-shaped uppercase CTA — the mockup's button, distinct from the portal's. */
type CtaTone = 'pearl' | 'navy' | 'blue' | 'onDark';

const CTA_TONES: Record<CtaTone, string> = {
  pearl: 'bg-pearl text-navy-700 hover:bg-pearl-200',
  navy: 'bg-navy-700 text-white hover:bg-navy-800',
  blue: 'bg-brand-600 text-white hover:bg-brand-700',
  onDark: 'border border-white/45 text-white hover:bg-white/10',
};

export function ctaClasses(tone: CtaTone = 'blue'): string {
  return cn(
    'inline-flex h-12 items-center justify-center rounded-full px-8 text-sm font-semibold uppercase tracking-wide transition-colors',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
    CTA_TONES[tone],
  );
}

/**
 * 24px line icons drawn on a shared canvas so every glyph keeps the same
 * stroke weight and optical size. Callers supply only the paths.
 */
export function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-6 w-6', className)}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** The navy disc the icons sit in, inside a blue feature pill. */
export function IconTile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy-700 text-white',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The short Super Blue rule that opens every section in the design. */
export function SectionRule({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('block h-1 w-24 rounded-full bg-brand-600', className)}
    />
  );
}

/**
 * The display-serif headline. Rendering it through one component is what keeps
 * the optical-size pin and the tight leading — both of which a bare `<h2>` with
 * `font-display` would miss — attached to every headline on the site.
 */
export function Display({
  as: Tag = 'h2',
  className,
  children,
}: {
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={cn('font-display font-bold leading-[1.08] tracking-tight', className)}>
      {children}
    </Tag>
  );
}

/**
 * The blue feature pill: an icon disc, a title, and a line of body copy. The
 * design uses it in a stacked column beside a photo and again as a standalone
 * card, so the row direction is the only thing callers vary.
 */
export function FeaturePill({
  title,
  body,
  icon,
  className,
}: {
  title: string;
  body: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-[1.75rem] bg-brand-600 p-5 text-white shadow-pill sm:gap-5 sm:p-6',
        className,
      )}
    >
      <IconTile>
        <Icon>{icon}</Icon>
      </IconTile>
      <div className="min-w-0">
        <h3 className="text-lg font-bold leading-snug">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-white/85">{body}</p>
      </div>
    </div>
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
    <section className="relative overflow-hidden bg-navy-700 text-white">
      {/*
       * The logomark blown up and bled off the right edge — the treatment the
       * guidelines use on the Mission & Vision spread. Decorative only.
       */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-40 hidden h-[38rem] w-[38rem] bg-current text-white/[0.07] sm:block"
        style={{
          maskImage: 'url(/brand/apex-mark.svg)',
          WebkitMaskImage: 'url(/brand/apex-mark.svg)',
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
        }}
      />
      {/* pt clears the fixed header, which paints over this band by design. */}
      <Container className="relative pb-16 pt-36 sm:pb-20 sm:pt-40">
        <div className="max-w-3xl">
          <SectionRule />
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-brand-200">
            {eyebrow}
          </p>
          <Display as="h1" className="mt-3 text-4xl sm:text-5xl">
            {title}
          </Display>
          {lede && (
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
              {lede}
            </p>
          )}
        </div>
      </Container>
    </section>
  );
}

/**
 * The closing panel each marketing page signs off with — the design's centred
 * headline, lede and CTA row on white.
 */
export function CtaBand({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-t border-navy-50 py-16 sm:py-24">
      <Container className="flex flex-col items-center text-center">
        <SectionRule />
        <Display className="mt-8 max-w-3xl text-3xl text-navy-700 sm:text-4xl lg:text-[3.25rem]">
          {title}
        </Display>
        {body && <p className="mt-5 max-w-xl text-navy-600/80">{body}</p>}
        {children && <div className="mt-9 flex flex-wrap justify-center gap-4">{children}</div>}
      </Container>
    </section>
  );
}
