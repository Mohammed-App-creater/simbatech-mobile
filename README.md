# Simbatech mobile app

The Simbatech store as an Android / iOS app: buy products or rent them by the day (Ethiopian market: prices in ETB, Telebirr / CBE Birr / card payments). It shows the same UI as the website's phone layout and uses the same API and accounts.

- **This project:** Expo SDK 57 (React Native 0.86, Expo Router, TypeScript).
- **Website:** `../simbatech-web` (Next.js) — https://simbatech-e-commerce.vercel.app
- **Backend:** `../simbatech-api` (Django REST API). The app calls `<site>/api/*`, which the site proxies to the API, so nothing needs to change on the server for the app to work.

## Getting started

```bash
npm install
npx expo start
```

Then press `a` to open it on an Android emulator, or scan the QR code with the **Expo Go** app on a phone (same Wi-Fi).

Out of the box the app talks to the live site. **Demo customer:** `demo@simbatech.et` / `simbatech123`. Promo code `SIMBA10`.

### Using a local API

Start the API (see the `simbatech-api` README), then create `.env.local`:

```bash
# Android emulator reaches your computer at 10.0.2.2; a real phone needs your computer's LAN address
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
```

and restart `npx expo start`. Add `10.0.2.2` (or the LAN address) to the API's `ALLOWED_HOSTS`.

### Preview in a browser

The app also runs in a browser (react-native-web), which is handy for quick checks:

```bash
npx expo start                      # terminal 1
node scripts/web-preview.mjs        # terminal 2 → http://localhost:8100
# local API instead of the live site:
API=http://localhost:8000 node scripts/web-preview.mjs
```

The small proxy puts the app and the API behind one origin so the session cookie works in the browser.

## How it fits together

```
src/app/                 routes (Expo Router); same paths as the website: /shop, /product/<slug>, /cart, /checkout, …
src/screens/*.tsx        one screen per page, ported from simbatech-web/src/screens
src/components/          shared UI: text + icons + buttons + fields (ui.tsx), page frame (Screen), site header / footer,
                         bottom tab bar, "All categories" menu, "Deliver to" sheet, product card, product artwork
src/lib/store.ts         session store (user, cart, wishlist, store details) and every action (cart, auth, checkout, …)
src/lib/api.ts           fetch wrapper for the API (session cookie + CSRF token)
src/lib/catalog.ts       read-only data loaders (catalog cached for a minute)
src/lib/pricing.ts       pricing rules mirrored from the API, for live totals in the UI
src/theme.ts             the website's colours and fonts
```

- **Accounts:** the same accounts as the website — phone or email + password, or a phone number with an SMS code. The API keeps the session in a cookie, which the phone stores like a browser does, so customers stay signed in.
- **Cart:** guests get a cart tied to their session; it merges into the account when they sign in.
- **Payments:** the API decides. With a Chapa key configured it answers checkout with a payment-page URL; the app opens that page inside the app (`/pay`) and returns to the order when the payment finishes. Without a key, online payments are recorded as paid immediately.
- **Store details** (city, phone, address, hours, policies) come from the API's Store settings, so the shop owner edits them in the admin.

### What differs from the website

- The "Download the app" banner and store badges are left out.
- **Sign in with Google is not offered in the app yet.** The website's Google flow finishes in the browser's cookie jar, which the app can't read. To add it, the API needs a small app hand-off: let `/api/auth/google/start` accept an app flag, have the callback redirect to `simbatech://…` with a short-lived signed token, and add an endpoint that exchanges that token for the app's session.
- Password-reset links sent by email open the website. Reset by SMS code works inside the app.
- The staff admin area is web-only.

## Building for the stores

The project is set up for [EAS Build](https://docs.expo.dev/build/introduction/) (`eas.json`):

```bash
npx eas-cli@latest login
npx eas-cli@latest init                                   # links the project to your Expo account (once)
npx eas-cli@latest build -p android --profile preview     # an .apk to install and share for testing
npx eas-cli@latest build -p android --profile production  # Play Store bundle
npx eas-cli@latest build -p ios --profile production      # App Store build (needs an Apple developer account)
```

Before the first store release, check in `app.json`: the app name, `android.package` / `ios.bundleIdentifier` (`et.simbatech.app`), and the icons in `assets/images/` (generated from the website's logo file — replace them with full-resolution artwork if you have it).

## Checks

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```
