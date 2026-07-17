import Link from 'next/link';
import { Container, Card } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';

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

const SERVICES = ['Crowns', 'Bridges', 'Implants', 'Veneers', 'Dentures', 'Aligners'];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <Container className="grid gap-10 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
          <div>
            <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
              For dental practices
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Precision dental work, fully digital
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              Send cases, upload 3D scans, and track production without a single phone call. A modern
              portal that connects your practice to our laboratory.
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
          <Card className="border-brand-100 bg-white/70 p-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-700">
              Turnaround at a glance
            </h2>
            <dl className="mt-6 grid grid-cols-2 gap-6">
              {[
                ['48h', 'Average crown turnaround'],
                ['99.5%', 'On-time delivery'],
                ['100MB', 'Max STL upload per file'],
                ['24/7', 'Case status visibility'],
              ].map(([stat, label]) => (
                <div key={label}>
                  <dt className="text-3xl font-bold text-slate-900">{stat}</dt>
                  <dd className="mt-1 text-sm text-slate-500">{label}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </Container>
      </section>

      {/* Value props */}
      <section className="py-20">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-slate-900">Everything your practice needs</h2>
            <p className="mt-4 text-slate-600">
              A single workflow from submission to payment, designed to save your team time.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
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
      <section className="bg-slate-900 py-20 text-white">
        <Container className="text-center">
          <h2 className="text-3xl font-bold">Case types we handle</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            From single-unit crowns to full-arch restorations and clear aligners.
          </p>
          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-3">
            {SERVICES.map((s) => (
              <span
                key={s}
                className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm"
              >
                {s}
              </span>
            ))}
          </div>
          <div className="mt-10">
            <Link href="/services" className={buttonClasses('primary', 'lg')}>
              Explore services
            </Link>
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="py-20">
        <Container>
          <Card className="flex flex-col items-center gap-6 bg-brand-700 p-12 text-center text-white">
            <h2 className="text-3xl font-bold">Ready to send your first case?</h2>
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
