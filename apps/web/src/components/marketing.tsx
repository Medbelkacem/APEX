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
  blue: 'bg-blue-600 text-white hover:bg-blue-700',
  // Not a plain outline: the design washes the pill with about 15% white.
  onDark: 'border border-white/45 bg-white/15 text-white hover:bg-white/25',
};

/**
 * `lg` is the button the design draws in its CTA rows — 60px tall with an 18px
 * label at desktop. `sm` is the compact one the header carries, which has to
 * sit inside a 100px bar beside the nav.
 *
 * The size is a parameter rather than something a caller layers on afterwards
 * because `cn` is a plain join: Tailwind resolves same-specificity utilities by
 * stylesheet order, so an `h-12` appended by a caller would lose to the `h-14`
 * already in the string and quietly do nothing.
 */
type CtaSize = 'lg' | 'sm';

const CTA_SIZES: Record<CtaSize, string> = {
  lg: 'h-14 px-9 text-[0.9375rem] sm:h-[3.75rem] sm:px-12 sm:text-lg',
  sm: 'h-12 px-7 text-sm',
};

export function ctaClasses(tone: CtaTone = 'blue', size: CtaSize = 'lg'): string {
  return cn(
    'inline-flex items-center justify-center rounded-full font-semibold uppercase tracking-wide transition-colors',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
    CTA_SIZES[size],
    CTA_TONES[tone],
  );
}

/**
 * 28px line icons drawn on a shared canvas so every glyph keeps the same
 * stroke weight and optical size. Callers supply only the paths.
 *
 * The default size is dropped when the caller sets one of its own. Tailwind
 * resolves utilities of equal specificity by stylesheet order rather than by
 * the order they appear in the class attribute, so a caller asking for `h-6`
 * would otherwise lose to the `h-7` below and silently get the default.
 */
export function Icon({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        /(^|\s)h-/.test(className) ? null : 'h-7',
        /(^|\s)w-/.test(className) ? null : 'w-7',
        className,
      )}
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
        'flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy-700 text-white sm:h-[4.5rem] sm:w-[4.5rem]',
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The short Super Blue rule that opens every section in the design — 204x6.
 * The landing page centres it on the page rather than on the heading beneath
 * it, which is where the design puts it even where that heading is ranged
 * left, so the centring is the caller's to ask for.
 */
export function SectionRule({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('block h-1.5 w-[12.75rem] max-w-full rounded-full bg-blue-600', className)}
    />
  );
}

/**
 * The display headline. The design sets Muslone at its own defaults: no
 * tracking, and the leading the face's own metrics ask for — its ascent and
 * descent sum to 1.331em, and the design's two-line headlines are set exactly
 * that far apart.
 *
 * That leading is marked important because it has to survive the size classes
 * callers pass. Tailwind's `text-*` scale carries a line-height of its own and
 * emits the responsive variants of it after every unprefixed utility, so a
 * plain `leading-*` here would hold at the base width and then lose to
 * `sm:text-5xl` the moment the headline grew.
 */
export function Display({
  as: Tag = 'h2',
  className,
  id,
  children,
}: {
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
  /** Every section is labelled by its own heading, so headings need naming. */
  id?: string;
  children: ReactNode;
}) {
  return (
    <Tag id={id} className={cn('font-display font-bold !leading-[1.331]', className)}>
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
        'flex items-center gap-4 rounded-[1.75rem] bg-blue-600 p-5 text-white shadow-pill sm:gap-6 sm:p-7',
        className,
      )}
    >
      <IconTile>
        <Icon>{icon}</Icon>
      </IconTile>
      <div className="min-w-0">
        <h3 className="text-xl font-bold leading-snug sm:text-[1.75rem]">{title}</h3>
        <p className="mt-1 text-[0.9375rem] leading-relaxed text-white/85 sm:text-[1.0625rem]">
          {body}
        </p>
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
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">
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
