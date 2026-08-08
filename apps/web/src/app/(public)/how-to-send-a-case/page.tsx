import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Card } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'How to Send a Case',
  description:
    'Step-by-step onboarding: register, submit a case, file format requirements, and turnaround.',
};

const STEPS = [
  {
    title: 'Register your practice',
    body: 'Contact us to receive a portal invitation. Set your password from the emailed link and complete your practice profile.',
  },
  {
    title: 'Start a new case',
    body: 'Choose the case type, add the patient reference, tooth/region, material, shade, and deadline in the guided form.',
  },
  {
    title: 'Upload your scans',
    body: 'Drag and drop one or more STL files (binary or ASCII, up to 100 MB each). Add photos or PDFs as supporting attachments.',
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

export default function HowToSendACasePage() {
  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">How to send a case</h1>
        <p className="mt-4 text-base text-slate-600 sm:text-lg">
          Getting a case to our lab takes just a few minutes once your practice is set up.
        </p>

        <ol className="mt-12 space-y-6">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Card className="flex gap-4 p-5 sm:gap-5 sm:p-6">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-700 font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{step.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{step.body}</p>
                </div>
              </Card>
            </li>
          ))}
        </ol>

        <Card className="mt-10 bg-brand-50">
          <h2 className="text-lg font-semibold text-slate-900">File format requirements</h2>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600">
            <li>STL scans: binary or ASCII, up to 100 MB per file.</li>
            <li>Images: JPG, PNG, or WEBP, up to 10 MB each.</li>
            <li>Documents: PDF, up to 25 MB each.</li>
          </ul>
        </Card>

        <div className="mt-10">
          <Link href="/contact" className={buttonClasses('primary', 'lg')}>
            Request access
          </Link>
        </div>
      </div>
    </Container>
  );
}
