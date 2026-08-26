import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Card } from '@/components/ui/card';
import { ContactForm } from '@/components/forms/contact-form';
import { Display, Icon, IconTile, PageHeader, SectionRule } from '@/components/marketing';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with Apex — address, phone, email, and contact form.',
};

/**
 * Real contact details are configuration, not code — the laboratory sets them in
 * the environment. A row with no configured value is omitted entirely rather
 * than rendered with a stand-in, so the page can never publish an address or
 * phone number that nobody can actually reach.
 */
const DETAILS: Array<[label: string, value: string | undefined]> = [
  ['Address', process.env.LAB_ADDRESS],
  ['Phone', process.env.LAB_PHONE],
  ['Email', process.env.LAB_EMAIL],
  ['Hours', process.env.LAB_HOURS],
];

/** Routes worth offering beside the form — all of them already exist. */
const SHORTCUTS = [
  {
    title: 'Register your practice',
    body: 'Open an account and the laboratory will review it.',
    href: '/register',
    icon: (
      <>
        <path d="M15.5 20v-1.6a3.2 3.2 0 0 0-3.2-3.2H6.7a3.2 3.2 0 0 0-3.2 3.2V20" />
        <circle cx="9.5" cy="8" r="3.2" />
        <path d="M18 8.5v5M20.5 11h-5" />
      </>
    ),
  },
  {
    title: 'How to send a case',
    body: 'What we need, which files we accept, and what happens next.',
    href: '/how-to-send-a-case',
    icon: (
      <>
        <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
        <path d="M13.5 3.8V8h4.2M8.5 13h7M8.5 16.5h4.5" />
      </>
    ),
  },
  {
    title: 'Portal login',
    body: 'Already a partner? Pick up a case where you left it.',
    href: '/login',
    icon: (
      <>
        <path d="M10 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
        <path d="M15 16.5 19.5 12 15 7.5M19 12H9.5" />
      </>
    ),
  },
];

export default function ContactPage() {
  const details = DETAILS.filter(([, value]) => Boolean(value?.trim()));

  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Talk to the lab"
        lede="Communication-first support is the point. Questions about partnering or a case already in production reach the team directly."
      />

      <section className="py-16 sm:py-24">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-14">
            <div className="space-y-6">
              {details.length > 0 && (
                <div className="rounded-[1.75rem] bg-navy-700 p-7 text-white">
                  <SectionRule />
                  <h2 className="mt-5 text-lg font-bold">Laboratory details</h2>
                  <dl className="mt-5 space-y-4 text-sm">
                    {details.map(([label, value]) => (
                      <div key={label}>
                        <dt className="font-semibold">{label}</dt>
                        <dd className="mt-0.5 text-white/70">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {/*
               * The laboratory may not have configured any contact details yet,
               * which would leave this column empty beside a tall form. These
               * shortcuts stand on their own either way.
               */}
              <ul className="space-y-5">
                {SHORTCUTS.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-start gap-5 rounded-[1.75rem] bg-blue-600 p-6 text-white shadow-pill transition-colors hover:bg-blue-500"
                    >
                      <IconTile>
                        <Icon>{item.icon}</Icon>
                      </IconTile>
                      <div className="min-w-0">
                        <p className="font-bold">{item.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-white/85">{item.body}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <Card className="rounded-[1.75rem] border-navy-50 p-7 sm:p-9">
              <Display as="h2" className="text-2xl text-navy-700 sm:text-3xl">
                Send a message
              </Display>
              <p className="mt-2 text-sm text-navy-600/70">
                Tell us a little about your practice and what you need.
              </p>
              <div className="mt-7">
                <ContactForm />
              </div>
            </Card>
          </div>
        </Container>
      </section>
    </>
  );
}
