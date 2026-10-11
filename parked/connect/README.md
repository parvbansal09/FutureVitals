# Connect to care (parked)

The Connect page (spec screen 15, "Massey Connect") was taken out of the app on
2026-10-01 at the owner's request: every block on it pointed to VCU Massey
services, and the app is not branded with Massey for now. Nothing here is built,
type-checked or tested. Its tab is now the Risk score calculator.

| File | Goes back to |
|---|---|
| `Connect.tsx` | `src/screens/Connect.tsx` |
| `connect.ts` | `src/engine/connect.ts` (block order: a symptom puts appointments first) |
| `massey.json` | `content/massey.json` (every link and number, checked by `npm run check:links`) |
| `content-types.ts.txt` | the `ConnectBlock` type and `massey` export in `src/engine/content.ts` |
| `strings.json` | `nav.connect` and the `connect` section of both strings files |
| `connect.css` | `src/styles/app.css` |
| `connect.test.ts.txt` | `tests/scanner-geo.test.ts` |

To bring it back:

1. Copy the files above into place.
2. Add the route in `src/App.tsx` (`case 'connect'`), the tab in
   `src/components/TabBar.tsx`, `'connect'` in `TabKey`, `tabOf` and
   `isRootPath` in `src/app/router.ts`.
3. Add `'massey.json'` back to the list in `scripts/check-content.mjs`, and
   `/connect` to `scripts/a11y-targets.mjs` and `scripts/screenshots.mjs`.
4. Get written approval for the wording and branding first (spec, screen 15).
5. Run `npm run verify`.
