import Link from 'next/link';
import { Container } from '@/components/ui/card';
import { LogoMark } from '@/components/ui/logo';
import { Icon } from '@/components/marketing';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Services' },
  { href: '/how-to-send-a-case', label: 'How to send a case' },
  { href: '/contact', label: 'Contact' },
];

/** The laboratory's own phone number, as a dialable link. */
const phone = process.env.LAB_PHONE?.trim();

/**
 * Only the channels the laboratory has actually configured are rendered. A
 * social circle that links nowhere is worse than an absent one, so an unset
 * variable drops the icon rather than pointing it at a placeholder profile.
 */
const SOCIALS: Array<{ label: string; href: string | undefined; icon: React.ReactNode }> = [
  {
    label: 'Instagram',
    href: process.env.LAB_INSTAGRAM_URL,
    icon: (
      <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="3.8" />
        <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    label: 'Phone',
    href: phone ? `tel:${phone.replace(/\s+/g, '')}` : undefined,
    icon: (
      <path d="M20 15.5v2.4a1.6 1.6 0 0 1-1.8 1.6 15.6 15.6 0 0 1-6.8-2.4 15.4 15.4 0 0 1-4.7-4.7A15.6 15.6 0 0 1 4.3 5.6 1.6 1.6 0 0 1 5.9 3.9h2.4a1.6 1.6 0 0 1 1.6 1.4c.1.8.3 1.5.6 2.2a1.6 1.6 0 0 1-.4 1.7l-1 1a12.4 12.4 0 0 0 4.7 4.7l1-1a1.6 1.6 0 0 1 1.7-.4c.7.3 1.4.5 2.2.6a1.6 1.6 0 0 1 1.3 1.4Z" />
    ),
  },
  {
    label: 'Facebook',
    href: process.env.LAB_FACEBOOK_URL,
    icon: (
      <path d="M14.8 21v-7.6h2.6l.4-3h-3V8.5c0-.9.25-1.5 1.5-1.5H18V4.3A20 20 0 0 0 15.7 4c-2.3 0-3.9 1.4-3.9 4v2.4H9.2v3h2.6V21" />
    ),
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  const socials = SOCIALS.filter((s) => Boolean(s.href?.trim()));

  return (
    <footer className="bg-navy-700 text-white">
      <Container className="py-14 sm:py-16">
        {/*
         * Three columns rather than `justify-between`, so the nav stays in the
         * middle of the footer whether or not the laboratory has configured any
         * social links — with two children, spacing them apart would throw the
         * links against the right edge.
         */}
        <div className="flex flex-col items-center gap-10 lg:grid lg:grid-cols-[auto_1fr_auto] lg:gap-8">
          <Link href="/" aria-label="Apex — home" className="text-white lg:justify-self-start">
            <LogoMark className="h-20 w-20" />
          </Link>

          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3" aria-label="Footer">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-white/80 transition-colors hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <ul className="flex items-center gap-3 lg:justify-self-end">
            {socials.map((social) => (
              <li key={social.label}>
                <a
                  href={social.href}
                  aria-label={social.label}
                  className="grid h-12 w-12 place-items-center rounded-full bg-white text-navy-700 transition-colors hover:bg-pearl"
                >
                  <Icon className="h-5 w-5">{social.icon}</Icon>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <hr className="mt-12 border-white/15" />

        <div className="mt-8 space-y-2 text-center text-sm">
          <p className="font-medium">© {year} Apex Digital Lab. All rights reserved.</p>
          <p className="text-white/60">
            Focused-SKU digital lab partner exclusively for independent US general dentists.
          </p>
          <p className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2 text-white/60">
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/login" className="hover:text-white">
              Portal login
            </Link>
          </p>
        </div>
      </Container>
    </footer>
  );
}
