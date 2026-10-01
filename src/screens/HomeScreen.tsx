/*
 * Home: hero carousel, promo banners, trust strip, categories, flash deals, offers, the rent-vs-buy
 * calculator, rental bundles, top products, brands and "why us" — the website's home page in its
 * phone layout, wired to the same API data.
 */
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import Slider from "@react-native-community/slider";
import { C, F, GUTTER } from "@/theme";
import { clearCatalogCache, listBundles, listCategories, listProducts } from "@/lib/catalog";
import { FREE_DELIVERY_THRESHOLD, rentalBasePrice } from "@/lib/pricing";
import { bootstrap, cart, formatETB, navigate, storeVals, useShop } from "@/lib/store";
import { useAction, useNow } from "@/lib/hooks";
import type { BundleDTO, CategoryDTO, ProductDTO } from "@/lib/types";
import { Screen } from "@/components/Screen";
import { deptHref } from "@/components/SiteHeader";
import { ProductArt } from "@/components/ProductArt";
import { ProductCard, productHref } from "@/components/ProductCard";
import { Btn, H, Icon, ICON, LoadError, Loading, Note, Serif, T, Tap, useLoad } from "@/components/ui";

// Short labels for the rent-vs-buy calculator, by product kind (falls back to the product name).
const CALC_LABELS: Record<string, string> = { camera: "Camera", tent: "Party tent", drill: "Drill", bike: "Bike" };
// The design's order for the calculator items and the "Shop by category" tiles.
const CALC_ORDER = ["camera", "tent", "drill"];
const CAT_ORDER = ["Electronics", "Phones", "Home & Living", "Kitchen", "Fashion", "Beauty", "Tools & DIY", "Events & Party"];
const TABS = [
  { id: "best", label: "Best sellers" },
  { id: "new", label: "New arrivals" },
  { id: "rent", label: "Most rented" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const SLIDES = [
  {
    eyebrow: "New season 2026",
    title: "Own it. Rent it.",
    accent: "Get it today.",
    sub: "Electronics, home, fashion, tools and event gear — shop to keep, or rent by the day. Delivered to your door.",
    cta1: "Shop now",
    href1: "/shop",
    cta2: "Rent something",
    href2: "/shop?mode=rent",
    chipKind: "camera",
    chipRent: true,
    bg: "#0D4F8B",
    art: "camera",
    chipName: "Lumen Z6 Camera",
    chipPrice: "ETB 2,500 / day",
  },
  {
    eyebrow: "Weekend rentals",
    title: "Party this weekend?",
    accent: "Rent the gear.",
    sub: "Tents, chairs, sound and lights — delivered, set up and collected when you are done.",
    cta1: "See event bundles",
    href1: deptHref("Events & Party"),
    cta2: "Browse rentals",
    href2: "/shop?mode=rent",
    chipKind: "tent",
    chipRent: false,
    bg: "#1F5E33",
    art: "tent",
    chipName: "Garden party bundle",
    chipPrice: "from ETB 6,500 / day",
  },
  {
    eyebrow: "Home refresh",
    title: "Make your home",
    accent: "feel brand new.",
    sub: "Sofas, coffee machines and everyday essentials, with free delivery over ETB [X].",
    cta1: "Shop home",
    href1: deptHref("Home & Living"),
    cta2: "View offers",
    href2: "/shop",
    chipKind: "sofa",
    chipRent: false,
    bg: "#1B2230",
    art: "sofa",
    chipName: "Linen 3-Seater Sofa",
    chipPrice: "ETB 84,900",
  },
];
// The hero chip and the Events & Party promo quote the "Garden party" bundle's real price.
const HERO_BUNDLE = "Garden party";
const FLASH_DURATION_MS = (4 * 3600 + 12 * 60 + 36) * 1000;

const pad2 = (n: number) => (n < 10 ? "0" : "") + n;
const byKind = (list: ProductDTO[], kind: string) => list.find((p) => p.kind === kind);

type HomeData = { products: ProductDTO[]; categories: CategoryDTO[]; bundles: BundleDTO[] };

export default function HomeScreen() {
  const { data, error, loading, reload } = useLoad<HomeData>(async () => {
    const [products, categories, bundles] = await Promise.all([listProducts(), listCategories(), listBundles()]);
    return { products, categories, bundles };
  }, []);

  return (
    <Screen
      onRefresh={async () => {
        clearCatalogCache();
        reload();
        await bootstrap();
      }}
    >
      {data ? <HomeBody data={data} /> : loading ? <Loading /> : <LoadError message={error} onRetry={reload} />}
    </Screen>
  );
}

function HomeBody({ data }: { data: HomeData }) {
  const { products: P, bundles } = data;
  const shop = useShop();
  const store = storeVals(shop);
  const heroBundle = bundles.find((b) => b.name === HERO_BUNDLE);
  const bundlesY = useRef(0);

  const cats = data.categories
    .slice()
    .sort((a, b) => {
      const ia = CAT_ORDER.indexOf(a.label);
      const ib = CAT_ORDER.indexOf(b.label);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })
    .slice(0, 8);
  const flash = P.filter((p) => !!p.was && !p.rentOnly).slice(0, 5);
  const camera = byKind(P, "camera");

  return (
    <View>
      {/* hero */}
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 16, gap: 20 }}>
        <Hero products={P} heroBundle={heroBundle} />

        <Tap href={deptHref("Events & Party")} style={{ backgroundColor: C.greenBg, borderRadius: 28, paddingVertical: 22, paddingHorizontal: 18, flexDirection: "row", alignItems: "flex-end", overflow: "hidden" }}>
          <View style={{ flex: 1, gap: 14 }}>
            <View style={{ gap: 8 }}>
              <T s={12} w={700} c={C.green} ls={0.96} upper>
                Weekend rentals
              </T>
              <H s={23.4} lh={23.4}>
                Event gear for your next party
              </H>
            </View>
            <View style={{ gap: 10, alignItems: "flex-start" }}>
              <T s={14} c={C.text}>
                from{" "}
                <T s={14} w={700}>
                  ETB 1,500 / day
                </T>
              </T>
              <View style={{ height: 38, paddingHorizontal: 16, borderRadius: 12, backgroundColor: C.ink, justifyContent: "center" }}>
                <T s={13} w={600} c={C.white}>
                  Book now
                </T>
              </View>
            </View>
          </View>
          <ProductArt kind="tent" size={116} style={{ marginRight: -10, marginBottom: -4 }} />
        </Tap>

        <Tap href="/shop?deals=1" style={{ backgroundColor: C.lilac, borderRadius: 28, paddingVertical: 22, paddingHorizontal: 18, flexDirection: "row", alignItems: "flex-end", overflow: "hidden" }}>
          <View style={{ flex: 1, gap: 14 }}>
            <View style={{ gap: 8 }}>
              <T s={12} w={700} c={C.purple} ls={0.96} upper>
                Flash deals
              </T>
              <H s={23.4} lh={23.4}>
                Up to 25% off wearables
              </H>
            </View>
            <View style={{ gap: 8 }}>
              <T s={12} w={600} c={C.text}>
                Ends in
              </T>
              <Countdown variant="dark" />
            </View>
          </View>
          <ProductArt kind="watch" size={116} style={{ marginRight: -10, marginBottom: -4 }} />
        </Tap>
      </View>

      {/* trust strip */}
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 20 }}>
        <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 24, paddingVertical: 6 }}>
          {[
            { icon: ICON.truck, bg: C.greenBg, fg: C.green, title: "Same-day delivery", sub: "Across " + store.city },
            { icon: ICON.shield, bg: C.butter, fg: "#8A6300", title: "100% genuine", sub: "With warranty" },
            { icon: ICON.calendar, bg: C.lilac, fg: C.purple, title: "Rent by the day", sub: "Extend anytime" },
            { icon: ICON.lock, bg: C.rose, fg: "#B0245F", title: "Secure checkout", sub: "Telebirr, Visa, Mastercard" },
          ].map((it) => (
            <View key={it.title} style={{ paddingVertical: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: it.bg, alignItems: "center", justifyContent: "center" }}>
                <Icon xml={it.icon} size={22} color={it.fg} sw={1.7} />
              </View>
              <View style={{ gap: 2, flex: 1 }}>
                <T s={15} w={700}>
                  {it.title}
                </T>
                <T s={13} c={C.muted}>
                  {it.sub}
                </T>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* categories */}
      <Section>
        <SectionHead eyebrow="Departments" title="Shop by category" link={{ label: "View all categories", href: "/shop" }} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {cats.map((c) => (
            <CategoryTile key={c.slug} cat={c} />
          ))}
        </View>
      </Section>

      {/* flash deals */}
      {flash.length ? (
        <View style={{ paddingHorizontal: GUTTER, paddingTop: 48 }}>
          <View style={{ backgroundColor: "#F6F5F1", borderRadius: 24, paddingVertical: 20, gap: 28, overflow: "hidden" }}>
            <View style={{ paddingHorizontal: 20, gap: 10, alignItems: "flex-start" }}>
              <View style={{ gap: 20 }}>
                <H s={29.25} lh={29.25}>
                  Flash deals
                </H>
                <View style={{ height: 44, paddingLeft: 14, paddingRight: 6, borderRadius: 12, backgroundColor: C.white, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <T s={13} w={600} c={C.text}>
                    Ends in
                  </T>
                  <Countdown variant="red" />
                </View>
              </View>
              <Tap href="/shop?deals=1" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <T s={15} w={600} c={C.navy}>
                  See all deals
                </T>
                <Icon xml={ICON.arrowRight} size={16} color={C.navy} />
              </Tap>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4, gap: 12 }}>
              {flash.map((p) => (
                <FlashCard key={p.id} product={p} />
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}

      {/* offers */}
      <Section>
        <SectionHead eyebrow="Offers" title="Deals worth grabbing" />
        <View style={{ gap: 20 }}>
          <Tap href={deptHref("Kitchen")} style={{ backgroundColor: "#DDF0FF", borderRadius: 32, paddingVertical: 22, paddingHorizontal: 18, flexDirection: "row", alignItems: "flex-end", overflow: "hidden" }}>
            <View style={{ flex: 1, gap: 14, alignItems: "flex-start" }}>
              <View style={{ gap: 12, alignItems: "flex-start" }}>
                <View style={{ height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.white, justifyContent: "center" }}>
                  <T s={12} w={700} c="#1F5FAE">
                    {"Kitchen & Home"}
                  </T>
                </View>
                <H s={22} w={600} lh={26} ls={-0.44}>
                  Up to
                </H>
                <H s={62.4} w={800} c="#1F5FAE" lh={56} ls={-3.744}>
                  30%
                  <H s={29.25} w={800} c="#1F5FAE" ls={-0.8775}>
                    {" off"}
                  </H>
                </H>
                <T s={16} c={C.text} lh={24}>
                  Coffee machines, blenders and small appliances.
                </T>
              </View>
              <View style={{ height: 48, paddingHorizontal: 22, borderRadius: 14, backgroundColor: C.navy, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <T s={14} w={700} c={C.white}>
                  Shop the sale
                </T>
                <Icon xml={ICON.arrowRight} size={16} color={C.white} />
              </View>
            </View>
            <ProductArt kind="espresso" size={116} style={{ marginRight: -10 }} />
          </Tap>

          <OfferBanner href={deptHref("Fashion")} bg={C.peach} eyebrow="Fashion week" eyebrowColor="#B4431C" title={"20% off sneakers & bags"} titleColor={C.ink} cta="Shop fashion" ctaColor={C.ink} art="sneaker" />
          <OfferBanner
            href={productHref(camera)}
            bg={C.navy}
            eyebrow="Rent, don't buy"
            eyebrowColor={C.mint}
            title={"Pro cameras from " + formatETB(camera?.rent ?? 2500) + " a day"}
            titleColor={C.white}
            cta="Book a camera"
            ctaColor={C.mint}
            art="camera"
          />
        </View>
      </Section>

      {/* rent vs buy */}
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 48 }}>
        <RentOrBuy products={P} />
      </View>

      {/* rental bundles */}
      {bundles.length ? (
        <View onLayout={(e) => (bundlesY.current = e.nativeEvent.layout.y)}>
          <Section>
            <View style={{ gap: 12, alignItems: "flex-start" }}>
              <View style={{ gap: 8 }}>
                <T s={13} w={700} c={C.green} ls={1.3} upper>
                  Rental bundles
                </T>
                <H s={29.25} lh={29.25}>
                  Everything for the occasion. <Serif c={C.green}>One booking.</Serif>
                </H>
              </View>
              <Btn title="Build your own bundle" variant="outline" h={50} px={20} s={14} w={600} icon={ICON.plus} iconSize={16} href="/shop?mode=rent" />
            </View>
            <View style={{ gap: 12 }}>
              {bundles.map((b) => (
                <BundleCard key={b.id} bundle={b} />
              ))}
            </View>
          </Section>
        </View>
      ) : null}

      {/* top products */}
      <TopProducts products={P} />

      {/* brands */}
      <Section gap={28}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <H s={24} lh={28} ls={-0.84}>
            Brands on Simbatech
          </H>
          <Tap href="/shop">
            <T s={14} w={600} c={C.navy}>
              All brands
            </T>
          </Tap>
        </View>
        <Brands />
      </Section>

      {/* why us */}
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 48 }}>
        <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 32, padding: 24, gap: 22 }}>
          <H s={23.4} lh={28} ls={-0.819}>
            Why people choose us
          </H>
          <View style={{ gap: 18 }}>
            {[
              ["One store, two ways", "Buy to keep, or rent for as long as you need."],
              ["Checked before it ships", "Every rental is inspected, cleaned and charged."],
              ["Pay the way you like", "Telebirr, Visa or Mastercard, secured."],
            ].map(([title, sub]) => (
              <View key={title} style={{ flexDirection: "row", gap: 14 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.greenBg, alignItems: "center", justifyContent: "center" }}>
                  <Icon xml={ICON.check} size={18} color={C.green} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T s={15} w={700}>
                    {title}
                  </T>
                  <T s={14} c={C.muted} lh={18}>
                    {sub}
                  </T>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function Section({ children, gap = 32 }: { children: React.ReactNode; gap?: number }) {
  return <View style={{ paddingHorizontal: GUTTER, paddingTop: 48, gap }}>{children}</View>;
}

export function SectionHead({ eyebrow, eyebrowColor = C.navy, title, link }: { eyebrow: string; eyebrowColor?: string; title: string; link?: { label: string; href: string } }) {
  return (
    <View style={{ gap: 12, alignItems: "flex-start" }}>
      <View style={{ gap: 8 }}>
        <T s={13} w={700} c={eyebrowColor} ls={1.3} upper>
          {eyebrow}
        </T>
        <H s={29.25} lh={29.25}>
          {title}
        </H>
      </View>
      {link ? (
        <Tap href={link.href} style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <T s={14} w={600} c={C.navy}>
            {link.label}
          </T>
          <Icon xml={ICON.arrowRight} size={16} color={C.navy} />
        </Tap>
      ) : null}
    </View>
  );
}

// ── Hero carousel ─────────────────────────────────────────────────────────────

function Hero({ products, heroBundle }: { products: ProductDTO[]; heroBundle?: BundleDTO }) {
  const [idx, setIdx] = useState(0);
  // advance every 6 seconds, like the site; picking a slide by hand restarts the wait
  useEffect(() => {
    const t = setTimeout(() => setIdx((i) => (i + 1) % SLIDES.length), 6000);
    return () => clearTimeout(t);
  }, [idx]);
  const goTo = (i: number) => setIdx((i + SLIDES.length) % SLIDES.length);

  const base = SLIDES[idx];
  const chipP = byKind(products, base.chipKind);
  const chipIsBundle = base.chipName === HERO_BUNDLE + " bundle";
  const matches = !!chipP && base.chipName === chipP.name;
  const chipHref = chipIsBundle ? deptHref("Events & Party") : chipP ? productHref(chipP) : base.href1;
  const chipPrice = chipIsBundle && heroBundle ? "from " + formatETB(heroBundle.price) + " / day" : matches && chipP ? (base.chipRent && chipP.rent ? formatETB(chipP.rent) + " / day" : formatETB(chipP.buy)) : base.chipPrice;
  const sub = base.sub.replace("ETB [X]", formatETB(FREE_DELIVERY_THRESHOLD));

  return (
    <View accessibilityLabel="Featured" style={{ backgroundColor: base.bg, borderRadius: 28, paddingVertical: 26, paddingHorizontal: 22, gap: 16, overflow: "hidden" }}>
      <View style={{ gap: 14, minHeight: 350, alignItems: "flex-start" }}>
        <View style={{ height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: C.mint }} />
          <T s={12} w={600} c="#CFEBD3" ls={0.72} upper>
            {base.eyebrow}
          </T>
        </View>
        <H s={37} c={C.white} lh={37} ls={-1.667}>
          {base.title} <Serif c={C.mint} ls={-0.74}>{base.accent}</Serif>
        </H>
        <T s={17} c="#E1ECF5" lh={26.35}>
          {sub}
        </T>
        <View style={{ paddingTop: 6, gap: 12, alignItems: "flex-start" }}>
          <Btn title={base.cta1} href={base.href1} icon={ICON.arrowRight} />
          <Btn title={base.cta2} href={base.href2} variant="outlineWhite" h={54} w={600} />
        </View>
      </View>

      <View style={{ alignItems: "center" }}>
        <ProductArt kind={base.art} size={170} />
      </View>

      <Tap
        href={chipHref}
        style={{ alignSelf: "flex-start", minHeight: 44, paddingLeft: 16, paddingRight: 8, paddingVertical: 7, borderRadius: 999, backgroundColor: C.white, flexDirection: "row", alignItems: "center", gap: 12, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.4)" }}
      >
        <View>
          <T s={11} c={C.muted} lh={13}>
            {matches && chipP ? chipP.name : base.chipName}
          </T>
          <T s={13} w={700} lh={16}>
            {chipPrice}
          </T>
        </View>
        <View style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: C.navy, alignItems: "center", justifyContent: "center" }}>
          <Icon xml={ICON.plus} size={14} color={C.white} sw={2.2} />
        </View>
      </Tap>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <T s={14} c={C.white} style={{ fontFamily: F.b600 }}>
          {"0" + (idx + 1)} <T s={14} c="rgba(255,255,255,0.5)" style={{ fontFamily: F.b600 }}>/ 0{SLIDES.length}</T>
        </T>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {SLIDES.map((_, i) => {
            const on = i === idx;
            return (
              <Tap key={i} onPress={() => goTo(i)} label={"Show slide " + (i + 1)} hitSlop={0} style={{ width: on ? 40 : 24, height: 44, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: on ? 28 : 8, height: 6, borderRadius: 999, backgroundColor: on ? C.mint : "rgba(255,255,255,0.45)" }} />
              </Tap>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Tap onPress={() => goTo(idx - 1)} label="Previous slide" hitSlop={0} style={{ width: 44, height: 44, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", alignItems: "center", justifyContent: "center" }}>
            <Icon xml={ICON.arrowLeft} size={16} color={C.white} />
          </Tap>
          <Tap onPress={() => goTo(idx + 1)} label="Next slide" hitSlop={0} style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
            <Icon xml={ICON.arrowRight} size={16} color={C.ink} />
          </Tap>
        </View>
      </View>
    </View>
  );
}

// ── Flash-deal countdown ──────────────────────────────────────────────────────

// One deadline for the whole session, so both countdowns on the page agree.
const flashEndsAt = Date.now() + FLASH_DURATION_MS;

function Countdown({ variant }: { variant: "dark" | "red" }) {
  const now = useNow(1000);
  const secs = Math.floor(Math.max(0, flashEndsAt - now) / 1000);
  const parts = [pad2(Math.floor(secs / 3600)), pad2(Math.floor((secs % 3600) / 60)), pad2(secs % 60)];
  if (variant === "dark") {
    return (
      <View style={{ flexDirection: "row", gap: 6 }}>
        {parts.map((v, i) => (
          <View key={i} style={{ width: 46, height: 42, borderRadius: 10, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
            <T s={17} w={700} c={i === 2 ? C.mint : C.white}>
              {v}
            </T>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {parts.map((v, i) => (
        <React.Fragment key={i}>
          {i > 0 ? (
            <T s={13} w={600} c={C.text}>
              :
            </T>
          ) : null}
          <View style={{ minWidth: 36, height: 32, paddingHorizontal: 6, borderRadius: 8, backgroundColor: C.red, alignItems: "center", justifyContent: "center" }}>
            <T s={15} w={700} c={C.white}>
              {v}
            </T>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

// ── Tiles and cards ───────────────────────────────────────────────────────────

function CategoryTile({ cat }: { cat: CategoryDTO }) {
  const { width } = useWindowDimensions();
  const w = (width - GUTTER * 2 - 16) / 2;
  return (
    <Tap href={deptHref(cat.label)} hitSlop={0} style={{ width: w, height: 212, borderRadius: 24, backgroundColor: cat.bg, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 18, alignItems: "center", justifyContent: "space-between" }}>
      <ProductArt kind={cat.kind} size={124} />
      <View style={{ alignItems: "center", gap: 3 }}>
        <T s={15} w={700} ls={-0.15} center>
          {cat.label}
        </T>
        <T s={12} w={500} c="#4A505C">
          {cat.tag}
        </T>
      </View>
    </Tap>
  );
}

function FlashCard({ product: p }: { product: ProductDTO }) {
  const action = useAction();
  const discount = "-" + Math.round((1 - p.buy / (p.was || p.buy)) * 100) + "%";
  return (
    <View style={{ width: 162, backgroundColor: C.white, borderRadius: 20, paddingTop: 8, paddingHorizontal: 8, paddingBottom: 12, gap: 10 }}>
      <Tap href={productHref(p)} label={p.name} hitSlop={0} style={{ height: 136, borderRadius: 14, backgroundColor: p.bg, alignItems: "center", justifyContent: "center" }}>
        <ProductArt kind={p.kind} size={116} />
        <View style={{ position: "absolute", top: 8, left: 8, height: 22, paddingHorizontal: 8, borderRadius: 8, backgroundColor: C.red, justifyContent: "center" }}>
          <T s={11} w={700} c={C.white} lh={14}>
            {discount}
          </T>
        </View>
      </Tap>
      <View style={{ paddingHorizontal: 4, marginTop: -6, gap: 6, flexGrow: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon xml={ICON.star} size={13} color={C.star} filled />
          <T s={12} w={600}>
            {p.rating}
          </T>
          <T s={12} c={C.muted}>
            ·
          </T>
          <T s={12} c={C.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
            {p.cat}
          </T>
        </View>
        <Tap href={productHref(p)} hitSlop={0}>
          <T s={14} w={700} lh={18.2} ls={-0.14} numberOfLines={2}>
            {p.name}
          </T>
        </Tap>
        <View>
          <T s={16} w={700} c={C.red}>
            {formatETB(p.buy)}
          </T>
          <T s={13} c={C.muted} style={{ textDecorationLine: "line-through" }}>
            {formatETB(p.was || 0)}
          </T>
        </View>
        <View style={{ paddingTop: 4, gap: 6 }}>
          <View style={{ height: 6, borderRadius: 999, backgroundColor: "#F1EEE8", overflow: "hidden" }}>
            <View style={{ height: 6, width: `${Math.min(100, Math.max(0, p.sold))}%`, borderRadius: 999, backgroundColor: "#F08A24" }} />
          </View>
          <T s={12} w={500} c={C.muted}>
            Only {p.left} left
          </T>
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Tap
          onPress={() => action.run(() => cart.add({ productId: p.id, mode: "buy", qty: 1 }))}
          disabled={action.busy}
          hitSlop={0}
          style={{ height: 40, borderRadius: 12, backgroundColor: C.green, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: action.busy ? 0.7 : 1 }}
        >
          <Icon xml={ICON.cart} size={16} color={C.white} />
          <T s={13} w={700} c={C.white}>
            {action.busy ? "Adding…" : action.done ? "Added" : "Add to cart"}
          </T>
        </Tap>
        <Note>{action.err}</Note>
      </View>
    </View>
  );
}

function OfferBanner(props: { href: string; bg: string; eyebrow: string; eyebrowColor: string; title: string; titleColor: string; cta: string; ctaColor: string; art: string }) {
  return (
    <Tap href={props.href} style={{ backgroundColor: props.bg, borderRadius: 28, paddingVertical: 22, paddingHorizontal: 18, flexDirection: "row", alignItems: "flex-end", overflow: "hidden" }}>
      <View style={{ flex: 1, gap: 14, alignItems: "flex-start" }}>
        <View style={{ gap: 8 }}>
          <T s={12} w={700} c={props.eyebrowColor} ls={0.96} upper>
            {props.eyebrow}
          </T>
          <H s={25.35} c={props.titleColor} lh={25.35}>
            {props.title}
          </H>
        </View>
        <T s={14} w={700} c={props.ctaColor} style={{ textDecorationLine: "underline" }}>
          {props.cta}
        </T>
      </View>
      <ProductArt kind={props.art} size={116} style={{ marginRight: -10, marginBottom: -4 }} />
    </Tap>
  );
}

function BundleCard({ bundle: b }: { bundle: BundleDTO }) {
  const action = useAction();
  const booked = action.done;
  const items = b.items || [];
  return (
    <View style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 20, overflow: "hidden" }}>
      <View style={{ height: 220, backgroundColor: b.bg, alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", top: 16, left: 16, height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.white, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon xml={ICON.box} size={13} />
          <T s={12} w={700}>
            {b.count || items.length} items
          </T>
        </View>
        <ProductArt kind={b.k1} size={124} style={{ marginRight: 40 }} />
        <ProductArt kind={b.k2} size={124} style={{ position: "absolute", right: 14, bottom: 4 }} />
      </View>
      <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <View style={{ gap: 6 }}>
          <H s={23} lh={27} ls={-0.69}>
            {b.name}
          </H>
          <T s={14} c={C.muted} lh={21}>
            {b.desc}
          </T>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {items.map((it) => (
            <View key={it.label} style={{ height: 28, paddingHorizontal: 10, borderRadius: 8, backgroundColor: C.sand, justifyContent: "center" }}>
              <T s={12} w={600} c={C.text}>
                {it.label}
              </T>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View>
            <T s={12} c={C.muted} lh={14.4}>
              from
            </T>
            <T s={16} w={700} lh={19.2}>
              {formatETB(b.price || 0)}{" "}
              <T s={13} w={500} c={C.muted}>
                / day
              </T>
            </T>
          </View>
          <Tap
            onPress={() => {
              if (booked) return navigate("/cart");
              // books every rentable item in the bundle for one day and keeps the customer here; the button then offers the cart
              action.run(() => cart.addBundle({ bundleId: b.id, rentDays: 1 }), true);
            }}
            disabled={action.busy}
            label={"Book bundle: " + b.name}
            hitSlop={0}
            style={{ height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: C.green, justifyContent: "center", opacity: action.busy ? 0.7 : 1 }}
          >
            <T s={14} w={700} c={C.white}>
              {action.busy ? "Booking…" : booked ? "Booked · View cart" : "Book bundle"}
            </T>
          </Tap>
        </View>
        <Note>{action.err}</Note>
      </View>
    </View>
  );
}

// ── Rent-vs-buy calculator ────────────────────────────────────────────────────

function RentOrBuy({ products }: { products: ProductDTO[] }) {
  const items = products
    .filter((p) => !!p.rent)
    .slice()
    .sort((a, b) => {
      const ia = CALC_ORDER.indexOf(a.kind);
      const ib = CALC_ORDER.indexOf(b.kind);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  const def = items.find((p) => p.kind === "tent") || items[0];
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [days, setDays] = useState(4);
  const c = items.find((p) => p.id === pickedId) || def;

  let calc = {
    kind: "camera",
    name: "",
    href: "/shop?mode=rent",
    rate: 0,
    buy: 0,
    rentTotal: 0,
    rentPct: 4,
    buyPct: 4,
    verdict: "",
    verdictSub: "",
    rentWins: false,
    cta: "Browse rentals",
  };
  if (c && c.rent) {
    const rate = c.rent;
    const rentTotal = rentalBasePrice(rate, c.plans || [], days);
    const maxV = Math.max(rentTotal, c.buy);
    const saves = c.buy - rentTotal;
    let breakEven = Math.ceil(c.buy / rate);
    for (let d = 1; d <= 365; d++) {
      if (rentalBasePrice(rate, c.plans || [], d) >= c.buy) {
        breakEven = d;
        break;
      }
    }
    const rentWins = saves > 0;
    calc = {
      kind: c.kind,
      name: c.name,
      href: "/product/" + c.id,
      rate,
      buy: c.buy,
      rentTotal,
      rentPct: Math.max(4, Math.round((rentTotal / maxV) * 100)),
      buyPct: Math.max(4, Math.round((c.buy / maxV) * 100)),
      verdict: rentWins ? "Renting saves you " + formatETB(saves) : "Buying is the better deal",
      verdictSub: rentWins ? "Buying only pays off after " + breakEven + " days." : "After " + breakEven + " days, owning it costs less.",
      rentWins,
      cta: rentWins ? "Rent it" : "Buy it",
    };
  }
  const dayWord = days === 1 ? "day" : "days";

  return (
    <View style={{ backgroundColor: C.navy, borderRadius: 28, paddingVertical: 28, paddingHorizontal: 20, gap: 40 }}>
      <View style={{ gap: 22 }}>
        <T s={13} w={700} c={C.mint} ls={1.3} upper>
          Rent or buy?
        </T>
        <H s={33} c={C.white} lh={32.5} ls={-1.49}>
          Only need it for a few days? <Serif c={C.mint}>Rent it.</Serif>
        </H>
        <T s={17} c="#CFE2F3" lh={26.35}>
          {"Pick an item and how long you need it. We'll show you which one saves you more."}
        </T>
        <View style={{ paddingTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 10 }} accessibilityLabel="Choose an item">
          {items.map((p) => {
            const on = !!c && p.id === c.id;
            return (
              <Tap
                key={p.id}
                onPress={() => setPickedId(p.id)}
                hitSlop={0}
                accessibilityState={{ selected: on }}
                style={{ height: 48, paddingHorizontal: 20, borderRadius: 14, borderWidth: 1, borderColor: on ? C.white : "rgba(255,255,255,0.35)", backgroundColor: on ? C.white : "transparent", justifyContent: "center" }}
              >
                <T s={15} w={600} c={on ? C.navy : C.white}>
                  {CALC_LABELS[p.kind] || p.name}
                </T>
              </Tap>
            );
          })}
        </View>
      </View>

      <View style={{ backgroundColor: C.white, borderRadius: 28, padding: 20, gap: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
          <View style={{ width: 88, height: 88, borderRadius: 20, backgroundColor: "#F6F5F1", alignItems: "center", justifyContent: "center" }}>
            <ProductArt kind={calc.kind} size={80} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <T s={20} w={700} ls={-0.4} lh={26}>
              {calc.name}
            </T>
            <T s={14} c={C.muted} lh={18}>
              Rent {formatETB(calc.rate)} / day · Buy {formatETB(calc.buy)}
            </T>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
            <T s={15} w={600} lh={19} style={{ flex: 1 }}>
              How many days do you need it?
            </T>
            <H s={28} lh={34} ls={-0.84}>
              {days} {dayWord}
            </H>
          </View>
          <Slider
            minimumValue={1}
            maximumValue={30}
            step={1}
            value={days}
            onValueChange={(v) => setDays(Math.round(v) || 1)}
            minimumTrackTintColor={C.navy}
            maximumTrackTintColor="#D9D6CF"
            thumbTintColor={C.navy}
            accessibilityLabel="How many days do you need it?"
            style={{ height: 28, marginHorizontal: -4 }}
          />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <T s={12} c={C.muted}>
              1 day
            </T>
            <T s={12} c={C.muted}>
              30 days
            </T>
          </View>
        </View>

        <View style={{ gap: 14 }}>
          <Bar label={"Rent for " + days + " " + dayWord} value={formatETB(calc.rentTotal)} pct={calc.rentPct} color="#418D4D" />
          <Bar label="Buy it" value={formatETB(calc.buy)} pct={calc.buyPct} color={C.blue} />
        </View>

        <View style={{ backgroundColor: calc.rentWins ? C.greenBg : C.sky, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T s={16} w={700} c={calc.rentWins ? C.green : C.navy} lh={21}>
              {calc.verdict}
            </T>
            <T s={13} c={C.text} lh={17}>
              {calc.verdictSub}
            </T>
          </View>
          <Btn title={calc.cta} href={calc.href} variant="navy" h={46} r={12} px={18} s={14} />
        </View>
      </View>
    </View>
  );
}

function Bar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <T s={14} w={600}>
          {label}
        </T>
        <T s={14} w={700}>
          {value}
        </T>
      </View>
      <View style={{ height: 12, borderRadius: 999, backgroundColor: "#F1EEE8", overflow: "hidden" }}>
        <View style={{ height: 12, width: `${pct}%`, borderRadius: 999, backgroundColor: color }} />
      </View>
    </View>
  );
}

// ── Top products ──────────────────────────────────────────────────────────────

function TopProducts({ products }: { products: ProductDTO[] }) {
  const [tab, setTab] = useState<TabId>("best");
  const { width } = useWindowDimensions();
  const cardW = (width - GUTTER * 2 - 12) / 2;
  const list =
    tab === "new"
      ? products.slice().reverse()
      : tab === "rent"
        ? products.filter((p) => !!p.rent)
        : products.slice().sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating) || b.reviews - a.reviews);

  return (
    <Section>
      <View style={{ gap: 12 }}>
        <View style={{ gap: 8 }}>
          <T s={13} w={700} c={C.navy} ls={1.3} upper>
            Trending
          </T>
          <H s={29.25} lh={29.25}>
            Top products
          </H>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderRadius: 14, backgroundColor: C.sand, flexGrow: 0 }} contentContainerStyle={{ padding: 4, gap: 4 }} accessibilityRole="tablist">
          {TABS.map((t) => {
            const on = t.id === tab;
            return (
              <Tap
                key={t.id}
                onPress={() => setTab(t.id)}
                hitSlop={0}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[{ height: 40, paddingHorizontal: 18, borderRadius: 11, justifyContent: "center", backgroundColor: on ? C.white : "transparent" }, on && { boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }]}
              >
                <T s={14} w={600} c={on ? C.ink : C.muted}>
                  {t.label}
                </T>
              </Tap>
            );
          })}
        </ScrollView>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {list.slice(0, 8).map((p) => (
          <ProductCard key={tab + p.id} product={p} preferRent={tab === "rent"} style={{ width: cardW }} />
        ))}
      </View>
    </Section>
  );
}

// ── Brands ────────────────────────────────────────────────────────────────────

function Brands() {
  const { width } = useWindowDimensions();
  const w = (width - GUTTER * 2 - 20) / 3;
  const tile = { width: w, height: 64, borderRadius: 16, backgroundColor: "#F6F5F1", alignItems: "center", justifyContent: "center", flexDirection: "row" } as const;
  const href = (name: string) => "/shop?brand=" + encodeURIComponent(name);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      <Tap href={href("Nova")} hitSlop={0} style={tile}>
        <T s={17} ls={0.68} style={{ fontFamily: F.b800 }}>
          NOVA
        </T>
      </Tap>
      <Tap href={href("Aero")} hitSlop={0} style={tile}>
        <T s={17} w={700} c="#1F5FAE" ls={0.68}>
          aero
          <T s={17} w={700} c="#FF7A45">
            .
          </T>
        </T>
      </Tap>
      <Tap href={href("Pulse")} hitSlop={0} style={tile}>
        <T s={22} c={C.navy} style={{ fontFamily: F.serifItalic }}>
          Pulse
        </T>
      </Tap>
      <Tap href={href("Lumen")} hitSlop={0} style={[tile, { gap: 8 }]}>
        <View style={{ width: 17, height: 17, borderRadius: 999, borderWidth: 3, borderColor: C.ink }} />
        <T s={17} w={600} ls={0.68}>
          LUMEN
        </T>
      </Tap>
      <Tap href={href("Casa Verde")} hitSlop={0} style={tile}>
        <T s={22} c="#7A4E2D" style={{ fontFamily: F.serif }}>
          casa verde
        </T>
      </Tap>
      <Tap href={href("Orbit")} hitSlop={0} style={tile}>
        <T s={17} c={C.purple} ls={0.68} style={{ fontFamily: F.b800 }}>
          orbit
        </T>
      </Tap>
    </View>
  );
}
