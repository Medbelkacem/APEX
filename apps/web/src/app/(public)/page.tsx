import Image from 'next/image';
import Link from 'next/link';
import { Container } from '@/components/ui/card';
import { CtaBand, Display, FeaturePill, SectionRule, ctaClasses } from '@/components/marketing';
import { loadPublicCaseTypes } from '@/lib/api/public-catalog';

/** Must be a literal — Next.js analyses segment config statically. */
export const revalidate = 3600;

/** "Lab Reality" — the four frustrations the brand positions against. */
const PROBLEMS = [
  {
    title: 'Unreliable turnaround',
    body: 'Erratic lab timelines hinder scheduling and managing patient expectations.',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
  },
  {
    title: 'Inconsistent fit',
    body: 'Poor fit and remakes interrupt treatment flow and waste valuable chair time.',
    icon: (
      <>
        <path d="M12 4.5 21 19.5H3z" />
        <path d="M12 10v4M12 16.8h.01" />
      </>
    ),
  },
  {
    title: 'Slow lab communication',
    body: 'Delayed responses and complex channels create friction during cases.',
    icon: (
      <>
        <path d="M20.5 12a7.8 7.8 0 0 1-8.5 7.7L6.5 21l1.2-4.2A7.8 7.8 0 1 1 20.5 12Z" />
        <path d="M12 8.5v3.5M12 15.2h.01" />
      </>
    ),
  },
  {
    title: 'Unclear pricing',
    body: 'Variable fees and vague policies hinder cost forecasting and margin protection.',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M14.5 9.3a2.6 2.6 0 0 0-2.5-1.5c-1.5 0-2.4.8-2.4 1.9 0 2.7 5 1.5 5 4.3 0 1.2-1 2.1-2.6 2.1a2.7 2.7 0 0 1-2.6-1.6M12 6.2v11.6" />
      </>
    ),
  },
];

/** "Our Core Solutions" — what Apex does about each of them. */
const SOLUTIONS = [
  {
    title: 'Direct communication',
    body: 'Immediate access to our team via WhatsApp. No phone trees, no delays.',
    icon: (
      <>
        <path d="M20.5 11.5a7.8 7.8 0 0 1-8.5 7.7L6.5 20.5l1.2-4.2A7.8 7.8 0 1 1 20.5 11.5Z" />
      </>
    ),
  },
  {
    title: 'Focused-SKU model',
    body: 'We don’t do everything. We do four things flawlessly to reduce error rates.',
    icon: <path d="M13.5 3 5 13.5h5.5L10 21l8.5-10.5H13z" />,
  },
  {
    title: 'Clinically proven',
    body: '100% medical-grade multi-layered zirconia and IPS e.max. No experimental gimmicks.',
    icon: (
      <>
        <circle cx="12" cy="9.5" r="5.5" />
        <path d="M8.5 14.2 7.5 21l4.5-2.3L16.5 21l-1-6.8" />
      </>
    ),
  },
  {
    title: 'Clear pricing',
    body: 'Transparent rates and a clearly defined remake policy to protect your margins.',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M14.5 9.3a2.6 2.6 0 0 0-2.5-1.5c-1.5 0-2.4.8-2.4 1.9 0 2.7 5 1.5 5 4.3 0 1.2-1 2.1-2.6 2.1a2.7 2.7 0 0 1-2.6-1.6M12 6.2v11.6" />
      </>
    ),
  },
];

/**
 * The four restorations named in the brand's own landing-page design.
 *
 * The live catalog is the laboratory's and is what the Services page and the
 * case form read, so it wins whenever it answers — and it is shown whole, never
 * trimmed to four, because hiding a case type the lab actually accepts would
 * misrepresent the offering just as surely as inventing one. This list is only
 * the fallback for an unreachable API, and it is the brand's copy rather than
 * anything made up here.
 */
const CORE_SKUS: Array<{ name: string; description: string | null }> = [
  { name: 'Full Contour Zirconia', description: 'Reliable fit for everyday restorations.' },
  { name: 'IPS e.max Crown', description: 'High aesthetics with controlled turnaround.' },
  { name: 'Screw-Retained Zirconia', description: 'Reduced complication risk.' },
  {
    name: 'Zirconia Full-Arch Implant',
    description: 'Structured, predictable workflow for high-value cases.',
  },
];

