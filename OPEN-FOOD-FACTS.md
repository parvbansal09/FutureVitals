# Open Food Facts in FutureVitals

The product scanner gets product names, ingredients, category tags and NOVA
groups from [Open Food Facts](https://world.openfoodfacts.org/), a free public
food database. This page lists the links from the
[Open Food Facts data page](https://world.openfoodfacts.org/data) and what the
license asks of the app. Sizes and links were checked on 2026-10-02.

## Licenses

| What | License |
|---|---|
| The database | [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| Each product record | [Database Contents License (DbCL) 1.0](https://opendatacommons.org/licenses/dbcl/1-0/) |
| Product photos | Creative Commons Attribution ShareAlike (CC-BY-SA). The app does not use photos. |
| Terms of use | <https://world.openfoodfacts.org/terms-of-use> |

What the ODbL asks:

- **Attribute.** Credit Open Food Facts wherever its data is shown, with links
  to Open Food Facts and the ODbL. Suggested wording: "Contains data from Open
  Food Facts, available under the Open Database License."
- **Share alike.** If the app ships a changed copy of the database (a filtered
  subset counts), offer that copy under the ODbL too, with its notices kept.
- **Keep open.** A copy shipped behind DRM must also be offered without it.
- **Contribute back.** If people can add or fix products, send those changes
  to Open Food Facts. The app does not let people edit products, so this does
  not apply yet.

## How the app uses it

| Part | File | Rule it follows |
|---|---|---|
| Live lookup, only for a barcode the built-in list does not have: one request per scan, barcode only, cached on the phone | `src/platform/off.ts` | "1 API call = 1 real scan by a user." Scraping through the API gets blocked. |
| Fields asked for | `OFF_FIELDS` in `src/engine/scanner.ts` | Ask only for the fields the scanner reads. |
| Credit on every product result, with links | `ResultView` in `src/screens/Scanner.tsx` (`scan.offCredit`) | Attribution on product pages |
| Credit on the About screen, with links | `src/screens/Settings.tsx` (`about.dataTitle`, `about.dataBody`) | Attribution in About or Settings |
| Link targets | `productData` in `content/meta.json` | `npm run check:links` checks both URLs |
| Built-in product list from the CSV export: 80,000 US products, looked up by barcode and searched by name on the phone, checked before any live lookup | `content/products/`, `scripts/build-products.mjs`, `src/platform/products.ts` | "Use bulk exports for offline or caching needs." Share alike: the subset ships with its own ODbL notice (`content/products/LICENSE.md`) and is credited on the scanner screen, in search results and on every result |

### Still open

- **User-Agent.** The API docs ask every call, reads included, to send a custom
  `User-Agent` in the form `AppName/Version (ContactEmail)`, for example
  `FutureVitals/2.0 (contact address)`. `fetch()` cannot set `User-Agent`, so
  the phone app adds `FutureVitals/2.0` to its web view's own User-Agent
  (`appendUserAgent` in `capacitor.config.json`). Still missing: a contact
  address (the only app address today is Massey's feedback email), and the web
  version and preview cannot name the app at all. Most look-ups now never reach
  the API, which keeps those requests rare. Before release, add a contact
  address, or ask Open Food Facts what they want from web view apps (`#api` on
  their Slack, or reuse@openfoodfacts.org).
- **Tell them about the app** (optional). Open Food Facts asks reusers to
  describe their app through the form on the data page.

## API

| What | Link |
|---|---|
| API documentation | <https://openfoodfacts.github.io/openfoodfacts-server/api/> |
| Read one product (JSON), the call the app makes | `https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields=…` |
| XML (unsupported, not documented) | `https://world.openfoodfacts.org/api/v2/product/{barcode}.xml` |
| Field list for the dumps and CSV | <https://world.openfoodfacts.org/data/data-fields.txt> |

SDKs exist for JavaScript, React Native, Dart, Kotlin, Swift and others, linked
from the data page. The app does not need one: it makes a single `fetch`.

## Bulk exports

Exports are rebuilt every night. Use them for offline lists, caching or
analysis, never the live API.

| Export | Link | Size (2026-10-02) |
|---|---|---|
| Food products, CSV (tab-separated, UTF-8, gzip) | <https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz> | 1.3 GB compressed, about 9 GB unpacked |
| All products, JSONL (one JSON object per line, gzip) | <https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz> | 13.1 GB |
| Simplified Parquet on Hugging Face | <https://huggingface.co/datasets/openfoodfacts/product-database/resolve/main/food.parquet?download=true> | 7.9 GB |
| MongoDB dump | <https://static.openfoodfacts.org/data/openfoodfacts-mongodbdump.gz> | 15.9 GB |
| MongoDB dump checksums | [sha256](https://static.openfoodfacts.org/data/gz-sha256sum), [md5](https://static.openfoodfacts.org/data/gz-md5sum) | |
| Daily changes, last 14 days | <https://static.openfoodfacts.org/data/delta/index.txt> (files at `https://static.openfoodfacts.org/data/delta/{filename}`) | Small. Does not record deleted products. |
| RDF (experimental, no longer maintained) | <https://world.openfoodfacts.org/data/en.openfoodfacts.org.products.rdf.gz> | |

Other databases from the same project, in the same CSV format:

- Cosmetics: <https://static.openbeautyfacts.org/data/en.openbeautyfacts.org.products.csv.gz>
- Pet food: <https://static.openpetfoodfacts.org/data/en.openpetfoodfacts.org.products.csv.gz>
- Other products: <https://static.openproductsfacts.org/data/en.openproductsfacts.org.products.csv.gz>

Open Food Facts suggests [DuckDB](https://duckdb.org/) for querying the JSONL
and Parquet files on a laptop.

## Contacts

- Data and reuse questions: reuse@openfoodfacts.org
- API questions: the `#api` channel on the Open Food Facts Slack
- Data page, with the reuse form, attribution guidelines and donation links:
  <https://world.openfoodfacts.org/data>
