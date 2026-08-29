'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The public navigation, which is two different lists depending on where you
 * are standing.
 *
 * The approved design draws one header: five anchors into the landing page's
 * own sections, in its own order and its own casing — two of the five are
 * deliberately lower case. That header is correct on the landing page and
 * nowhere else, because on /contact there is no #problems section to jump to.
 *
 * The DRS is equally clear that the marketing site is five navigable pages
 * (§Marketing Website, and the deliverables checklist), and that navigation is
 * consistent across each surface. Shipping the design's anchors everywhere
 * would satisfy the mockup by making three of those five unreachable.
 *
 * So the landing page gets the design's header, and every other public page
 * gets the routes. Each page carries the navigation that can actually work on
 * it. The one word that departs from the mockup is "Solutions", which the
 * design labels "Services" and the client has since renamed.
 */
export const LANDING_NAV = [
  { href: '/#main', label: 'Main' },
  { href: '/#problems', label: 'problems' },
  { href: '/#about', label: 'About' },
  { href: '/#services', label: 'Solutions' },
  { href: '/#contact', label: 'contact' },
];

/** The five public pages the DRS's deliverables checklist requires. */
export const PAGE_NAV = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Solutions' },
  { href: '/how-to-send-a-case', label: 'How to send a case' },
  { href: '/contact', label: 'Contact' },
];

/** Anchors on the landing page, routes everywhere else. */
export function useSiteNav(): Array<{ href: string; label: string }> {
  return usePathname() === '/' ? LANDING_NAV : PAGE_NAV;
}

/**
 * The nav as a list of links. Both the header and the footer render the same
 * five entries, so the choice of which five lives in one place.
 */
export function SiteNavLinks({
  ariaLabel,
  className,
  linkClassName,
  onNavigate,
}: {
  ariaLabel: string;
  className?: string;
  linkClassName?: string;
  onNavigate?: () => void;
}) {
  const items = useSiteNav();

  return (
    <nav className={className} aria-label={ariaLabel}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={linkClassName} onClick={onNavigate}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
