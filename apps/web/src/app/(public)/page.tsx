import Image from 'next/image';
import Link from 'next/link';
import { Container } from '@/components/ui/card';
import {
  Display,
  FeaturePill,
  Icon,
  IconTile,
  SectionRule,
  ctaClasses,
} from '@/components/marketing';
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
    title: 'Inconsistent Fit',
    body: 'Poor fit and remakes interrupt treatment flow and waste valuable chair time.',
    icon: (
      <>
        <path d="M12 4.5 21 19.5H3z" />
        <path d="M12 10v4M12 16.8h.01" />
      </>
    ),
  },
  {
    title: 'Slow Lab Communication',
    body: 'Delayed responses and complex channels create friction during cases.',
    icon: (
      <>
        <path d="M20.5 12a7.8 7.8 0 0 1-8.5 7.7L6.5 21l1.2-4.2A7.8 7.8 0 1 1 20.5 12Z" />
        <path d="M12 8.5v3.5M12 15.2h.01" />
      </>
    ),
  },
  {
    title: 'Unclear Pricing',
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
    title: 'Direct Communication',
    body: 'Immediate access to our team via WhatsApp. No phone trees, no delays.',
    icon: (
      <>
        <path d="M20.5 11.5a7.8 7.8 0 0 1-8.5 7.7L6.5 20.5l1.2-4.2A7.8 7.8 0 1 1 20.5 11.5Z" />
      </>
    ),
  },
  {
    title: 'Focused-SKU Model',
    body: 'We don’t do everything. We do four things flawlessly to reduce error rates.',
    icon: <path d="M13.5 3 5 13.5h5.5L10 21l8.5-10.5H13z" />,
  },
  {
    title: 'Clinically Proven',
    body: '100% medical-grade multi-layered zirconia and IPS e.max. No experimental gimmicks.',
    icon: (
      <>
        <circle cx="12" cy="9.5" r="5.5" />
        <path d="M8.5 14.2 7.5 21l4.5-2.3L16.5 21l-1-6.8" />
      </>
    ),
  },
  {
    title: 'Clear Pricing',
    body: 'Transparent rates and a clearly defined remake policy to protect your margins.',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M14.5 9.3a2.6 2.6 0 0 0-2.5-1.5c-1.5 0-2.4.8-2.4 1.9 0 2.7 5 1.5 5 4.3 0 1.2-1 2.1-2.6 2.1a2.7 2.7 0 0 1-2.6-1.6M12 6.2v11.6" />
      </>
    ),
  },
];

