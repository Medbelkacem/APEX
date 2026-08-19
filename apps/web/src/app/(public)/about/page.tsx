import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Container } from '@/components/ui/card';
import {
  CtaBand,
  Display,
  Icon,
  IconTile,
  PageHeader,
  SectionRule,
  ctaClasses,
} from '@/components/marketing';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Apex is a focused-SKU digital lab partner for independent US general dentists — operational precision over a wide catalog.',
};

/**
 * The mission and vision are quoted from the brand guidelines; everything else
 * on this page describes only the workflow this software actually implements.
 *
 * Years in business, certifications, staffing, equipment and capacity are all
 * factual claims about a real business, and none of them can be invented by the
 * development team. The laboratory's own profile goes here when the laboratory
 * supplies it; until then a page that promises nothing is correct, and a
 * plausible-looking one is not.
 */
const SIGNPOSTS = [
  {
    title: 'What we make',
    body: 'The case types the laboratory accepts, kept in step with the portal catalog.',
    href: '/services',
    action: 'See the case types',
    icon: (
      <path d="M4 7.5C4 5.6 5.3 4.5 7 4.5c1.4 0 2 .6 2.8 1.4.7.7 1.6.7 2.4 0 .8-.8 1.4-1.4 2.8-1.4 1.7 0 3 1.1 3 3 0 3.3-1.2 6.6-2.3 9.4-.4 1-1 1.6-1.8 1.6-1 0-1.4-.8-1.6-2l-.4-2.3c-.1-.8-.5-1.2-.9-1.2s-.8.4-.9 1.2l-.4 2.3c-.2 1.2-.6 2-1.6 2-.8 0-1.4-.6-1.8-1.6C5.2 14.1 4 10.8 4 7.5Z" />
    ),
  },
  {
    title: 'How a case reaches us',
    body: 'Registering, the file formats we accept, and what happens after you submit.',
    href: '/how-to-send-a-case',
    action: 'Read the walkthrough',
    icon: (
      <>
        <path d="M12 16V4m0 0L8 8m4-4 4 4" />
        <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      </>
    ),
  },
  {
    title: 'Talk to the laboratory',
    body: 'Questions about partnering, pricing, or a case already in production.',
    href: '/contact',
    action: 'Get in touch',
    icon: (
      <path d="M20 15.5v2.4a1.6 1.6 0 0 1-1.8 1.6 15.6 15.6 0 0 1-6.8-2.4 15.4 15.4 0 0 1-4.7-4.7A15.6 15.6 0 0 1 4.3 5.6 1.6 1.6 0 0 1 5.9 3.9h2.4a1.6 1.6 0 0 1 1.6 1.4c.1.8.3 1.5.6 2.2a1.6 1.6 0 0 1-.4 1.7l-1 1a12.4 12.4 0 0 0 4.7 4.7l1-1a1.6 1.6 0 0 1 1.7-.4c.7.3 1.4.5 2.2.6a1.6 1.6 0 0 1 1.3 1.4Z" />
    ),
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="Operational precision, not a wide catalog"
        lede="Every case runs through one digital workflow: practices submit online, follow production as it happens, and settle invoices in the same portal."
      />

      {/* Mission & Vision — quoted from the brand guidelines. */}
      <section className="py-16 sm:py-24">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
            <div className="space-y-12">
              <div>
                <SectionRule />
                <Display className="mt-6 text-3xl text-navy-700 sm:text-4xl">Mission</Display>
                <p className="mt-5 max-w-2xl leading-relaxed text-navy-600/80">
                  To empower US-based independent general dentists by providing high-precision,
                  digital restorative solutions through a focused-SKU model that eliminates the
                  frustrations of unpredictable turnarounds and inconsistent fits. We are committed
                  to an operational-first approach, utilizing fully digital CAD/CAM workflows and
                  medical-grade materials to ensure every restoration — from a single crown to a
                  full-arch prosthesis — is delivered with absolute predictability and direct,
                  transparent communication.
                </p>
              </div>

              <div>
                <SectionRule />
                <Display className="mt-6 text-3xl text-navy-700 sm:text-4xl">Vision</Display>
                <p className="mt-5 max-w-2xl leading-relaxed text-navy-600/80">
                  To become the premier digital lab partner for digitally equipped dental practices
                  by redefining the standard of reliability in the restorative industry. We envision
                  a future where clinical stress and chair-time waste are minimized through
                  disciplined manufacturing and immediate, communication-first support, allowing
                  dentists to protect their profit margins and focus on superior patient care.
                </p>
              </div>
            </div>

            {/* Portrait source, so the column crops it barely at all. */}
            <div className="relative aspect-[3/4] overflow-hidden rounded-[1.75rem] shadow-pill">
              <Image
                src="/images/appliances.jpg"
                alt="Finished restorations laid out after production."
                fill
                sizes="(min-width: 1024px) 22rem, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </Container>
      </section>

      {/* Where to go next. */}
      <section className="bg-navy-700 py-16 text-white sm:py-24">
        <Container>
          <SectionRule />
          <Display className="mt-6 text-3xl sm:text-4xl">Find what you need</Display>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {SIGNPOSTS.map((item) => (
              <li key={item.title}>
                <Link
                  href={item.href}
                  className="flex h-full flex-col rounded-[1.75rem] bg-brand-600 p-7 shadow-pill transition-colors hover:bg-brand-500"
                >
                  <IconTile>
                    <Icon>{item.icon}</Icon>
                  </IconTile>
                  <h3 className="mt-5 text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-white/85">{item.body}</p>
                  <span className="mt-5 text-sm font-semibold">{item.action} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <CtaBand
        title="Work with us"
        body="Register your practice for portal access, or send the laboratory a message first."
      >
        <Link href="/register" className={ctaClasses('navy')}>
          Register your practice
        </Link>
        <Link href="/contact" className={ctaClasses('blue')}>
          Contact the lab
        </Link>
      </CtaBand>
    </>
  );
}
