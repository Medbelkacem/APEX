# Outstanding client input

Everything the Apex build needs that is not in `Brand guidlines.pdf`,
`Apex landing page.pdf`, `docs/brand/logo-source.jpg` or `APEX-Prolync-DRS.docx`.
All four were read; the DRS was read as functional scope and not modified.

Nothing on this list has been guessed, approximated with a lookalike, or filled
with a placeholder. Where a value is missing the site omits the element
entirely — an unset WhatsApp number renders no button, an unset social URL
renders no icon, an unreachable catalog renders an empty grid. That is
deliberate: a call button that dials nobody is worse than no button at all.

The three contact details printed in the brand guidelines — `+1 (800) 555–7895`,
`hello@APEX.com`, `www.APEX.com` — are mockup fillers and have not been used
anywhere.

---

## 1. Values to supply (environment)

All of these are already wired up and documented in `.env.example`. Filling one
in is the only step needed to make its element appear.

| Variable | Drives | Status |
| --- | --- | --- |
| `LAB_WHATSAPP` | The floating green contact button on every public page | **Missing** — button not rendered |
| `LAB_PHONE` | Footer phone circle; fallback for the floating button | **Missing** — circle not rendered |
| `LAB_INSTAGRAM_URL` | Footer Instagram circle | **Missing** — circle not rendered |
| `LAB_FACEBOOK_URL` | Footer Facebook circle | **Missing** — circle not rendered |
| `LAB_EMAIL` | Contact page | **Missing** — omitted from the page |
| `LAB_ADDRESS` | Contact page | **Missing** — omitted; no map is drawn either |
| `LAB_HOURS` | Contact page | **Missing** — omitted from the page |
| `MAIL_FROM_ADDRESS` | Sender on every transactional email | Defaults to `no-reply@apex.example`. `.example` is IANA-reserved, so it can never reach a live mailbox — **needs the real sending domain before launch** |
| `NEXT_PUBLIC_SITE_URL` / `WEB_URL` | Canonical URLs, sitemap, robots, email logo | Localhost default — **needs the production domain** |

The design draws exactly three footer circles (Instagram, phone, Facebook). If
the laboratory uses different channels, say which and the set will be changed.

### Naming note

The brief named these `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_INSTAGRAM_URL`
and so on. They are implemented as server-side `LAB_*` variables instead: every
component that reads them is a server component, so the values never reach the
client bundle and are not baked into the build output. Say the word if the
`NEXT_PUBLIC_` names are wanted and they will be renamed.

---

## 2. Assets to supply

### Muslone (display face) — **partial**

Muslone is not a Google font and no font file shipped with the brief. The copy
embedded in `Brand guidlines.pdf` was recovered and self-hosted at
`apps/web/src/fonts/muslone.woff2`, but that copy is a **subset**: it carries
every letter and digit and **no punctuation at all**. The full stop and hyphen
the landing-page headlines need were measured off the design's own rendering and
drawn back into the face, so "No Long-Term Commitment." sets in one face.

The comma and apostrophe are still missing and fall through to Georgia. No
headline currently on the site uses either, so nothing is visibly wrong today —
but any new headline containing one will show the seam.

**Needed:** the licensed Muslone font files (woff2/otf, full character set).
Dropping them over `apps/web/src/fonts/muslone.woff2` retires the subset and the
Georgia fallback with no other change.

No lookalike was substituted. Playfair, Prata and Bodoni were all rejected.

### Photography — **provisional**

The four photographs are extracted from `Apex landing page.pdf` itself, at the
resolution the design embedded them:

| File | Used for | Size |
| --- | --- | --- |
| `apps/web/public/images/hero.jpg` | Hero background (Super Blue duotone) | 1880 × 1253 |
| `apps/web/public/images/chairside.jpg` | Lab Reality section | 867 × 1300 |
| `apps/web/public/images/finishing.jpg` | Our Core Solutions section | 1880 × 1253 |
| `apps/web/public/images/models.jpg` | Four Perfected Core Solutions watermark | 867 × 1300 |

**Needed:** (a) confirmation that Apex holds a licence for these images, and
(b) the full-resolution originals. 1880px is comfortable for the hero on a
standard display but thin on a 2× screen at full-bleed width.

No stock photography was pulled from the internet.

### Logo — **traced**

`docs/brand/logo-source.jpg` is a raster. The vector currently shipping —
`apps/web/public/brand/apex-mark.svg` and `apex-wordmark.svg` — is a trace of
it, and every app icon (`icon-192`, `icon-512`, `icon-maskable-512`,
`apple-icon`, `src/app/icon.png`, `logo-white.png`) is generated from that
trace.

**Needed:** the official vector artwork (AI/EPS/SVG). The trace is close but it
is not the master.

---

## 3. Copy decisions taken — please confirm

Five places where the design file is internally inconsistent or contains an
error. Each was resolved in favour of what the design **renders**, since that is
what was approved; all five are one-line changes if you disagree.

1. **"Chair Time On"** — the hero renders a capital *O*, because Figma applies a
   title-case transform. The PDF's underlying text layer reads lower-case "on".
   **Shipped as rendered: "Stop Wasting Chair Time On Unpredictable Lab Work."**
   Note that naive title case capitalising a preposition is a Figma artefact
   rather than a house style; the grammatical form would be "on".

2. **"submit your fist case"** — a typo in the mockup's second CTA.
   **Shipped corrected as "Submit Your First Case."**

3. **SKU hyphenation** — the design renders *Screw-Retained Zirconia*,
   *Zirconia Full-Arch Implant* and *Focused-SKU Model*; the brief's tables
   spell all three open. **Shipped hyphenated, matching the design.** The slugs
   (`screw-retained-zirconia`, `zirconia-full-arch-implant`) are unaffected.

