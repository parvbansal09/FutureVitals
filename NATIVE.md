# Shipping FutureVitals as a native app

The web build in `dist/` runs inside Capacitor's native web view on Android
and iOS. There is one codebase; `android/` and `ios/` are thin shells.

```
src/ + content/  ──npm run build──▶  dist/  ──cap sync──▶  android/  ios/
```

## Commands

```bash
npm run sync           # build, then copy dist/ into android/ and ios/
npm run open:android   # sync, then open Android Studio
npm run open:ios       # sync, then open Xcode (needs a Mac)
npm run icons          # redraw launcher icons and splash screens from the traced logo
```

Run `npm run sync` after every change to the app or its content.

> **Not yet compiled.** Both projects were generated with Capacitor 8 on a
> Windows machine with no Android SDK or Xcode, so neither has been built
> yet. The first build in Android Studio or Xcode is the check that the
> settings below compile.

## What is set up

| | Android (`android/app/src/main/`) | iOS (`ios/App/App/`) |
|---|---|---|
| Camera (scanner) | `CAMERA` permission, camera marked optional so phones without one can still install | `NSCameraUsageDescription` |
| Location (clinic finder) | `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | `NSLocationWhenInUseUsageDescription` |
| Backups | Off: `allowBackup="false"` plus `res/xml/data_extraction_rules.xml` keeps app data out of Google cloud backups and phone-to-phone transfer | iOS has no per-app switch; the privacy policy says an iCloud backup can include the data |
| Orientation | Not locked (WCAG 2.2 AA, 1.3.4) | Portrait and landscape |
| Languages | Follows the in-app choice | `CFBundleLocalizations`: en, es |
| Export compliance | n/a | `ITSAppUsesNonExemptEncryption = false` (HTTPS only) |
| Icon and splash | Adaptive icon on white, as in the logo, legacy square and round icons, light splash | App Store icon on white (no transparency), light launch image |

The iOS permission prompts are written in English and Spanish in one line,
because `Info.plist` holds one string per key. To show one language at a
time, move them into `InfoPlist.strings` files for `en` and `es` in Xcode.

## How the web code talks to the phone

`src/platform/native.ts` switches to Capacitor plugins only when running
natively, so the web version is unaffected:

| Need | On the web | In the app |
|---|---|---|
| Open a link | New browser tab | `@capacitor/browser` (in-app browser) |
| "Use my location" | `navigator.geolocation` | `@capacitor/geolocation`, which also drives the permission prompt |
| Share the plan | Web Share, else copy | `@capacitor/share` |
| Print the plan | `window.print()` | Hidden (web views cannot print) |
| Save answers | `localStorage` | `@capacitor/preferences` (not evicted under storage pressure) |
| Back button | Browser history | Android back button walks the app's own history |

Scan a barcode takes a photo with the phone's own camera app, which focuses
up close: the web view's photo picker (`<input type="file" capture>`), which
Capacitor's Android web view hands to the camera (asking for the camera
permission) and iOS shows as its camera. The photo is read on the phone: the
phone's built-in detector where there is one (Android), ZXing otherwise
(iOS), and then the printed numbers by OCR if the bars will not read. A
live camera view is used only on a computer, where there is no camera app
to hand off to. The OCR engine and 80,000 US products from Open Food Facts
ship inside the app (about 31 MB of the bundle), so a barcode, a product name
or an ingredient photo is read offline. Only a barcode missing from that list
is looked up online, and those requests name the app: `appendUserAgent`
(`FutureVitals/2.0`) in `capacitor.config.json`.

## Before you submit

1. **Bundle ID.** `capacitor.config.json` has `com.futurevitals.app`, a
   placeholder. Set a reverse-DNS ID you control before creating the store
   records; it cannot change afterwards.
2. **Privacy answers.** App Store "Data Not Collected" and the Play "Data
   safety" form: the app has no server and collects nothing. The one request
   it makes with user input is a barcode number to Open Food Facts, sent only
   when the person scans a product that is not in the built-in list. Say so in
   the review notes, and credit Open Food Facts (ODbL) as the app does in About.
3. **Privacy policy URL.** Host the in-app policy text (Privacy → Full
   privacy policy) at a public URL for both stores.
4. **Medical-app review.** Apple 1.4.1 and Google's health policies look hard
   at health information. The app says on every plan that it does not
   diagnose, and every number carries its source; keep that in the review
   notes. Do not submit until the clinical reviewer has signed off
   (`content/meta.json`).
5. **Signing.** Android: create an upload keystore and back it up; build an
   `.aab`. iOS: pick your team under Signing & Capabilities, then Product →
   Archive.
6. **Target API level.** Google Play raises its minimum every year. If a build
   is refused, raise `targetSdkVersion` in `android/variables.gradle`.

## Regenerating a platform

`android/` and `ios/` hold hand-made settings (the table above). Deleting and
re-adding a platform discards them. Prefer `npm run sync`, which only
refreshes the web bundle and plugin wiring, then `npm run icons`.
