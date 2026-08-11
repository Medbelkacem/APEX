import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Card } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { CtaBand, Icon, IconTile, PageHeader, outlineOnBrand } from '@/components/marketing';

export const metadata: Metadata = {
  title: 'About',
};

/**
 * Deliberately makes no claims about the laboratory itself.
 *
 * Years in business, certifications, staffing, equipment, capacity — every one
 * of those is a factual claim about a real business, and none of it can be
 * invented by the development team. What is on this page instead describes
 * only the workflow this software actually implements, which is verifiable by
 * reading it. The laboratory's own profile goes here when the laboratory
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
      <>
        <path d="M4 7.5C4 5.6 5.3 4.5 7 4.5c1.4 0 2 .6 2.8 1.4.7.7 1.6.7 2.4 0 .8-.8 1.4-1.4 2.8-1.4 1.7 0 3 1.1 3 3 0 3.3-1.2 6.6-2.3 9.4-.4 1-1 1.6-1.8 1.6-1 0-1.4-.8-1.6-2l-.4-2.3c-.1-.8-.5-1.2-.9-1.2s-.8.4-.9 1.2l-.4 2.3c-.2 1.2-.6 2-1.6 2-.8 0-1.4-.6-1.8-1.6C5.2 14.1 4 10.8 4 7.5Z" />
      </>
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
      <>
        <path d="M20 15.5v2.4a1.6 1.6 0 0 1-1.8 1.6 15.6 15.6 0 0 1-6.8-2.4 15.4 15.4 0 0 1-4.7-4.7A15.6 15.6 0 0 1 4.3 5.6 1.6 1.6 0 0 1 5.9 3.9h2.4a1.6 1.6 0 0 1 1.6 1.4c.1.8.3 1.5.6 2.2a1.6 1.6 0 0 1-.4 1.7l-1 1a12.4 12.4 0 0 0 4.7 4.7l1-1a1.6 1.6 0 0 1 1.7-.4c.7.3 1.4.5 2.2.6a1.6 1.6 0 0 1 1.3 1.4Z" />
      </>
    ),
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="About the laboratory"
        lede="Every case runs through one digital workflow: practices submit online, follow production as it happens, and settle invoices in the same portal."
      />

      <section className="py-12 sm:py-16">
        <Container>
          <div className="grid gap-6 md:grid-cols-3">
            {SIGNPOSTS.map((item) => (
              <Card key={item.title} className="flex flex-col transition-shadow hover:shadow-md">
                <IconTile>
                  <Icon>{item.icon}</Icon>
                </IconTile>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{item.body}</p>
                <Link
                  href={item.href}
                  className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline"
                >
                  {item.action} →
                </Link>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand
        title="Work with us"
        body="Register your practice for portal access, or send the laboratory a message first."
      >
        <Link href="/register" className={buttonClasses('secondary', 'lg')}>
          Register your practice
        </Link>
        <Link href="/contact" className={outlineOnBrand}>
          Contact the lab
        </Link>
      </CtaBand>
    </>
  );
}
