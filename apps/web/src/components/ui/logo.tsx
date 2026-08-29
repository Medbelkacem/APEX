import { cn } from '@/lib/utils/cn';

/**
 * Both halves of the lockup are drawn as a CSS mask over `currentColor` rather
 * than an <img>, so one asset adapts to every surface the guidelines allow —
 * Super Blue on white, Shiny Pearl on Oxford Navy, solid black in print — with
 * no per-context variants and no colour ever drifting off palette.
 */
function maskStyle(url: string): React.CSSProperties {
  return {
    maskImage: `url(${url})`,
    WebkitMaskImage: `url(${url})`,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
  };
}

/** The logomark alone — concentric arcs in a circular frame. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Apex"
      className={cn('inline-block shrink-0 bg-current', className)}
      style={maskStyle('/brand/apex-mark.svg')}
    />
  );
}

/**
 * The APEX wordmark, set in the brand's own display face. It is artwork rather
 * than live text — the licensed face is not on the page, so typing the name
 * would render it in the fallback serif and quietly break the identity.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Apex"
      className={cn('inline-block shrink-0 bg-current', className)}
      style={maskStyle('/brand/apex-wordmark.svg')}
    />
  );
}

/**
 * The horizontal lockup's proportions are fixed by the guidelines: the
 * wordmark stands half the mark's height, runs 1.8× its width, and clears it
 * by a quarter of it. Offering sizes as a closed set rather than loose classes
 * is what keeps those three numbers in step — a caller resizing only the mark
 * is how a lockup drifts out of spec.
 */
type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

const LOCKUP: Record<LogoSize, { gap: string; mark: string; word: string }> = {
  sm: { gap: 'gap-[0.4375rem]', mark: 'h-7 w-7', word: 'h-3.5 w-[3.15rem]' },
  md: { gap: 'gap-2', mark: 'h-8 w-8', word: 'h-4 w-[3.6rem]' },
  lg: { gap: 'gap-2.5', mark: 'h-10 w-10', word: 'h-5 w-[4.5rem]' },
  xl: { gap: 'gap-3.5', mark: 'h-14 w-14', word: 'h-7 w-[6.3rem]' },
};

/** Mark + wordmark lockup used in headers, footers, and the auth screen. */
export function Logo({
  className,
  size = 'md',
  showWordmark = true,
}: {
  className?: string;
  size?: LogoSize;
  showWordmark?: boolean;
}) {
  const spec = LOCKUP[size];
  return (
    <span className={cn('inline-flex items-center', spec.gap, className)}>
      <LogoMark className={spec.mark} />
      {showWordmark && <Wordmark className={spec.word} />}
    </span>
  );
}
