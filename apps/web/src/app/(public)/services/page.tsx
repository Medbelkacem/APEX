import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/data-states';
import { CtaBand, PageHeader, ctaClasses } from '@/components/marketing';
import { loadPublicCaseTypes } from '@/lib/api/public-catalog';

export const metadata: Metadata = {
  title: 'Services',
  description: 'The dental case types Apex accepts through the portal.',
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
        lede="High-demand restorations, refined rather than multiplied — every one of them orderable straight from the portal."
      />

      <section className="py-16 sm:py-24">
        <Container>
          {services.length > 0 ? (
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <li
                  key={s.name}
                  className="flex flex-col rounded-[1.75rem] bg-brand-600 p-7 text-white shadow-pill"
                >
                  <h2 className="text-xl font-bold">{s.name}</h2>
                  {s.description && (
                    <p className="mt-2.5 text-sm leading-relaxed text-white/85">{s.description}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            /*
             * The catalog is the laboratory's own, and comes back empty when the
             * API cannot be reached. Saying so is the only honest option — a
             * hard-coded stand-in list would advertise work the lab may not do.
             */
            <Card className="rounded-[1.75rem] border-navy-50 p-0">
              <EmptyState
                title="The case-type list is unavailable right now"
                description="Please try again shortly, or ask the laboratory for the current list."
                action={
                  <Link href="/contact" className={ctaClasses('blue')}>
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
        <Link href="/contact" className={ctaClasses('navy')}>
          Request pricing
        </Link>
        <Link href="/how-to-send-a-case" className={ctaClasses('blue')}>
          How to send a case
        </Link>
      </CtaBand>
    </>
  );
}
