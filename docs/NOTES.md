# Development notes

The longer story behind FutureVitals 2: how the pieces fit, what changed from
the first version, and the sign-offs still open. The [README](../README.md)
covers what the app is and how to run it.

FutureVitals 2 is a rebuild of an earlier FutureVitals app (v1), which is kept
separately and was not changed. The Connect to care page is set aside in
[parked/connect](../parked/connect/README.md) with steps to bring it back. The
app carries no Massey or VCU branding; Massey and VCU Health sites appear only
as directory listings, the same way any clinic is named.

On a desktop browser (a window 480 px or wider, with a mouse) the app is shown
inside a drawn phone: a 390 px screen with its frame, camera island, status
bar and home bar (`.phone` in `app.css`, `PhoneFrame.tsx`). It is only the
outside; the app inside is the same as on a phone. On phones and touch
tablets the frame is not drawn.

## How it is built

```
content/            ← all clinical wording, rules parameters, links, clinics
  strings/en.json   UI strings (es.json has identical keys; a test enforces it)
  check.json        the six-step questions and options
  screening.json    plan wording + the guideline and year behind each item
  risk.json         relative risks and the named review for each one (11 cancers)
  compare.json      How you compare: recommendation, source quote, first step
  prevention.json   9 prevention entries + 6 per-cancer pages
  learn.json        10 chapters + 10 myth/fact cards
  foods.json        food diary groups and serving sizes
  ingredients.json  product scanner rules (IARC / WCRF / WHO-PAHO thresholds)
  products/         80,000 US products from Open Food Facts (ODbL), built by
                    scripts/build-products.mjs and graded by
                    scripts/grade-products.mjs; see products/LICENSE.md
  clinics.json      68 Virginia sites
  events.json       mobile screening programs and dated events
  meta.json         versions, clinical reviewer, Spanish review, changelog
  va-zips.json      903 Virginia ZIP centers (U.S. Census, public domain)
src/engine/         the rules engine: pure functions, no text, fully tested
src/screens/        the screens
parked/connect/     the Connect to care page, set aside (not built)
src/components/     design system components
src/styles/         tokens.css (the single token file), base.css, app.css, print.css
src/platform/       native bridges, on-device storage, barcode, OCR, product lookup
tests/              unit tests
scripts/            content checks, link checks, e2e, screenshots, logo tracing, icons, ZIP table
resources/          logo.jpg (the brand logo every mark and icon is traced from)
```

Product data comes from Open Food Facts under the Open Database License. The
scanner carries 80,000 US products from its nightly export, so a barcode or a
product name is found on the phone, offline, sending nothing; only a barcode
the list does not have is looked up online. See
[OPEN-FOOD-FACTS.md](../OPEN-FOOD-FACTS.md) for the API and export links, the
license terms and how the app meets them.

Every product the scanner shows, and every ingredient and food in its search,
gets an **ingredient grade** from A to F. Each item linked to cancer adds
points once, by how strong the evidence is (IARC Group 1: 4, Group 2A: 3, a
WCRF "probable" cause: 2, Group 2B: 1, ultra-processed with sugar or salt over
the WHO limits: 1); 0 points is an A, 1 a B, 2-3 a C, 4-5 a D and 6 or more an
F. It counts items, not amounts, and the screen says so. Of the 80,000
built-in products, 72% are an A, 19% a B, 3% a C, 5% a D and 0.3% an F. The
grade sits beside the scanner's label (Worth limiting, Fine in moderation, No
cancer evidence), which still comes from rules alone.

The food diary keeps each day under its date and covers the last 7 days,
ending today: older days drop off and a future day cannot be logged, so an
old week never counts as this one. Its summary feeds How you compare and the
risk scores once 3 days are logged.

My plan says when the health check is not finished (answers can come from
the risk calculator alone), and Build my plan sends a person back to any
earlier step still unanswered, so a plan never goes without the symptoms step.

Two engines are kept apart on purpose. The **plan** is guideline matching:
answers read against published criteria (USPSTF, ACS, AASLD), nothing scored.
The **risk score calculator** (its own tab) multiplies published relative
risks (the Harvard Cancer Risk Index method) into a score for each cancer: a
multiple of average for someone the same age and sex, shown as a band in words
and a number such as 1.8×. Its Change answers view edits the person's own
answers, the same ones the check saves, so the scores, the plan and How you
compare always agree (a tester once said "never smoked" there and was still
shown as a smoker on the plan, when it edited a copy). Each card's biggest
change has a Try this change button: that one is a what-if, shown as
"Trying changes" until the person keeps it or goes back. Follow-up answers
that no longer apply (pack-years after "never smoked", family follow-ups
after "no family history") are cleared on every change, whichever screen
made it (`tidyAnswers` in `src/engine/answers.ts`).
Neither engine shows a probability, a lifetime percentage or a ranking of
cancers: the cards keep a fixed order.

## Reused from v1

- The Virginia cancer-care directory (treatment centers, hospitals, specialists;
  laboratories, office addresses and individual-doctor listings removed from a
  screening finder).
- The relative-risk model and its sources, rebuilt as data in `content/risk.json`.
- The guideline rules, re-derived for 5-year age bands.
- ZIP-to-state ranges (to tell "outside Virginia" from "not a ZIP code").
- Tinos font files and much of the careful clinical wording, rewritten to grade 6.

## New in v2

