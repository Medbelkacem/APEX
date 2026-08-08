import type { Metadata } from 'next';
import { Container, Card } from '@/components/ui/card';
import { ContactForm } from '@/components/forms/contact-form';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with our dental laboratory — address, phone, email, and contact form.',
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

export default function ContactPage() {
  const details = DETAILS.filter(([, value]) => Boolean(value?.trim()));

  return (
    <Container className="py-12 sm:py-16">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Contact us</h1>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Questions about partnering with the lab or sending a case? Send us a message and our
            team will respond promptly.
          </p>

          {details.length > 0 && (
            <dl className="mt-10 space-y-6 text-sm">
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt className="font-semibold text-slate-900">{label}</dt>
                  <dd className="mt-1 text-slate-600">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <Card>
          <ContactForm />
        </Card>
      </div>
    </Container>
  );
}
