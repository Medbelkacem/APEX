import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Container, Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/data-states';
import { CtaBand, Display, SectionRule, ctaClasses } from '@/components/marketing';
import { loadPublicCaseTypes } from '@/lib/api/public-catalog';

export const metadata: Metadata = {
  title: 'Solutions',
  description: 'The dental case types Apex accepts through the portal.',
};

/** Must be a literal — Next.js analyses segment config statically. */
export const revalidate = 3600;

/**
 * The design's headline counts the restorations out loud — "Four Perfected Core
 * Solutions" — which only stays true while the catalog holds four. As on the
 * landing page, the numeral is read off whatever the laboratory has actually
 * published rather than printed over a grid that might contradict it, and drops
 * out entirely past the point where spelling it would read as a boast.
 */
const COUNT_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

function solutionsHeading(count: number): string {
  const word = COUNT_WORDS[count];
  return word ? `${word} Perfected Core Solutions` : 'Perfected Core Solutions';
}

export default async function SolutionsPage() {
  const solutions = await loadPublicCaseTypes();

  return (
    <>
      {/*
       * The design's "Four Perfected Core Solutions" band, carried over from the
       * landing page so the two surfaces present the same four restorations the
       * same way — the photograph of stone models bled behind an Oxford Navy
       * wash, and the glass cards two up on it.
       */}
      {/*
       * Padded exactly as the landing page pads it, so the photograph behind
       * the cards crops to the same frame on both — except at the narrowest
       * width, where the top has to clear an 80px header the landing page does
       * not have above this band.
       */}
      <section
        aria-labelledby="solutions-heading"
        className="relative isolate overflow-hidden bg-navy-700 py-16 pt-24 text-white sm:py-24 lg:py-32"
      >
        <Image
          src="/images/models.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-25 mix-blend-luminosity"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-navy-700/75" />

        <Container className="relative">
          <div className="text-center">
            <SectionRule className="mx-auto bg-white" />
            <Display
              as="h1"
              id="solutions-heading"
              className="mx-auto mt-10 max-w-[68rem] text-3xl sm:text-4xl lg:text-[4.5rem]"
            >
              {solutionsHeading(solutions.length)}
            </Display>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-white/85">
              Instead of offering dozens of services, Apex refines and optimizes a limited number of
              high-demand restorations. This reduces error rates and improves consistency.
            </p>
          </div>

          {/*
           * Two up, as the design has it — but laid out with wrapping rather
           * than a grid so that a catalog with an odd number of case types
           * centres its last card instead of leaving a hole beside it.
           */}
          {solutions.length > 0 && (
            <ul className="mx-auto mt-12 flex max-w-[66.5rem] flex-wrap justify-center gap-[1.875rem] sm:mt-16">
              {solutions.map((s) => (
                <li
                  key={s.name}
                  className="flex min-h-[11rem] w-full flex-col items-center justify-center rounded-[1.75rem] border border-white/30 bg-white/[0.14] p-8 text-center backdrop-blur-sm sm:w-[calc(50%-0.9375rem)] sm:p-10"
                >
                  <h2 className="text-xl font-bold sm:text-[1.75rem]">{s.name}</h2>
                  {s.description && (
                    <p className="mt-2 max-w-sm text-[0.9375rem] leading-relaxed text-white/85 sm:text-[1.0625rem]">
                      {s.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Container>
      </section>

      {/*
       * The catalog is the laboratory's own, and comes back empty when the API
       * cannot be reached. Saying so is the only honest option — a hard-coded
       * stand-in list would advertise work the lab may not do.
       */}
      {solutions.length === 0 && (
        <section className="py-16 sm:py-24">
          <Container>
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
          </Container>
        </section>
      )}

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
