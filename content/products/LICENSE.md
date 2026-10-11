# License of the product list

Contains data from [Open Food Facts](https://world.openfoodfacts.org), available
under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

The files in this folder (`p-00.json` to `p-99.json`, `names.json` and
`meta.json`) are a part of the Open Food Facts database, adapted for the
FutureVitals product scanner. This adapted database is made available under the
same Open Database License 1.0. The individual contents (product names,
ingredient lists, nutrition values) are under the
[Database Contents License (DbCL) 1.0](https://opendatacommons.org/licenses/dbcl/1-0/).
No product images are included.

## How it was made

`scripts/build-products.mjs` reads the Open Food Facts food export
(`https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz`)
of the date in `meta.json → exported`, and:

- keeps products sold in the United States, with a product name and an
  ingredient list, scanned at least once on Open Food Facts; US products first
  (a US or Canadian barcode, or the US as the country where the product is most
  scanned), then the most scanned, up to 80,000;
- keeps per product: name, first brand, ingredient text, NOVA group, additive
  codes, the category tags the scanner rules use, and energy, sugars, sodium and
  alcohol per 100 g;
- writes each barcode as 13 digits (UPC-A gets a leading 0), removes the
  underscores Open Food Facts uses to mark allergens, collapses spaces, and cuts
  ingredient lists longer than 1,200 characters;
- splits the products into 100 files by the last two digits of the barcode, and
  writes `names.json` (barcode, name, brand) for search;
- adds to each `names.json` row the app's ingredient grade (A to F), worked
  out by `scripts/grade-products.mjs` from the product's ingredients with the
  app's own rules (`content/ingredients.json`). The grade is the app's, not
  Open Food Facts'.

Anyone may rebuild it the same way from the public export. Corrections to a
product belong in Open Food Facts itself, where everyone benefits from them:
<https://world.openfoodfacts.org/contribute>.
