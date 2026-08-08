import Link from 'next/link';
import { Container, Card } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { loadPublicCaseTypes } from '@/lib/api/public-catalog';

/** Must be a literal — Next.js analyses segment config statically. */
export const revalidate = 3600;

const VALUE_PROPS = [
  {
    title: 'Digital case submission',
    body: 'Submit cases with STL scans, clinical notes, and specifications through a guided multi-step form.',
  },
  {
    title: 'Real-time tracking',
    body: 'Follow every case from received to shipped with a transparent production timeline.',
  },
  {
    title: 'Invoices & statements',
    body: 'Download invoices, pay online, and receive monthly statements — all in one place.',
  },
];

export default async function HomePage() {
  /** Same admin-managed catalog the Services page reads — never a static list. */
  const caseTypes = await loadPublicCaseTypes();

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <Container className="py-14 sm:py-20 lg:py-28">
          <div className="max-w-2xl">
            <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
              For dental practices
            </span>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              Precision dental work, fully digital
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-600 sm:text-lg">
              Send cases, upload 3D scans, and track production without a single phone call. A
              modern portal that connects your practice to our laboratory.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/contact" className={buttonClasses('primary', 'lg')}>
                Become a partner
              </Link>
              <Link href="/how-to-send-a-case" className={buttonClasses('outline', 'lg')}>
                How it works
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Value props */}
      <section className="py-14 sm:py-20">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Everything your practice needs
            </h2>
            <p className="mt-4 text-slate-600">
              A single workflow from submission to payment, designed to save your team time.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:mt-14 md:grid-cols-3">
            {VALUE_PROPS.map((v) => (
              <Card key={v.title}>
                <h3 className="text-lg font-semibold text-slate-900">{v.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{v.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* Services summary */}
      <section className="bg-slate-900 py-14 text-white sm:py-20">
        <Container className="text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Case types we handle</h2>
          {caseTypes.length > 0 && (
            <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2 sm:gap-3">
              {caseTypes.map((type) => (
                <span
                  key={type.id}
                  className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm"
                >
                  {type.name}
                </span>
              ))}
            </div>
          )}
          <div className="mt-10">
            <Link href="/services" className={buttonClasses('primary', 'lg')}>
              Explore services
            </Link>
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="py-14 sm:py-20">
        <Container>
          <Card className="flex flex-col items-center gap-6 bg-brand-700 p-8 text-center text-white sm:p-12">
            <h2 className="text-2xl font-bold sm:text-3xl">Ready to send your first case?</h2>
            <p className="max-w-xl text-brand-50">
              Get in touch and we&apos;ll set up your practice with portal access.
            </p>
            <Link href="/contact" className={buttonClasses('secondary', 'lg')}>
              Contact the lab
            </Link>
          </Card>
        </Container>
      </section>
    </>
  );
}
