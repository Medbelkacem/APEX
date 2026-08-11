import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Card } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/data-states';
import { CtaBand, PageHeader, outlineOnBrand } from '@/components/marketing';
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
    <>
      <PageHeader
        eyebrow="Case types"
        title="Our services"
        lede="A complete range of restorative and orthodontic case types, all orderable through the portal."
      />

      <section className="py-12 sm:py-16">
        <Container>
          {services.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <Card key={s.name} className="transition-shadow hover:shadow-md">
                  <h2 className="text-lg font-semibold text-slate-900">{s.name}</h2>
                  {s.description && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.description}</p>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            /*
             * The catalog is the laboratory's own, and comes back empty when the
             * API cannot be reached. Saying so is the only honest option — a
             * hard-coded stand-in list would advertise work the lab may not do.
             */
            <Card className="p-0">
              <EmptyState
                title="The case-type list is unavailable right now"
                description="Please try again shortly, or ask the laboratory for the current list."
                action={
                  <Link href="/contact" className={buttonClasses('primary', 'md')}>
                    Contact the lab
                  </Link>
                }
              />
            </Card>
          )}
        </Container>
      </section>

      <CtaBand
        title="Need pricing for your practice?"
        body="Ask the laboratory for a price list, or see what sending a case involves."
      >
        <Link href="/contact" className={buttonClasses('secondary', 'lg')}>
          Request pricing
        </Link>
        <Link href="/how-to-send-a-case" className={outlineOnBrand}>
          How to send a case
        </Link>
      </CtaBand>
    </>
  );
}