/** What a first trial with the lab includes. */
const TRIAL = [
  {
    title: 'First remake covered',
    body: 'Zero cost on your first remake',
    icon: (
      <>
        <path d="M4 11.5h16V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM3 7.5h18v4H3zM12 7.5V21" />
        <path d="M12 7.5S10.8 3 8.4 3a2.2 2.2 0 0 0 0 4.5zM12 7.5S13.2 3 15.6 3a2.2 2.2 0 0 1 0 4.5z" />
      </>
    ),
  },
  {
    title: 'Direct support',
    body: 'Dedicated WhatsApp access',
    icon: (
      <path d="M20 15.5v2.4a1.6 1.6 0 0 1-1.8 1.6 15.6 15.6 0 0 1-6.8-2.4 15.4 15.4 0 0 1-4.7-4.7A15.6 15.6 0 0 1 4.3 5.6 1.6 1.6 0 0 1 5.9 3.9h2.4a1.6 1.6 0 0 1 1.6 1.4c.1.8.3 1.5.6 2.2a1.6 1.6 0 0 1-.4 1.7l-1 1a12.4 12.4 0 0 0 4.7 4.7l1-1a1.6 1.6 0 0 1 1.7-.4c.7.3 1.4.5 2.2.6a1.6 1.6 0 0 1 1.3 1.4Z" />
    ),
  },
  {
    title: 'Full contour zirconia',
    body: 'Flat rate for your first month',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M14.5 9.3a2.6 2.6 0 0 0-2.5-1.5c-1.5 0-2.4.8-2.4 1.9 0 2.7 5 1.5 5 4.3 0 1.2-1 2.1-2.6 2.1a2.7 2.7 0 0 1-2.6-1.6M12 6.2v11.6" />
      </>
    ),
  },
];

/**
 * The design's headline counts the restorations out loud — "Four Perfected Core
 * Solutions" — which only stays true while the catalog holds four. Rather than
 * print a number the grid below contradicts, the numeral is read off whatever
 * the laboratory has actually published, and drops out entirely past the point
 * where spelling it would read as a boast.
 */
const COUNT_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

function solutionsHeading(count: number): string {
  const word = COUNT_WORDS[count];
  return word ? `${word} Perfected Core Solutions` : 'Perfected Core Solutions';
}