4. **Copyright year** — the design prints "© 2026". The footer renders the
   current year instead, so the line does not go stale in January. It reads
   "© 2026 Apex Digital Lab. All rights reserved." today, exactly as designed.

5. **Section watermark** — the brief describes the Four Perfected Core Solutions
   band as carrying a large low-opacity *logomark*. The design actually washes
   that band with its own photograph of stone models, bled off the left edge.
   **Shipped as the design renders it** (`models.jpg`, drained of colour at 25%).

6. **Four Perfected Core Solutions band is Oxford Navy, not Super Blue.** The
   only place the site deviates from the design's colour, and it is a
   deliberate client instruction rather than an oversight. The palette
   supports it — navy is the brand's other ground, the header above and the
   footer below already sit on it, and white on navy clears AA at 16.5:1
   against Super Blue's 7.4:1. Say the word and it goes back to blue in one
   line. The feature cards in Lab Reality, Our Core Solutions and the Trial
   section are all still Super Blue.

---

## 4. Navigation — the design and the DRS disagree, and both are satisfied

The approved design draws one header: five anchors into the landing page's own
sections — **Main · problems · About · Services · contact**. That header is
correct on the landing page and cannot work anywhere else, because `/contact`
has no `#problems` section to jump to.

The DRS requires five *navigable pages* and says so three times: the Marketing
Website section ("Global elements — Header navigation…"), the non-functional
requirement that navigation be "consistent across each surface", and the
deliverables checklist, which lists Home, About, Services, Contact and How to
Send a Case each as a separate line item.

Shipping the design's anchors everywhere would have satisfied the mockup by
making three of those five pages unreachable. So:

- **on `/`** — the design's five anchors, verbatim, casing included;
- **on every other public page** — Home · About · Services · How to send a
  case · Contact.

Each page carries the navigation that can actually work on it. Header and
footer share one source (`src/components/site-nav.tsx`) so the two never drift.

The design's header also carries **no auth buttons**. `/login` is a quiet text
link at the right of the bar and an entry in the mobile menu; the "Submit a
case" button that used to sit there has been removed.

### Two DRS requirements still blocked on you

- **Footer legal links.** The DRS asks for "footer with brand and legal links".
  Privacy and Terms do not exist as pages, so the footer links to neither — a
  link to a 404 is worse than an omission. Both need writing.
- **About page content.** The DRS specifies "Laboratory background, team,
  certifications, equipment". Every one of those is a factual claim about a
  real business that cannot be written by the development team, so the page
  carries the mission and vision verbatim from the brand guidelines and nothing
  else. Supply the four and the page fills out.

## 5. Measurements approximated from the PDF

Figma (`node-id=59-246`) could not be opened, so these were measured off the
design's own rendering or picked from the Tailwind scale. All are plausible and
none is verified — please check each against Figma.

| Value | Where | Shipped as |
| --- | --- | --- |
| Card corner radius | Every feature/solution/trial card | `1.75rem` (28px) |
| Card-to-card gap | All card stacks and grids | `1.875rem` (30px) |
| Section rule | Above every section heading | 204 × 6px, centred on the page |
| Hero height | Desktop | `min-height: 56.5rem` (904px) |
| Page measure | All sections | 84rem cap with 2rem gutters → 1280px content |
| Footer measure | Footer only | 66.5rem (1064px) |
| Two-column ratios | Lab Reality / Core Solutions | 523∶629 and 655∶523, 128px and 103px gutters |
| Headline leading | All display headings | 1.331em (Muslone's own ascent + descent) |
| Anchor scroll offset | New — not in the design | Header height (5rem / 6.25rem), so a jumped-to section clears the fixed bar |

The responsive breakpoints (360 / 768 / 1024 / 1440) and the ≥ 44 × 44 px tap
target floor are not approximations — both come from the DRS's Responsiveness
section, and both are met. The floating contact button is 56 × 56.

---

## 6. Verified, for the record — no action needed

Contrast was checked against WCAG AA (4.5:1 for body text). Every combination
the design uses passes, so no brand colour was altered:

| Foreground on background | Ratio | AA |
| --- | --- | --- |
| White on Super Blue `#0049cc` | 7.4:1 | pass (AAA) |
| White on Oxford Navy `#001e47` | 16.5:1 | pass (AAA) |
| White 85% on Super Blue | 5.8:1 | pass |
| Navy 600 80% on white | 8.0:1 | pass |
| Navy 400 `#2b4f80` on white (PDF/email secondary text) | 8.3:1 | pass |

---

## 7. Optional follow-ups

- **npm scopes.** The workspace packages are still `@dental/web`, `@dental/api`,
  `@dental/shared-types`, `@dental/ui-kit`, `@dental/eslint-config`. Renaming
  them to `@apex/*` is a mechanical refactor with a large blast radius and no
  user-visible effect, so it was deliberately left alone. Their `description`
  fields all say Apex.
- **Privacy and terms.** No such pages exist, so the footer no longer links to
  them. They need writing before launch.
- **Portal neutrals.** The dentist and admin surfaces use neutral slate greys
  for body text and red/amber/green for status badges. Those are functional
  signals rather than brand colours; say if you want them pulled onto navy
  tints instead.
- **Source-file locations.** The brief's §2 places the two PDFs at
  `docs/brand/Brand_guidlines.pdf` and `docs/brand/Apex_landing_page.pdf`; they
  are actually at the repository root as `Brand guidlines.pdf` and
  `Apex landing page.pdf`, and code comments cite them under those names. Happy
  to move them into `docs/brand/` if you want the layout the brief describes.
- **Stationery.** The guidelines' stationery mockup carries a name and title
  ("Aksa Yousri, CEO"). It has not been used anywhere — confirm before it
  appears on the site.
