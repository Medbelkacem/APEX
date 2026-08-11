import Link from 'next/link';
import { Container, Card } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { CtaBand, Icon, IconTile, outlineOnBrand } from '@/components/marketing';
import { loadPublicCaseTypes } from '@/lib/api/public-catalog';

/** Must be a literal — Next.js analyses segment config statically. */
export const revalidate = 3600;

const VALUE_PROPS = [
  {
    title: 'Digital case submission',
    body: 'Submit cases with STL scans, clinical notes, and specifications through a guided multi-step form.',
    icon: (
      <>
        <path d="M12 16V4m0 0L8 8m4-4 4 4" />
        <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      </>
    ),
  },
  {
    title: 'Real-time tracking',
    body: 'Follow every case from received to shipped with a transparent production timeline.',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
  },
  {
    title: 'Invoices & statements',
    body: 'Download invoices, pay online, and receive monthly statements — all in one place.',
    icon: (
      <>
        <path d="M6 3.5h12v17l-2.5-1.75L13 20.5l-2.5-1.75L8 20.5 6 19.25z" />
        <path d="M9.5 8.5h5M9.5 12h5" />
      </>
    ),
  },
];

/** Condensed from the How to Send a Case page, which carries the full version. */
const STEPS = [
  {
    title: 'Register your practice',
    body: 'Create an account with your clinic details. The laboratory reviews it and opens portal access.',
  },
  {
    title: 'Send the case',
    body: 'Choose a case type, add the patient reference and specifications, then attach your scans.',
  },
  {
    title: 'Track to delivery',
    body: 'Watch each status change, download deliverables, and settle invoices without a phone call.',
  },
];

/** The formats the portal actually accepts, with their real per-file ceilings. */
const FORMATS = [
  { label: 'STL scans', detail: 'Binary or ASCII, up to 100 MB per file' },
  { label: 'Photographs', detail: 'JPG or PNG, up to 10 MB each' },
  { label: 'Documents', detail: 'PDF, up to 25 MB each' },
];

/** The default lab workflow, shown as an illustration rather than live data. */
const PIPELINE = [
  { label: 'Received', state: 'done' },
  { label: 'In Production', state: 'current' },
  { label: 'Shipped', state: 'todo' },
] as const;

export default async function HomePage() {
  /** Same admin-managed catalog the Services page reads — never a static list. */
  const caseTypes = await loadPublicCaseTypes();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-brand-50 via-brand-50/40 to-white">
        {/* Soft brand wash behind the copy; purely decorative. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-brand-200/40 blur-3xl"
        />
        <Container className="relative py-14 sm:py-20 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
                For dental practices
              </span>
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                Precision dental work,{' '}
                {/* Kept on one line so the accent never breaks mid-phrase. */}
                <span className="whitespace-nowrap text-brand-700">fully digital</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Send cases, upload 3D scans, and track production without a single phone call. A
                modern portal that connects your practice to our laboratory.
              </p>
              {/* Full-width and stacked on a phone; side by side from `sm` up. */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
                <Link
                  href="/register"
                  className={`${buttonClasses('primary', 'lg')} w-full sm:w-auto`}
                >
                  Register your practice
                </Link>
                <Link
                  href="/how-to-send-a-case"
                  className={`${buttonClasses('outline', 'lg')} w-full sm:w-auto`}
                >
                  How it works
                </Link>
              </div>
              <p className="mt-5 text-sm text-slate-500">
                Already a partner?{' '}
                <Link href="/login" className="font-medium text-brand-700 hover:underline">
                  Sign in to the portal
                </Link>
              </p>
            </div>

            {/* Illustration of the workflow the portal tracks. */}
            <Card
              aria-hidden="true"
              className="hidden bg-white/80 p-5 shadow-md backdrop-blur lg:block"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Case progress
              </p>
              <ol className="mt-4 space-y-1">
                {PIPELINE.map((stage, index) => (
                  <li key={stage.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={
                          stage.state === 'todo'
                            ? 'mt-1 h-3 w-3 rounded-full border-2 border-slate-300 bg-white'
                            : 'mt-1 h-3 w-3 rounded-full bg-brand-600'
                        }
                      />
                      {index < PIPELINE.length - 1 && (
                        <span className="my-1 w-px flex-1 bg-slate-200" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p
                        className={
                          stage.state === 'todo'
                            ? 'text-sm text-slate-400'
                            : 'text-sm font-medium text-slate-800'
                        }
                      >
                        {stage.label}
                      </p>
                      {stage.state === 'current' && (
                        <p className="text-xs text-brand-700">In progress</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {['STL', 'JPG', 'PNG', 'PDF'].map((format) => (
                  <span
                    key={format}
                    className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                  >
                    {format}
                  </span>
                ))}
              </div>
            </Card>
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
              <Card key={v.title} className="transition-shadow hover:shadow-md">
                <IconTile>
                  <Icon>{v.icon}</Icon>
                </IconTile>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{v.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="border-y border-slate-200 bg-white py-14 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Three steps to your first case
              </h2>
              <p className="mt-4 text-slate-600">
                No new software to install — everything runs in the browser your practice already
                uses.
              </p>
              <Link
                href="/how-to-send-a-case"
                className="mt-6 inline-flex text-sm font-semibold text-brand-700 hover:underline"
              >
                Read the full walkthrough →
              </Link>
            </div>

            <ol className="grid gap-4 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* Services summary — rendered only when the catalog answered. */}
      {caseTypes.length > 0 && (
        <section className="bg-slate-900 py-14 text-white sm:py-20">
          <Container className="text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">Case types we handle</h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">
              Every restoration below can be ordered straight from the portal.
            </p>
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
            <div className="mt-10">
              <Link href="/services" className={buttonClasses('primary', 'lg')}>
                Explore services
              </Link>
            </div>
          </Container>
        </section>
      )}

      {/* Accepted files */}
      <section className="py-14 sm:py-20">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Send the files you already have
            </h2>
            <p className="mt-4 text-slate-600">
              Upload straight from your intraoral scanner or design software — every case needs at
              least one attachment.
            </p>
          </div>
          <dl className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-3">
            {FORMATS.map((format) => (
              <div key={format.label} className="rounded-xl border border-slate-200 bg-white p-5">
                <dt className="font-semibold text-slate-900">{format.label}</dt>
                <dd className="mt-1 text-sm text-slate-600">{format.detail}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <CtaBand
        title="Ready to send your first case?"
        body="Register your practice in a few minutes, or get in touch and we'll walk you through portal access."
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
