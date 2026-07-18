import { cn } from '@/lib/utils/cn';

/**
 * The brand mark. Rendered as a CSS mask over `currentColor` rather than an
 * <img>, so one asset adapts to every surface — brand teal on the marketing
 * header, white in the dark portal sidebar — with no per-context variants.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Logo"
      className={cn('inline-block shrink-0 bg-current', className)}
      style={{
        maskImage: 'url(/logo.png)',
        WebkitMaskImage: 'url(/logo.png)',
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  );
}

/** Brand mark + wordmark lockup used in headers, footers, and the auth screen. */
export function Logo({
  className,
  markClassName,
  showWordmark = true,
}: {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-bold', className)}>
      <LogoMark className={cn('h-8 w-8', markClassName)} />
      {showWordmark && <span className="tracking-tight">Dental Lab</span>}
    </span>
  );
}
