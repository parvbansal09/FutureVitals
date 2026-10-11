# FutureVitals 2

A cancer-screening navigation app for Virginia communities. It turns a
six-step health check into a plan of what to raise with a clinician, has a
risk score calculator with every figure sourced, shows how habits compare with
the evidence, and finds screening sites across Virginia.

The app carries no Massey or VCU branding: no logo, colors, partnership line
or Massey services page. Massey and VCU Health sites appear only as directory
listings, the same way any clinic is named. The Connect to care page (spec
screen 15) is set aside in [parked/connect](parked/connect/README.md) with
steps to bring it back.

Everything runs on the phone. There is no account and no server. English and
Spanish throughout. Set entirely in Times New Roman (Tinos, its metric twin,
on Android where Times New Roman is not installed).

This is a new build that replaces `../FutureVitals` (v1). v1 is untouched.

## Run it

```bash
npm install          # also copies the on-device OCR engine into public/ocr
npm run dev          # http://localhost:5173
```

On Windows, if PowerShell refuses to run `npm` ("running scripts is disabled"),
use `node scripts/dev.mjs --open` instead: it starts the same server with node,
opens the browser, and reuses a server that is already running. In VS Code,
Run > Start Debugging (F5) does the same and opens the browser at
http://localhost:5173.
Opening `index.html` straight from the folder does not work: the app needs
the dev server (or `npm run preview` for the built version).

On a desktop browser (a window 480 px or wider, with a mouse) the app is shown
inside a drawn phone: a 390 px screen with its frame, camera island, status
bar and home bar (`.phone` in `app.css`, `PhoneFrame.tsx`). It keeps a real phone's shape and
is scaled down as a whole to fit a smaller window. It is only the
outside; the app inside is the same as on a phone. On phones and touch
tablets the frame is not drawn.

## Put it on the web (Netlify)

The repo is ready for Netlify: `netlify.toml` holds the build command
(`npm run build`), the folder to publish (`dist`), the Node version and the
caching rules. In Netlify, choose Add new site > Import an existing project >
GitHub, pick this repository, and deploy; nothing needs to be typed in. Every
push to `main` then publishes a new version. The web version is the full app:
camera scanning, location, printing and online look-ups all work, unlike the
claude.ai preview.

Production build and a local preview:

```bash
npm run build        # type-check + build into dist/
npm run preview      # http://localhost:4173
```

## Check it

| Command | What it proves |
|---|---|
| `npm test` | 148 unit tests: every screen agreeing with the answers (4,000 random people through the plan, How you compare, the risk scores and the prevention library: a non-smoker never shown as a smoker, screening matching the sex given, family history only when named, a gene change setting only the cancers that gene affects, a flagged symptom replacing the score of the cancer it points to, and so on), every answer in the check changing a result (each past illness, gene change, family cancer and habit, for each sex it applies to), 44 guideline personas, the risk score model and calculator, the food diary (the last 7 days by date, old days dropping off, entries from the old weekday format moved to their dates) and the diary-to-compare switch, "1 place" rather than "1 places", scanner labels (including cases found with real Open Food Facts records), the ingredient grade (bands, counting, real products, and that the grades stored for the 80,000 built-in products match the rules), the built-in product list (every barcode form, real products labeled, search), reading a barcode number off a photo (check digits, misread letters), telling a real ingredient reading from noise (a real noisy reading is a test case), on-device ZIP lookup, bilingual parity, and every string key the screens ask for |
| `npm run check:content` | Every string at reading grade 6 or below (English and Spanish), copy-length limits, zero untranslated keys, freshness of clinic listings and prevention entries |
| `npm run check:links` | Every URL answers and every phone number is dialable |
| `npm run e2e` | Clicks through a fresh install in a real browser; times the plan from tap to painted frame (spec: under 200 ms; about 90 ms on the build machine); changes an answer in the risk calculator and checks the score moves, the answer is saved, and the plan and How you compare say the same (the "never smoked" report); tries a change, goes back, and keeps one; looks up a typed barcode and checks its ingredient grade (and a grade on each search result), reads a barcode photo taken through Scan a barcode (the bars, and the printed numbers alone), checks a computer's in-app camera (a barcode read by itself, Take picture reading the printed numbers, Choose a photo) through Chrome's stand-in camera, reads an ingredient photo, says so when a photo reads as noise, and finds a barcode inside an ingredient photo, and searches a product name in the built-in list; logs a serving under today's date in the food diary; checks a plan from the calculator alone says the check is not finished, and that Build my plan with step 1 skipped goes back to step 1; network audit that fails if anything leaves the device |
| `npm run a11y` | Every control at least 44 x 44 px on every screen at 100% and 200% text, and axe-core WCAG 2.2 A/AA checks in light and dark (25 screens, a product result with its grade and a search list among them) |
| `npm run shots` | Screenshots of every screen (`--dark`, `--es` for dark mode and Spanish) |

`e2e`, `shots` and `icons` drive the Microsoft Edge or Chrome already on the
machine through `playwright-core`; nothing extra is downloaded.

## Ship it as an app

The same build is wrapped with Capacitor, like v1. `android/` and `ios/` are
generated and configured: camera and location permissions, backups off on
Android, no orientation lock, the app's own icons and light and dark splash
screens. Neither has been compiled yet (no Android SDK or Xcode on the build
machine). See [NATIVE.md](NATIVE.md).

```bash
npm run sync           # build, then copy into android/ and ios/
npm run open:android   # Android Studio
npm run open:ios       # Xcode (needs a Mac)
```

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
scripts/            content checks, link checks, e2e, screenshots, icons, ZIP table
```

Product data comes from Open Food Facts under the Open Database License. The
scanner carries 80,000 US products from its nightly export, so a barcode or a
product name is found on the phone, offline, sending nothing; only a barcode
the list does not have is looked up online. See
[OPEN-FOOD-FACTS.md](OPEN-FOOD-FACTS.md) for the API and export links, the
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
- A design system in the logo's colors (teal #285F5A for text, buttons and
  links; pink #EBC3D7 for the mark and soft surfaces; a pale teal ground,
  #E5F1EE, instead of white), light and dark themes (a sun/moon button in the top bar; Settings can follow the phone),
  and motion throughout that respects "reduce motion".
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
7. **Feedback address.** `meta.json → feedbackEmail` is engagemassey@vcu.edu;
   confirm Massey wants app feedback there.
8. **Store items** (see [NATIVE.md](NATIVE.md)): bundle ID, hosted privacy
   policy URL, support URL, signing.