export default async function HomePage() {
  /** Same admin-managed catalog the Services page reads — never a static list. */
  const caseTypes = await loadPublicCaseTypes();
  const skus = caseTypes.length > 0 ? caseTypes : CORE_SKUS;

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {/*
       * The design gives the hero roughly 900px of height at desktop, which is
       * more than the copy needs — a minimum plus vertical centring holds that
       * proportion without padding that has to be re-tuned per breakpoint.
       */}
      <section className="relative isolate flex min-h-[36rem] items-center overflow-hidden bg-navy-800 lg:min-h-[50rem]">
        <Image
          src="/images/lab-workstation.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/*
         * The design turns the photograph into a Super Blue duotone. `color`
         * takes the hue from the overlay and the light from the picture, which
         * is what keeps the workstation readable; multiplying instead would
         * crush it to a navy silhouette. The gradient on top is only there to
         * darken the two edges the headline and the header sit against.
         */}
        <div aria-hidden="true" className="absolute inset-0 bg-brand-600 mix-blend-color" />
        <div aria-hidden="true" className="absolute inset-0 bg-brand-700/55" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-navy-900/60 via-navy-900/30 to-navy-900/60"
        />

        <Container className="relative w-full pb-16 pt-32 text-center sm:pb-20 sm:pt-36">
          <Display
            as="h1"
            className="mx-auto max-w-[52rem] text-4xl text-white sm:text-5xl lg:text-[4rem]"
          >
            Stop Wasting Chair Time On Unpredictable Lab Work.
          </Display>
          <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
            Apex is a digital lab partner for US general dentists — built around operational
            precision, not a wide catalog. Four high-demand restorations. Consistent fit.
            Predictable turnaround.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/register" className={ctaClasses('pearl')}>
              Submit your case
            </Link>
            <Link href="/contact" className={ctaClasses('onDark')}>
              Book a consultation
            </Link>
          </div>
        </Container>
      </section>

      {/* ── Lab Reality ──────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24">
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
            {/* Copy first on a phone; the design keeps it right of the list on desktop. */}
            <div className="lg:order-2">
              <SectionRule />
              <Display className="mt-6 text-3xl text-navy-700 sm:text-4xl lg:text-[3.25rem]">
                Lab Reality
              </Display>
              <p className="mt-5 max-w-xl leading-relaxed text-navy-600/80">
                Unpredictable lab performance creates operational stress inside busy dental
                practices. These are the issues most dentists face when working with traditional
                labs.
              </p>
              <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded-[1.75rem] shadow-pill">
                <Image
                  src="/images/chairside.jpg"
                  alt="A clinician seating a restoration chairside."
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>

            <ul className="space-y-5 lg:order-1 lg:pt-4">
              {PROBLEMS.map((problem) => (
                <li key={problem.title}>
                  <FeaturePill {...problem} />
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* ── Our Core Solutions ───────────────────────────────────────────── */}
      <section className="py-16 sm:py-24">
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionRule />
              <Display className="mt-6 text-3xl text-navy-700 sm:text-4xl lg:text-[3.25rem]">
                Our Core Solutions
              </Display>
              <p className="mt-5 max-w-xl leading-relaxed text-navy-600/80">
                Apex operates as a specialized digital lab partner specifically for general dentists
                within the United States. Unlike traditional labs that offer a vast, unmanageable
                catalog, Apex focuses on operational precision and a highly disciplined, focused-SKU
                model.
              </p>
              <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded-[1.75rem] shadow-pill">
                <Image
                  src="/images/milling-unit.jpg"
                  alt="A technician loading a milling unit in the laboratory."
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>

            <ul className="space-y-5 lg:pt-4">
              {SOLUTIONS.map((solution) => (
                <li key={solution.title}>
                  <FeaturePill {...solution} />
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* ── Four Perfected Core Solutions ────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-brand-600 py-16 text-white sm:py-24">
        <Image
          src="/images/appliances.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-25 mix-blend-luminosity"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-brand-600/85" />

        <Container className="relative">
          <div className="text-center">
            <Display className="mx-auto max-w-3xl text-3xl sm:text-4xl lg:text-[3.25rem]">
              {solutionsHeading(skus.length)}
            </Display>
            <p className="mx-auto mt-6 max-w-2xl leading-relaxed text-white/85">
              Instead of offering dozens of services, Apex refines and optimizes a limited number of
              high-demand restorations. This reduces error rates and improves consistency.
            </p>
          </div>

          {/*
           * Two up, as the design has it — but laid out with wrapping rather
           * than a grid so that a catalog with an odd number of case types
           * centres its last card instead of leaving a hole beside it.
           */}
          <ul className="mt-12 flex flex-wrap justify-center gap-5 sm:mt-16">
            {skus.map((sku) => (
              <li
                key={sku.name}
                className="flex w-full flex-col items-center justify-center rounded-[1.75rem] border border-white/25 bg-white/10 p-8 text-center backdrop-blur-sm sm:w-[calc(50%-0.625rem)] sm:p-10"
              >
                <h3 className="text-xl font-bold sm:text-2xl">{sku.name}</h3>
                {sku.description && (
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/85">
                    {sku.description}
                  </p>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-12 text-center">
            <Link href="/services" className={ctaClasses('pearl')}>
              Explore services
            </Link>
          </div>
        </Container>
      </section>

      {/* ── Start with a small trial ─────────────────────────────────────── */}
      <section className="py-16 sm:py-24">
        <Container className="text-center">
          <SectionRule className="mx-auto" />
          <Display className="mx-auto mt-8 max-w-4xl text-3xl text-navy-700 sm:text-4xl lg:text-[3.25rem]">
            {/* Broken by hand: left to wrap, the line splits "Long-Term" at the hyphen. */}
            <span className="block">Start with a Small Trial.</span>
            <span className="block">No Long-Term Commitment.</span>
          </Display>
          <p className="mx-auto mt-6 max-w-xl leading-relaxed text-navy-600/80">
            We encourage new partners to begin with a small number of cases to experience our
            workflow firsthand.
          </p>

          <ul className="mt-12 grid gap-5 sm:mt-14 md:grid-cols-3">
            {TRIAL.map((item) => (
              <li
                key={item.title}
                className="flex flex-col items-center rounded-[1.75rem] bg-brand-600 p-8 text-white shadow-pill"
              >
                <span className="grid h-14 w-14 place-items-center rounded-full bg-navy-700">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </svg>
                </span>
                <h3 className="mt-5 text-lg font-bold">{item.title}</h3>
                <p className="mt-1.5 text-sm text-white/85">{item.body}</p>
              </li>
            ))}
          </ul>

          <div className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/register" className={ctaClasses('navy')}>
              Submit your first case
            </Link>
            <Link href="/contact" className={ctaClasses('blue')}>
              Book a consultation
            </Link>
          </div>
        </Container>
      </section>

      <CtaBand
        title="Ready to send your first case?"
        body="Register your practice in a few minutes, or get in touch and we'll walk you through portal access."
      >
        <Link href="/register" className={ctaClasses('navy')}>
          Register your practice
        </Link>
        <Link href="/how-to-send-a-case" className={ctaClasses('blue')}>
          How it works
        </Link>
      </CtaBand>
    </>
  );
}
