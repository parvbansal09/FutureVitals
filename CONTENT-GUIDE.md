# Editing FutureVitals content

Everything people read in the app lives in the `content/` folder as plain
text files (JSON). You can change clinic hours, add an event or update a
Massey link without touching any code. After a change, run the checks, then
build.

```bash
npm run check          # unit tests + reading level, lengths, both languages
npm run check:links    # every link opens, every number dials
npm run build
```

## Rules for every edit

- **Both languages.** Every piece of text has an `"en"` and an `"es"` version.
  The checks fail if one is missing.
- **Grade 6 reading level.** Short sentences, everyday words. The checks tell
  you which sentence is too hard.
- **Unknown means null.** If you do not know something (hours, bus line,
  Spanish), write `null`. The app then says "Call to ask" and leaves the site
  out of that filter. Never guess.
- **Date what you checked.** Change `"verified"` to today's date (YYYY-MM-DD)
  whenever you confirm a listing. Listings older than 180 days show a notice.

## Common jobs

### Change a clinic's hours or phone

Open `content/clinics.json`, find the site by its `"name"`, and edit:

```json
"phone": "(804) 783-2505",
"hours": { "en": "Mon–Fri, 8 a.m.–4:30 p.m.", "es": "Lun–Vie, 8 a. m.–4:30 p. m." },
"evening": false,
"weekend": false,
"verified": "2026-10-15"
```

Set `"evening"` or `"weekend"` to `true` only if the site has those hours;
that is what the "Evenings or weekends" filter reads.

### Add a screening site

Copy an existing site block in `clinics.json`, give it a new `"id"` (lowercase,
dashes), and fill in every field. Coordinates (`lat`, `lng`) sort the list by
distance; you can look an address up at geocoding.geo.census.gov. List a test
in `"tests"` only if the site offers it: `mammogram`, `colonoscopy`, `fit`,
`ldct`, `pap`, `skin`.

### Add a mobile screening event

In `content/events.json`, add to `"events"`:

```json
{
  "id": "example-2026-11-08",
  "date": "2026-11-08",
  "time": { "en": "9 a.m.–1 p.m.", "es": "9 a. m.–1 p. m." },
  "title": { "en": "Mammogram day", "es": "Día de mamografías" },
  "place": "Example Community Center",
  "address": "123 Example St, Richmond",
  "register": { "type": "tel", "value": "(804) 628-0896" },
  "tests": ["mammogram"]
}
```

Only add an event once the host has confirmed the date and place. Past events
hide themselves.

### Change a risk figure

Edit `content/risk.json`. Each cancer lists its factors; each factor has a
relative risk and the id of its source in `"sources"`, which every card links
to. A new source needs a name and a public URL. Run `npm test` afterwards:
the risk tests check that "Try this change" still lands on the figure the card
promises.

### The Connect to care links

The page is parked (see `parked/connect/README.md`). Its links and numbers
are in `parked/connect/massey.json`, ready for when it comes back.

### Record the clinical review

In `content/meta.json`:

```json
"clinicalReviewer": { "name": "…", "credentials": "MD, MPH", "reviewedOn": "2026-11-01" }
```

Set `"quoteChecked": true` on each quote in `compare.json` and
`ingredients.json` once it matches the live source page.

### Teach the scanner a new word

Scanner rules live in `content/ingredients.json`. Each rule has:

- `"words"`: words to look for in the ingredient list, in English and Spanish.
  They match whole words only, so `"gin"` never matches "ginger".
- `"exclude"`: phrases removed before matching. Add one when a word gives a
  false alarm: `"goat cheese"` under red meat, `"coffee beans"` under beans.
- `"lead": true`: the words only count among the first three ingredients.
  Protective foods and alcohol use this, so milk powder deep in a sweet
  spread is not "dairy" and wine cooked into a sauce is not "alcohol".
- `"tags"`: Open Food Facts category tags that match without any words.

Products tagged with a category in `"meatFreeTags"` (meat substitutes) are
never matched as meat. After an edit, add the product that prompted it to
`tests/scanner-geo.test.ts` so the fix stays fixed, and run `npm run grades`
(see below).

### Change the ingredient grade

Every product, ingredient and food the scanner shows gets a grade from A to F,
set in `content/ingredients.json → grade`:

- `"points"`: what each item linked to cancer adds, by the strength of the
  evidence. IARC Group 1: 4, Group 2A: 3, a WCRF "probable" cause: 2, Group
  2B: 1, ultra-processed with sugar or salt over the WHO limits: 1. Limited
  evidence (fried food, in the food list) adds 1. Each item counts once.
- `"bands"`: the lowest point total for each grade: A 0, B 1, C 2, D 4, F 6.

Foods in `content/foods.json` take their grade from `"evidence"`. Foods to
choose have none, so they are an A. The label (Worth limiting and so on) does
not use the grade, and the grade does not use the label.

The grades of the 80,000 built-in products are worked out ahead and stored in
`content/products/names.json`, so the search list can show them. After any
change to `ingredients.json`, run:

```
npm run grades
```

It takes about a minute and a half. `npm test` fails until you do.

### Refresh the scanner's product list

The list in `content/products/` comes from the Open Food Facts export. To
bring it up to date (a few times a year is plenty):

```
curl -L -o off.csv.gz https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz
node scripts/build-products.mjs off.csv.gz --exported=YYYY-MM-DD
npm test
```

The build grades every product at the end (`npm run grades`).

The download is about 1.3 GB and the build takes two to three minutes. Use the
date the export was made (the `Last-Modified` date of the download). Also
rebuild after adding a category tag to a scanner rule: the list keeps only the
tags the rules use. Keep `content/products/LICENSE.md` with the files.

### Mark the Spanish as reviewed

In `content/meta.json`: `"spanish": { "status": "reviewed", "reviewer": "…", "reviewedOn": "…" }`.
The Language screen then says everything was translated by a person.

## What not to edit here

The screening rules themselves (which age gets which test) are in
`src/engine/plan.ts` and are checked by 40 personas in
`tests/personas.test.ts`. Change them with the clinical reviewer and a
developer, and update the personas first.
