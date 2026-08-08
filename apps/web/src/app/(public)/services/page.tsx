import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Card } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { loadPublicCaseTypes } from '@/lib/api/public-catalog';

export const metadata: Metadata = {
  title: 'Services',
  description: 'The dental case types our laboratory accepts through the portal.',
};

/** Must be a literal — Next.js analyses segment config statically. */
export const revalidate = 3600;

export default async function ServicesPage() {
  const services = await loadPublicCaseTypes();

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Our services</h1>
        <p className="mt-4 text-base text-slate-600 sm:text-lg">
          A complete range of restorative and orthodontic case types, all orderable through the
          portal.
        </p>
      </div>

      {services.length > 0 && (
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Card key={s.name}>
              <h2 className="text-lg font-semibold text-slate-900">{s.name}</h2>
              {s.description && <p className="mt-2 text-sm text-slate-600">{s.description}</p>}
            </Card>
          ))}
        </div>
      )}

      <div className="mt-14 text-center">
        <Link href="/contact" className={buttonClasses('primary', 'lg')}>
          Request pricing
        </Link>
      </div>
    </Container>
  );
}
