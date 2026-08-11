import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Card } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { CtaBand, PageHeader, outlineOnBrand } from '@/components/marketing';

export const metadata: Metadata = {
  title: 'How to Send a Case',
  description:
    'Step-by-step onboarding: register, submit a case, file format requirements, and turnaround.',
};

const STEPS = [
  {
    title: 'Register your practice',
    body: 'Create an account with your name, email, and clinic details. Confirm your address from the emailed link — the laboratory reviews the application and opens portal access.',
  },
  {
    title: 'Start a new case',
    body: 'Choose the case type, add the patient reference, tooth/region, material, shade, and deadline in the guided form.',
  },
  {
    title: 'Upload your scans',
    body: 'Drag and drop your STL files, photos, or PDFs. At least one file is required — a case cannot be submitted without something for the technician to work from.',
  },
  {
    title: 'Add clinical notes & submit',
    body: 'Include any instructions, review the summary, and submit. You will receive a case reference number instantly.',
  },
  {
    title: 'Track to completion',
    body: 'Follow status updates from Received through Shipped. Download deliverables and invoices when ready.',
  },
];

/** The formats the portal accepts, with the ceilings the uploader enforces. */
const FORMATS = [
  { label: 'STL scans', detail: 'Binary or ASCII, up to 100 MB per file' },
  { label: 'Photographs', detail: 'JPG or PNG, up to 10 MB each' },
  { label: 'Documents', detail: 'PDF, up to 25 MB each' },
];

export default function HowToSendACasePage() {
  return (
    <>
      <PageHeader
        eyebrow="Getting started"
        title="How to send a case"
        lede="Getting a case to our lab takes just a few minutes once your practice is set up."
      />

      <section className="py-12 sm:py-16">
        <Container>
          <div className="mx-auto max-w-3xl">
            <ol className="space-y-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="relative">
                  {/* Rail joining this step's badge to the next one. */}
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-11 top-16 hidden h-[calc(100%-2.5rem)] w-px bg-slate-200 sm:block"
                    />
                  )}
                  <Card className="flex gap-4 p-5 transition-shadow hover:shadow-md sm:gap-5 sm:p-6">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-700 font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-slate-900">{step.title}</h2>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.body}</p>
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <section className="border-y border-slate-200 bg-white py-12 sm:py-16">
        <Container>
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              File format requirements
            </h2>
            <p className="mt-3 text-slate-600">
              Anything outside this list is refused at upload — the portal checks the contents of
              each file, not just its extension.
            </p>
            <dl className="mt-8 grid gap-4 sm:grid-cols-3">
              {FORMATS.map((format) => (
                <div
                  key={format.label}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-5"
                >
                  <dt className="font-semibold text-slate-900">{format.label}</dt>
                  <dd className="mt-1 text-sm text-slate-600">{format.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </section>

      <CtaBand
        title="Ready when you are"
        body="Register your practice to get portal access, or ask the laboratory anything first."
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