- Screens 11 (How you compare) and 17 (Product scanner). Screen 15 (Connect to
  care) was built, then parked on request.
- A built-in product list for the scanner: 80,000 US products from the Open
  Food Facts export, found by barcode or name on the phone. It also works in
  the claude.ai preview, which cannot reach the internet. It adds about 31 MB
  to the app; the web version loads one 300 KB file per look-up.
- Scan a barcode takes a photo of it. On a phone (and in the claude.ai
  preview) that is the phone's own camera, which focuses up close; live
  scanning missed too many real barcodes. On a computer the camera is shown
  in the app with a Take picture button, which keeps the sharpest of a few
  frames and reads the part in the box first; a sharp barcode also reads by
  itself, and Choose a photo opens a saved picture. The bars are decoded at
  several sizes and turns; if they will not read, the printed numbers under
  them are read and kept only when the check digit holds. In the preview the
  text reader's language data ships as base64 text.
- A risk score calculator, scoring the ten cancers v1 covered (stomach,
  pancreatic and brain included) plus bladder, with new figures from named
  meta-analyses (Panc4, Rota 2024, Yaghoobi 2010, Permuth-Wey 2009, Lee 2009,
  Turati 2012, WCRF liver report). Every answer the check asks is used by
  the cancers it bears on:
  - **Brain**: a close relative with a brain tumor (Hemminki 2009, 1.8),
    radiation treatment to the head before 21 (Neglia 2006, 6.8) and body
    weight (meningioma, Niedermaier 2015). Li-Fraumeni, NF1, NF2 and similar
    syndromes, or Lynch (Turcot), replace the score with "your gene result
    decides this". Cell phones, head injury and diet are not counted: the
    American Cancer Society finds no proof.
  - **Genes**: the check asks about BRCA, Lynch and syndromes linked to brain
    tumors separately. BRCA sets breast, prostate and pancreatic; Lynch sets
    colorectal, prostate, pancreatic, stomach and brain. (It was one answer,
    "BRCA or Lynch", which gave BRCA carriers Lynch colonoscopy advice and
    the reverse; an old answer is read as both.)
  - **Skin**: sun protection (Green 2011), a close relative with melanoma
    and a past skin cancer (Gandini 2005). A past cancer of another kind no
    longer counts as a past skin cancer.
  - **Cervical**: the HPV vaccine (Lei 2020); an abnormal Pap or HPV test
    replaces the score with "your follow-up tests decide this".
  - **Bladder**: a close relative with bladder cancer (Yu 2022).
  - **Lung**: chest radiation before 30 (Travis 2002).
- Helper mode for community health workers.
- ZIP codes resolved on the phone. v1 sent typed ZIPs to a web service.
- 26 Richmond-area screening sites added: Massey/VCU Health screening lines,
  federally funded health centers, free clinics, health departments and Massey
  Community Resource Centers.
- A design system in the brand colors (teal #285F5A for text, buttons and
  links; pink #EBC3D7 for soft surfaces; a pale teal ground, #E5F1EE, instead
  of white). Light by default, whatever the phone's setting, with a dark theme
  (a sun/moon button in the top bar; Settings can also follow the phone), and
  motion throughout that respects "reduce motion".
- The FutureVitals logo (resources/logo.jpg) traced into vectors
  (`scripts/trace-logo.mjs` writes `src/components/logo.json`), in its own
  teal #046B63 and pink #EAA7C0: the top bar, the launch animation, About, the
  tab icon, and the app icons and splash screens (`npm run icons`).
- `npm run artifact` builds a preview for a claude.ai Artifact into
  `dist-artifact/`: the same app, with camera, location, photo reading,
  barcode lookup and printing turned off (that viewer blocks them), and phone
  numbers copied instead of dialed.

## Before release

These are decisions and sign-offs, not code. The About screen shows their status.

1. **Clinical reviewer.** Name, credentials and date go in `content/meta.json`.
   They sign off the rules, the 44 personas, the relative risks (including the
   five cancers new in v2: liver, pancreatic, stomach, bladder, brain, and the
   October 2026 additions listed under New in v2), prevention
   entries, scanner rules, the ingredient grade's points and bands (an
   arbitrary scale added on request, October 2026) and every source quote (`quoteChecked` in
   `compare.json` and `ingredients.json`).
2. **Spanish review** by a native-speaking health communicator
   (`meta.json → spanish.status: "reviewed"`). Until then the Language screen
   says the Spanish is a draft.
3. **No Massey branding.** The co-brand and the Connect to care page were
   removed on request (the page is in `parked/connect`). Adding either back
   needs Massey's written approval, then a design pass. The printed plan now
   points to 2-1-1 (211 Virginia) instead of Massey's appointment line.
4. **Confirm the directory by phone.** Listings were checked against each
   site's public web pages on 28 September 2026. Tests shown for federally
   funded health centers rest on the federal requirement to offer cancer
   screening; confirm per site.
5. **Massey phone discrepancy** (parked page only). Massey's breast and lung
   screening pages print (800) **792**-6161; its appointment page and VCU Health
   print (800) **762**-6161. Settle it before the Connect page comes back.
6. **Radon kits are not free.** The spec's "free VDH test kit" is not accurate:
   VDH sells short-term kits for a shipping fee when it has them. The app says
   "low-cost".
7. **Store items** (see [NATIVE.md](../NATIVE.md)): bundle ID, hosted privacy
   policy URL, support URL, signing.