/** What a first trial with the lab includes. */
const TRIAL = [
  {
    title: 'First Remake Covered',
    body: 'Zero cost on your first remake',
    icon: (
      <>
        <path d="M4 11.5h16V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM3 7.5h18v4H3zM12 7.5V21" />
        <path d="M12 7.5S10.8 3 8.4 3a2.2 2.2 0 0 0 0 4.5zM12 7.5S13.2 3 15.6 3a2.2 2.2 0 0 1 0 4.5z" />
      </>
    ),
  },
  {
    title: 'Direct Support',
    body: 'Dedicated WhatsApp access',
    icon: (
      <path d="M20 15.5v2.4a1.6 1.6 0 0 1-1.8 1.6 15.6 15.6 0 0 1-6.8-2.4 15.4 15.4 0 0 1-4.7-4.7A15.6 15.6 0 0 1 4.3 5.6 1.6 1.6 0 0 1 5.9 3.9h2.4a1.6 1.6 0 0 1 1.6 1.4c.1.8.3 1.5.6 2.2a1.6 1.6 0 0 1-.4 1.7l-1 1a12.4 12.4 0 0 0 4.7 4.7l1-1a1.6 1.6 0 0 1 1.7-.4c.7.3 1.4.5 2.2.6a1.6 1.6 0 0 1 1.3 1.4Z" />
    ),
  },
  {
    title: 'Full Contour Zirconia',
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
  /*
   * The laboratory's own catalog, and nothing else. `loadPublicCaseTypes`
   * answers with an empty list when the API is unreachable, and that empty
   * list is rendered as an empty grid on purpose: a hard-coded stand-in would
   * keep advertising four restorations after the laboratory had changed them.
   */
  const skus = await loadPublicCaseTypes();

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {/*
       * The design gives the hero roughly 900px of height at desktop, which is
       * more than the copy needs — a minimum plus vertical centring holds that
       * proportion without padding that has to be re-tuned per breakpoint.
       */}
      <section
        id="main"
        aria-labelledby="hero-heading"
        className="relative isolate flex min-h-[36rem] items-center overflow-hidden bg-navy-800 lg:min-h-[56.5rem]"
      >
        <Image
          src="/images/hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover grayscale"
        />
        {/*
         * The design turns the photograph into a Super Blue duotone with no red
         * left in it at all — sampling the hero across the design gives a mean
         * of rgb(15, 47, 93). Multiplying Super Blue over the picture with its
         * colour already stripped is exactly that: every channel is scaled by
         * the brand ink, so red lands on zero and the light in the photograph
         * is the only thing that survives. The gradient on top is there to
         * darken the two edges the headline and the header sit against.
         */}
        <div aria-hidden="true" className="absolute inset-0 bg-blue-600 mix-blend-multiply" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-navy-900/45 via-transparent to-navy-900/45"
        />

        <Container className="relative w-full pb-16 pt-32 text-center sm:pb-20 sm:pt-36">
          <Display
            as="h1"
            id="hero-heading"
            className="mx-auto max-w-[64rem] text-4xl text-white sm:text-5xl lg:text-[4.5rem]"
          >
            {/* Broken where the design breaks it, rather than wherever the measure runs out. */}
            <span className="block">Stop Wasting Chair Time On</span>
            <span className="block">Unpredictable Lab Work.</span>
          </Display>
          {/* Wide enough to break in two, as the design sets it. */}
          <p className="mx-auto mt-6 max-w-[62rem] text-base leading-relaxed text-white/85 sm:text-lg">
            Apex is a digital lab partner for US general dentists — built around operational
            precision, not a wide catalog. Four high-demand restorations. Consistent fit.
            Predictable turnaround.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/register" className={ctaClasses('pearl')}>
              Submit Your Case
            </Link>
            <Link href="/contact" className={ctaClasses('onDark')}>
              Book a Consultation
            </Link>
          </div>
        </Container>
      </section>

      {/* ── Lab Reality ──────────────────────────────────────────────────── */}
      <section id="problems" aria-labelledby="problems-heading" className="scroll-mt-20 py-16 sm:py-24 lg:py-32 lg:scroll-mt-[6.25rem]">
        <Container>
          {/* Centred on the page, not on the heading — see `SectionRule`. */}
          <SectionRule className="mx-auto" />
          {/*
           * Not two equal columns. Against the 1280px measure the design runs
           * the pill list at 523 and the copy beside it at 629, with 128
           * between them — the ratios below, which hold as the measure narrows.
           */}
          <div className="mt-12 grid items-start gap-10 lg:mt-14 lg:grid-cols-[523fr_629fr] lg:gap-32">
            {/* Copy first on a phone; the design keeps it right of the list on desktop. */}
            <div className="lg:order-2">
              <Display id="problems-heading" className="text-3xl text-navy-700 sm:text-4xl lg:text-[4.5rem]">
                Lab Reality
              </Display>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-navy-600/80">
                Unpredictable lab performance creates operational stress inside busy dental
                practices. These are the issues most dentists face when working with traditional
                labs.
              </p>
              <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded-[1.75rem] shadow-pill">
                <Image
                  src="/images/chairside.jpg"
                  alt="A clinician checking a restoration chairside."
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>

            <ul className="space-y-[1.875rem] lg:order-1">
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
      <section id="about" aria-labelledby="about-heading" className="scroll-mt-20 py-16 sm:py-24 lg:py-32 lg:scroll-mt-[6.25rem]">
        <Container>
          <SectionRule className="mx-auto" />
          {/* Mirrored, and the copy is the wider column here: 655 / 103 / 523. */}
          <div className="mt-12 grid items-start gap-10 lg:mt-14 lg:grid-cols-[655fr_523fr] lg:gap-[6.4375rem]">
            <div>
              <Display id="about-heading" className="text-3xl text-navy-700 sm:text-4xl lg:text-[4.5rem]">
                Our Core Solutions
              </Display>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-navy-600/80">
                Apex operates as a specialized digital lab partner specifically for general dentists
                within the United States. Unlike traditional labs that offer a vast, unmanageable
                catalog, Apex focuses on operational precision and a highly disciplined, focused-SKU
                model.
              </p>
              <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded-[1.75rem] shadow-pill">
                <Image
                  src="/images/finishing.jpg"
                  alt="A technician finishing a zirconia bridge in the laboratory."
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>

            <ul className="space-y-[1.875rem]">
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
      <section
        id="services"
        aria-labelledby="services-heading"
        className="relative isolate scroll-mt-20 overflow-hidden bg-navy-700 py-16 text-white sm:py-24 lg:scroll-mt-[6.25rem] lg:py-32"
      >
        {/*
         * Oxford Navy rather than the Super Blue the mockup fills this band
         * with. It is the one place the site deviates from the design's colour,
         * on the client's instruction, and it is a deviation the palette
         * supports: navy is the brand's other ground, it is what the footer
         * below and the header above already sit on, and white on it clears AA
         * at 16.5:1 against Super Blue's 7.4:1.
         *
         * The band still carries the design's own photograph of stone models
         * rather than a flat fill — bled off the left edge, drained of colour
         * and left at a quarter strength so it reads as texture behind the
         * cards and never competes with them. The wash over it is lighter than
         * it was: navy swallows the texture that Super Blue only muted.
         */}
        <Image
          src="/images/models.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-25 mix-blend-luminosity"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-navy-700/75" />

        <Container className="relative">
          <div className="text-center">
            <SectionRule className="mx-auto bg-white" />
            <Display
              id="services-heading"
              className="mx-auto mt-10 max-w-[68rem] text-3xl sm:text-4xl lg:text-[4.5rem]"
            >
              {solutionsHeading(skus.length)}
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
          {/* The design sets this grid on a narrower measure than the sections above. */}
          <ul className="mx-auto mt-12 flex max-w-[66.5rem] flex-wrap justify-center gap-[1.875rem] sm:mt-16">
            {skus.map((sku) => (
              <li
                key={sku.name}
                className="flex min-h-[11rem] w-full flex-col items-center justify-center rounded-[1.75rem] border border-white/30 bg-white/[0.14] p-8 text-center backdrop-blur-sm sm:w-[calc(50%-0.9375rem)] sm:p-10"
              >
                <h3 className="text-xl font-bold sm:text-[1.75rem]">{sku.name}</h3>
                {sku.description && (
                  <p className="mt-2 max-w-sm text-[0.9375rem] leading-relaxed text-white/85 sm:text-[1.0625rem]">
                    {sku.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ── Start with a small trial ─────────────────────────────────────── */}
      <section id="contact" aria-labelledby="trial-heading" className="scroll-mt-20 py-16 sm:py-24 lg:py-32 lg:scroll-mt-[6.25rem]">
        <Container className="text-center">
          <SectionRule className="mx-auto" />
          <Display
            id="trial-heading"
            className="mx-auto mt-10 max-w-5xl text-3xl text-navy-700 sm:text-4xl lg:text-[4.5rem]"
          >
            {/* Broken by hand: left to wrap, the line splits "Long-Term" at the hyphen. */}
            <span className="block">Start with a Small Trial.</span>
            <span className="block">No Long-Term Commitment.</span>
          </Display>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-navy-600/80">
            We encourage new partners to begin with a small number of cases to experience our
            workflow firsthand.
          </p>

          <ul className="mx-auto mt-12 grid max-w-[75rem] gap-[1.875rem] sm:mt-14 md:grid-cols-3">
            {TRIAL.map((item) => (
              <li
                key={item.title}
                className="flex flex-col items-center rounded-[1.75rem] bg-blue-600 p-8 text-white shadow-pill sm:p-10"
              >
                <IconTile>
                  <Icon>{item.icon}</Icon>
                </IconTile>
                <h3 className="mt-6 text-xl font-bold sm:text-[1.75rem]">{item.title}</h3>
                <p className="mt-1.5 text-[0.9375rem] text-white/85 sm:text-[1.0625rem]">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">
            {/*
             * The design file reads "submit your fist case". Shipped corrected;
             * the typo is logged in TODO-CLIENT.md for the client to confirm.
             */}
            <Link href="/register" className={ctaClasses('navy')}>
              Submit Your First Case
            </Link>
            <Link href="/contact" className={ctaClasses('blue')}>
              Book a Consultation
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
