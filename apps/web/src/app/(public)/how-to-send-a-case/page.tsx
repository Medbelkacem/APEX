import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/card';
import { CtaBand, Display, PageHeader, SectionRule, ctaClasses } from '@/components/marketing';

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
        lede="Getting a case to the lab takes just a few minutes once your practice is set up."
      />

      <section className="py-16 sm:py-24">
        <Container>
          <div className="mx-auto max-w-3xl">
            <ol className="space-y-5">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  {/*
                   * No rail between the badges: the steps used to be white
                   * cards where a hairline was the only thing sequencing them,
                   * and against a solid Super Blue pill it reads as a seam
                   * rather than a connector. The numbers carry the order.
                   */}
                  <div className="flex gap-5 rounded-[1.75rem] bg-blue-600 p-6 text-white shadow-pill sm:gap-6 sm:p-7">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy-700 font-bold">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold">{step.title}</h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-white/85">{step.body}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <section className="bg-navy-700 py-16 text-white sm:py-24">
        <Container>
          <div className="mx-auto max-w-3xl">
            <SectionRule />
            <Display className="mt-6 text-3xl sm:text-4xl">File format requirements</Display>
            <p className="mt-5 leading-relaxed text-white/75">
              Anything outside this list is refused at upload — the portal checks the contents of
              each file, not just its extension.
            </p>
            <dl className="mt-10 grid gap-5 sm:grid-cols-3">
              {FORMATS.map((format) => (
                <div
                  key={format.label}
                  className="rounded-[1.5rem] border border-white/20 bg-white/5 p-6"
                >
                  <dt className="font-bold">{format.label}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-white/70">{format.detail}</dd>
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
