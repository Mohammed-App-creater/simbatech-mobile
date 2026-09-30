# Simbatech mobile (Expo / React Native)

The Simbatech app for Android and iOS: buy or rent by the day, Ethiopian market (ETB, Telebirr / CBE Birr / cards).
It shows **the same UI as the website's phone layout** and talks to the same API.
Expo SDK 57, Expo Router, React Native 0.86, TypeScript. See also `AGENTS.md` (Expo's own rules: use
`npx expo install`, read the versioned docs, never edit `android/` / `ios/` by hand).

- Website (the design reference): `../simbatech-web` (Next.js) — live at https://simbatech-e-commerce.vercel.app
- API: `../simbatech-api` (Django). The app calls `<site>/api/*`, which the site proxies to the API.

## How the code is organised

- `src/app/` — routes only (Expo Router). Paths mirror the website: `/`, `/shop`, `/product/[slug]`, `/cart`,
  `/checkout`, `/pay`, `/order-confirmed/[id]`, `/account`, `/signin`, `/reset-password`, `/track`, `/p/[slug]`.
  Each route file just re-exports its screen. `_layout.tsx` loads fonts, boots the session, hosts the stack,
  the bottom tab bar and the categories menu.
- `src/screens/*.tsx` — the UI, one function component per page, ported from `simbatech-web/src/screens/*.jsx`.
- `src/components/` — shared pieces:
  - `ui.tsx`: `T` (Geist text), `H` (Bricolage heading), `Serif` (italic accent), `Eyebrow`, `Icon` + `ICON`
    (the site's SVG icons), `Tap` (pressable / link), `Btn`, `Field`, `PhoneField`, `Note`, `Loading`, `LoadError`, `useLoad`.
  - `Screen.tsx`: page frame (status-bar strip, scroll view, site header, site footer, tab-bar spacing, pull to refresh).
  - `SiteHeader`, `SiteFooter`, `TabBar`, `CategoryMenu` (the "All categories" sheet).
  - `ProductCard.tsx` (`ProductCard`, `Rating`, `WishButton`, `productHref`), `ProductArt.tsx` (`ProductArt`, `Logo`, `PayLogo`, `PayBadges`).
  - `controls.tsx`: `Breadcrumbs`, `Checkbox`, `Radio`, `QtyStepper`, `Sheet`, `DateField`, `CalendarSheet`, date helpers.
- `src/lib/` — logic shared with the website (keep in step with `simbatech-web/src/lib`):
  - `api.ts` fetch wrapper (session cookie is handled natively; CSRF token kept in memory),
  - `store.ts` session store + every action (cart, wishlist, auth, reviews, payment methods, checkout, …); read it with `useShop()`,
  - `catalog.ts` read-only loaders (catalog cached for a minute), `pricing.ts`, `phone.ts`, `menu.ts`, `hooks.ts`, `types.ts`.
- `src/theme.ts` — colours (`C`), font families (`F`), `GUTTER` (16), `TAB_BAR_HEIGHT`.

## Rules

- **Match the website's phone layout** (390px wide): same copy, colours, sizes, radii, icons and order of sections.
  Fix the site's obvious phone glitches rather than copying them (clipped headings, `[N]` placeholders, squeezed chips).
- Navigate with the site's paths: `<Tap href="/shop?mode=rent">`, `navigate("/product/" + id)`, `router.back()`.
  Read params with `useLocalSearchParams()`.
- Fonts: always through `T` / `H` / `Serif` (or `F.*` families). Never set `fontWeight` — pick the family for the weight.
- Icons: `<Icon xml={ICON.cart} />`, or paste the site's inner SVG markup: `<Icon xml='<path d="…"/>' size={18} sw={1.8} />`.
- Shadows use the `boxShadow` string style (`"0 4px 12px rgba(0,0,0,0.08)"`). Gradients: `expo-linear-gradient` or SVG.
- Money is whole birr: `formatETB(n)`. The API is authoritative for totals; `pricing.ts` only previews.
- Show API errors inline (`err.message`, `err.field`) with `<Note>` or a field's `error`; never `Alert.alert()`.
- **Phone numbers**: Ethiopian mobile, fixed `+251` chip + 9 digits starting with 7 or 9 → `PhoneField`; check with
  `isCompletePhone()` before submitting; stored/sent as `0911234567`. "Phone or email" boxes stay plain fields.
- Store details (city, phone, address, hours, policies) come from `storeVals(useShop())`. Don't hard-code them.
- The tab bar overlays the bottom of every screen except `/checkout`, `/signin`, `/pay` (`TAB_BAR_HIDDEN_ON`);
  `Screen` already leaves room for it.
- No API changes are needed by the app; it works against the API as deployed.

## Running

```bash
npm install
npx expo start            # then press a (Android emulator) / scan the QR code with Expo Go
```

- `EXPO_PUBLIC_API_URL` (in `.env.local`) points the app at another server, e.g. `http://10.0.2.2:8000` for a
  local API from the Android emulator. Default: the live site.
- Browser preview with a working session: `npx expo start` + `node scripts/web-preview.mjs` → http://localhost:8100
  (`API=http://localhost:8000 node scripts/web-preview.mjs` for a local API).
- Demo customer: `demo@simbatech.et` / `simbatech123`. Promo code `SIMBA10`.

## Checks before committing

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```
