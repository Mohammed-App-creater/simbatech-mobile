/*
 * Product page: gallery, title / rating / stock, the Buy it / Rent it choice with rental plans,
 * dates, add-ons and live totals (or variants and quantity when buying), delivery options, the
 * details tabs with reviews, "frequently rented together" and related products — the website's
 * product page in its phone layout, wired to the same API.
 */
import React, { useEffect, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { C, GUTTER } from "@/theme";
import { clearCatalogCache, getProduct, getReviews, listProducts } from "@/lib/catalog";
import { FREE_DELIVERY_THRESHOLD, rentalBasePrice, rentalLinePrice } from "@/lib/pricing";
import { bootstrap, cart, formatETB, navigate, storeVals, useShop, type CartAddInput } from "@/lib/store";
import { tomorrowISO, useAction, useNow } from "@/lib/hooks";
import type { ProductDTO, ReviewsDTO } from "@/lib/types";
import { Screen, useScreenScroll } from "@/components/Screen";
import { deptHref } from "@/components/SiteHeader";
import { addDaysISO, Breadcrumbs, Checkbox, DateField, formatDay, QtyStepper, Radio, type Crumb } from "@/components/controls";
import { ProductArt } from "@/components/ProductArt";
import { ProductCard } from "@/components/ProductCard";
import { Btn, H, Icon, ICON, LoadError, Loading, T, Tap, useLoad } from "@/components/ui";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductDetails, type DetailsTab } from "@/components/product/ProductDetails";
import { RentTogether } from "@/components/product/RentTogether";
import { durLabel, plural, rememberViewed, SOFT, Stars } from "@/components/product/shared";

const LOW_STOCK = 5;
const MAX_QTY = 10;

type ProductData = { product: ProductDTO | null; all: ProductDTO[]; reviews: ReviewsDTO | null };

async function loadProduct(slug: string): Promise<ProductData> {
  const [product, all, reviews] = await Promise.all([slug ? getProduct(slug) : null, listProducts(), slug ? getReviews(slug) : null]);
  return { product, all, reviews };
}

// The reviews shape for a product that has none yet.
function emptyReviews(p: ProductDTO): ReviewsDTO {
  return { rating: p.rating || "0.0", count: p.reviews || 0, distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0, percent: 0 })), items: [], mine: null };
}

// The 3-day plan is the default duration when the product has one.
function defaultPlanDays(p: ProductDTO) {
  const plans = p.plans || [];
  if (!plans.length) return 1;
  return (plans.find((pl) => pl.days === 3) || plans[0]).days;
}

export default function ProductScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = String((Array.isArray(params.slug) ? params.slug[0] : params.slug) || "");
  const { data, error, loading, reload } = useLoad<ProductData>(() => loadProduct(slug), [slug]);

  return (
    <Screen
      activeDept={data && data.product ? data.product.dept : undefined}
      searchMode="rent"
      onRefresh={async () => {
        clearCatalogCache();
        reload();
        await bootstrap();
      }}
    >
      {data ? data.product ? <ProductBody key={data.product.id} product={data.product} all={data.all} reviews={data.reviews} /> : <NotFound /> : loading ? <Loading /> : <LoadError message={error} onRetry={reload} />}
    </Screen>
  );
}

/** `/product` without a slug opens the first product, or the shop when there are none (like the site). */
export function ProductIndexScreen() {
  const { data, error, loading, reload } = useLoad(listProducts, []);
  if (data) return <Redirect href={(data.length ? "/product/" + data[0].id : "/shop") as never} />;
  return <Screen>{loading ? <Loading /> : <LoadError message={error} onRetry={reload} />}</Screen>;
}

function NotFound() {
  return (
    <View style={{ margin: GUTTER, marginTop: 24, padding: 24, borderRadius: 24, backgroundColor: C.paper, gap: 14, alignItems: "flex-start" }}>
      <T s={13} w={700} c={C.navy} ls={1.3} upper>
        Product not found
      </T>
      <H s={28} lh={30}>
        We couldn’t find that product.
      </H>
      <T s={15} c={C.text} lh={22}>
        It may have been removed, or the link is out of date. Everything we sell and rent is in the shop.
      </T>
      <Btn title="Browse the shop" variant="navy" h={48} href="/shop" icon={ICON.arrowRight} />
    </View>
  );
}

function ProductBody({ product: P, all, reviews }: { product: ProductDTO; all: ProductDTO[]; reviews: ReviewsDTO | null }) {
  const shop = useShop();
  const store = storeVals(shop);
  const scroll = useScreenScroll();
  const { width } = useWindowDimensions();
  const canRent = !!P.rent;
  const canBuy = !P.rentOnly;

  // What the website's page loader derives from the catalog.
  const others = all.filter((p) => p.id !== P.id);
  const related = [...others.filter((p) => p.dept === P.dept), ...others.filter((p) => p.dept !== P.dept)].slice(0, 4);
  const rentTogether = others.filter((p) => !!p.rent).slice(0, 2);

  const [picked, setPicked] = useState<"buy" | "rent">(canRent ? "rent" : "buy");
  const [tab, setTab] = useState<DetailsTab>("overview");
  const mode = picked === "rent" && canRent ? "rent" : canBuy ? "buy" : "rent";
  const isRent = mode === "rent";

  // Reviews: the page's snapshot until the customer writes or deletes one, then the API's response.
  const [rv, setRv] = useState<ReviewsDTO>(reviews || emptyReviews(P));
  const [loaded, setLoaded] = useState(reviews);
  if (loaded !== reviews) {
    setLoaded(reviews);
    setRv(reviews || emptyReviews(P));
  }
  // "Your review" depends on who is signed in: refresh when that changes while the page is open.
  const userId = shop.user ? shop.user.id : null;
  const lastUser = useRef(userId);
  useEffect(() => {
    if (lastUser.current === userId) return;
    lastUser.current = userId;
    let live = true;
    getReviews(P.id).then(
      (next) => live && next && setRv(next),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [userId, P.id]);

  useEffect(() => {
    rememberViewed(P.id);
  }, [P.id]);

  // "3 reviews" under the title opens the Reviews tab and scrolls to it.
  const rootY = useRef(0);
  const detailsY = useRef(0);
  const openReviews = () => {
    setTab("reviews");
    scroll.scrollTo(rootY.current + detailsY.current + 32);
  };

  const crumbs: Crumb[] = [{ label: "Home", href: "/" }, { label: P.dept, href: deptHref(P.dept) }];
  if (P.cat && P.cat !== P.dept) crumbs.push({ label: P.cat, href: deptHref(P.dept) });
  crumbs.push({ label: P.name });

  const stock = P.avail ? (P.left <= LOW_STOCK ? "Only " + P.left + " left" : "In stock") : P.shipsInDays ? "Ships in " + plural(P.shipsInDays, "day") : "Out of stock";
  // Warranty: the product's own term, else the store-wide one. Some terms already say "warranty".
  const warranty = P.warranty || store.warranty;
  const warrantySaysIt = /warranty/i.test(warranty);
  const cardW = (width - GUTTER * 2 - 12) / 2;

  return (
    <View onLayout={(e) => (rootY.current = e.nativeEvent.layout.y)}>
      <Breadcrumbs items={crumbs} />

      <View style={{ paddingHorizontal: GUTTER, paddingTop: 20, gap: 14 }}>
        <ProductGallery product={P} />

        <View style={{ gap: 22 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Tap href={"/shop?brand=" + encodeURIComponent(P.brand || "")} style={{ height: 32, flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
              <View style={{ width: 18, height: 18, borderRadius: 999, borderWidth: 3, borderColor: C.ink }} />
              <T s={14} w={600} ls={4.2} upper numberOfLines={1} style={{ flexShrink: 1 }}>
                {P.brand}
              </T>
            </Tap>
            <T s={13} c={C.muted}>
              SKU {P.sku || "—"}
            </T>
          </View>

          <View style={{ gap: 12 }}>
            <H s={29.25} lh={30} ls={-1.316} accessibilityRole="header">
              {P.name}
            </H>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Stars value={rv.rating || "0.0"} />
                <T s={14} w={700}>
                  {rv.rating || "0.0"}
                </T>
              </View>
              <Tap onPress={openReviews} accessibilityRole="link" style={{ height: 32, justifyContent: "center" }}>
                <T s={14} w={600} c={C.navy} style={{ textDecorationLine: "underline" }}>
                  {plural(rv.count || 0, "review")}
                </T>
              </Tap>
              <View style={{ width: 1, height: 16, backgroundColor: C.lineStrong }} />
              <View style={{ height: 32, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: "#418D4D", boxShadow: "0 0 0 4px #E4F2E6" }} />
                <T s={14} w={600} c={C.green}>
                  {stock}
                </T>
              </View>
            </View>
          </View>

          <T s={16} lh={25.6} c={C.text}>
            {P.description}
          </T>

          <View accessibilityLabel={"Buy or rent " + P.name} style={{ padding: 5, gap: 4, backgroundColor: C.sand, borderRadius: 18 }}>
            {canBuy ? <ModeButton title="Buy it" sub={formatETB(P.buy || 0)} on={!isRent} color={C.navy} subOn="#D6E8F7" onPress={() => setPicked("buy")} /> : null}
            {canRent ? <ModeButton title="Rent it" sub={"from " + formatETB(P.rent || 0) + " / day"} on={isRent} color={C.green} subOn={C.greenBg} onPress={() => setPicked("rent")} /> : null}
          </View>

          {/* both panels stay mounted so choices survive switching between Buy it and Rent it */}
          {canRent ? (
            <View style={{ display: isRent ? "flex" : "none" }}>
              <RentPanel product={P} />
            </View>
          ) : null}
          {canBuy ? (
            <View style={{ display: isRent ? "none" : "flex" }}>
              <BuyPanel product={P} warrantyNote={"Genuine, sealed stock with " + warranty + (warrantySaysIt ? "." : " manufacturer warranty.")} />
            </View>
          ) : null}
        </View>

        <DeliveryEstimator />

        <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 24, paddingVertical: 4 }}>
          <Assurance icon={ICON.shield} sw={1.7} bg={C.butter} fg="#8A6300" title="Genuine + warranty" sub={warrantySaysIt ? warranty : warranty + " warranty"} first />
          <Assurance icon={ICON.check} sw={2} bg={C.greenBg} fg={C.green} title="Checked & cleaned" sub="Before every rental" />
          <Assurance icon={ICON.lock} sw={1.7} bg={C.rose} fg="#B0245F" title="Secure payment" sub="Telebirr or card" />
        </View>
      </View>

      <View onLayout={(e) => (detailsY.current = e.nativeEvent.layout.y)} style={{ paddingHorizontal: GUTTER, paddingTop: 48 }}>
        <ProductDetails product={P} reviews={rv} onReviews={setRv} tab={tab} onTab={setTab} />
      </View>

      {canRent && rentTogether.length > 0 ? (
        <View style={{ paddingHorizontal: GUTTER, paddingTop: 48 }}>
          <RentTogether product={P} others={rentTogether} />
        </View>
      ) : null}

      {related.length > 0 ? (
        <View style={{ paddingHorizontal: GUTTER, paddingTop: 48, gap: 32 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <T s={13} w={700} c={C.navy} ls={1.3} upper>
                Complete the kit
              </T>
              <H s={29.25} lh={29.25} ls={-1.17}>
                You might also need
              </H>
            </View>
            <Tap href="/shop" style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <T s={14} w={600} c={C.navy}>
                View all
              </T>
              <Icon xml={ICON.arrowRight} size={16} color={C.navy} />
            </Tap>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {related.map((p) => (
              <ProductCard key={p.id} product={p} style={{ width: cardW }} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ── Buy it / Rent it ──────────────────────────────────────────────────────────

function ModeButton({ title, sub, on, color, subOn, onPress }: { title: string; sub: string; on: boolean; color: string; subOn: string; onPress: () => void }) {
  return (
    <Tap
      onPress={onPress}
      hitSlop={0}
      accessibilityState={{ selected: on }}
      style={[{ height: 66, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: on ? color : "transparent" }, on && { boxShadow: "0 6px 16px -8px " + (color === C.navy ? "rgba(13,79,139,0.6)" : "rgba(47,122,60,0.6)") }]}
    >
      <T s={17} w={700} c={on ? C.white : C.text}>
        {title}
      </T>
      <T s={13} w={500} c={on ? subOn : C.muted}>
        {sub}
      </T>
    </Tap>
  );
}

function GroupLabel({ children, color }: { children: string; color: string }) {
  return (
    <T s={13} w={700} c={color} ls={1.3} upper>
      {children}
    </T>
  );
}

function InlineError({ children }: { children: string }) {
  return (
    <T s={13} w={500} c={C.red} center style={{ marginTop: -10 }} accessibilityLiveRegion="polite">
      {children}
    </T>
  );
}

// ── Renting: plan, dates, add-ons, totals, "Book rental" ──────────────────────

function RentPanel({ product: P }: { product: ProductDTO }) {
  const plans = P.plans || [];
  const rate = P.rent || 0;
  const addOnDefs = P.addOns || [];
  const minStart = tomorrowISO();
  const [days, setDays] = useState(defaultPlanDays(P));
  const [start, setStart] = useState(minStart);
  const [addons, setAddons] = useState<Record<string, boolean>>({});
  const book = useAction();

  const selected = addOnDefs.filter((a) => addons[a.key]).map((a) => a.key);
  const base = rentalBasePrice(rate, plans, days);
  const total = rentalLinePrice(rate, plans, addOnDefs, selected, days);

  // Adds the rental to the cart and opens the cart, like the site.
  const bookRental = () =>
    book.run(async () => {
      await cart.add({ productId: P.id, mode: "rent", rentStart: start || minStart, rentDays: days, addOns: selected });
      navigate("/cart");
    });

  return (
    <View style={{ gap: 22 }}>
      {plans.length > 0 ? (
        <View style={{ gap: 12 }}>
          <GroupLabel color={C.green}>How long do you need it?</GroupLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {plans.map((pl) => {
              const on = pl.days === days;
              const full = pl.days * rate;
              const pct = full > 0 ? Math.round((1 - pl.price / full) * 100) : 0;
              return (
                <Tap
                  key={pl.days}
                  onPress={() => {
                    setDays(pl.days);
                    if (book.err) book.clear();
                  }}
                  hitSlop={0}
                  accessibilityState={{ selected: on }}
                  style={{ flexGrow: 1, flexBasis: "45%", height: 84, paddingHorizontal: 8, borderWidth: 2, borderColor: on ? C.green : C.lineStrong, borderRadius: 16, backgroundColor: on ? C.greenBg : C.white, alignItems: "center", justifyContent: "center", gap: 3 }}
                >
                  <T s={15} w={700}>
                    {durLabel(pl.days)}
                  </T>
                  <T s={13} c={C.text}>
                    {formatETB(pl.price)}
                  </T>
                  {pct > 0 ? (
                    <T s={12} w={700} c={C.green}>
                      Save {pct}%
                    </T>
                  ) : null}
                </Tap>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <DateField
          label="Start date"
          value={start}
          min={minStart}
          onChange={(iso) => {
            if (iso < minStart) return;
            setStart(iso);
            if (book.err) book.clear();
          }}
        />
        <View style={{ gap: 8 }}>
          <T s={14} w={600}>
            Return by
          </T>
          <View accessibilityLiveRegion="polite" style={{ height: 52, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.greenBg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <T s={15} w={700}>
              {formatDay(addDaysISO(start || minStart, days))}
            </T>
            <T s={12} w={600} c={C.green}>
              We collect
            </T>
          </View>
        </View>
      </View>

      {addOnDefs.length > 0 ? (
        <View style={{ gap: 10 }}>
          <T s={14} w={600}>
            Add-ons{" "}
            <T s={14} c={C.muted}>
              · charged per day
            </T>
          </T>
          {addOnDefs.map((a) => {
            const on = !!addons[a.key];
            return (
              <Tap
                key={a.key}
                onPress={() => setAddons((prev) => ({ ...prev, [a.key]: !prev[a.key] }))}
                hitSlop={0}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                pressedStyle={{ opacity: 0.9 }}
                style={{ minHeight: 56, paddingVertical: 9, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1.5, borderColor: on ? C.green : C.lineStrong, borderRadius: 14, backgroundColor: on ? "#F4FAF5" : C.white }}
              >
                <Checkbox checked={on} />
                <View style={{ flex: 1, gap: 1 }}>
                  <T s={15} w={600}>
                    {a.label}
                  </T>
                  {a.note ? (
                    <T s={12} c={C.muted}>
                      {a.note}
                    </T>
                  ) : null}
                </View>
                <T s={14} w={700} c={C.green}>
                  +{formatETB(a.perDay)}/day
                </T>
              </Tap>
            );
          })}
        </View>
      ) : null}

      <View accessibilityLiveRegion="polite" style={{ backgroundColor: SOFT, borderRadius: 20, paddingVertical: 22, paddingHorizontal: 24, gap: 12 }}>
        <SummaryRow label={"Rental · " + durLabel(days)} value={formatETB(base)} />
        <SummaryRow label={"Add-ons (" + selected.length + ")"} value={formatETB(total - base)} />
        <SummaryRow label="Refundable deposit" value={formatETB(P.deposit || 0)} />
        <View style={{ height: 1, backgroundColor: C.lineStrong }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <T s={15} w={700}>
            Total
          </T>
          <H s={23.4} lh={28} ls={-0.702}>
            {formatETB(total)}
          </H>
        </View>
        <T s={13} c={C.muted} lh={17} style={{ marginTop: -6 }}>
          Plus the refundable deposit, returned after we collect the {P.name}.
        </T>
      </View>

      <Tap onPress={bookRental} disabled={book.busy} hitSlop={0} style={{ height: 58, borderRadius: 14, backgroundColor: C.green, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, opacity: book.busy ? 0.7 : 1 }}>
        <Icon xml={ICON.calendar} size={18} color={C.white} />
        <T s={16} w={700} c={C.white}>
          {(book.busy ? "Booking… · " : "Book rental · ") + formatETB(total)}
        </T>
      </Tap>
      {book.err ? <InlineError>{book.err}</InlineError> : null}
      <T s={13} c={C.muted} center style={{ marginTop: -10 }}>
        Free cancellation before delivery.
      </T>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <T s={15} c={C.text}>
        {label}
      </T>
      <T s={15} w={600}>
        {value}
      </T>
    </View>
  );
}

// ── Buying: price, variants, quantity, "Add to cart" / "Buy now" ──────────────

function BuyPanel({ product: P, warrantyNote }: { product: ProductDTO; warrantyNote: string }) {
  const variants = P.variants || [];
  const [variantKey, setVariantKey] = useState<string | null>(variants.length ? variants[0].key : null);
  const [qty, setQty] = useState(1);
  const [going, setGoing] = useState<"cart" | "checkout">("cart");
  const buy = useAction();

  // The chosen variant's extra is part of the unit price (and is sent to the cart by key).
  const variant = variants.find((v) => v.key === variantKey) || variants[0] || null;
  const unit = (P.buy || 0) + (variant ? variant.extra || 0 : 0);

  const add = (thenCheckout: boolean) => {
    setGoing(thenCheckout ? "checkout" : "cart");
    buy.run(async () => {
      const input: CartAddInput = { productId: P.id, mode: "buy", qty };
      if (variant) input.variant = variant.key;
      await cart.add(input);
      if (thenCheckout) navigate("/checkout");
    });
  };
  const addedToCart = buy.done && going === "cart";

  return (
    <View style={{ gap: 22 }}>
      <View style={{ gap: 4 }}>
        <H s={40} lh={40} ls={-1.6} c={C.navy} accessibilityLiveRegion="polite">
          {formatETB(unit)}
        </H>
        <T s={14} c={C.text} lh={18}>
          Free delivery on orders over {formatETB(FREE_DELIVERY_THRESHOLD)}
        </T>
      </View>

      {variants.length > 0 ? (
        <View style={{ gap: 12 }}>
          <GroupLabel color={C.navy}>Choose a set</GroupLabel>
          <View style={{ gap: 10 }}>
            {variants.map((v) => {
              const on = !!variant && v.key === variant.key;
              return (
                <Tap
                  key={v.key}
                  onPress={() => {
                    setVariantKey(v.key);
                    buy.clear();
                  }}
                  hitSlop={0}
                  accessibilityState={{ selected: on }}
                  style={{ height: 76, paddingHorizontal: 16, borderWidth: 2, borderColor: on ? C.blue : C.lineStrong, borderRadius: 16, backgroundColor: on ? C.sky : C.white, flexDirection: "row", alignItems: "center", gap: 14 }}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: C.skyDeep, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <ProductArt kind={P.kind} size={52} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T s={15} w={700}>
                      {v.label}
                    </T>
                    <T s={13} c={C.text}>
                      {v.extra ? "+" + formatETB(v.extra) : formatETB(P.buy || 0)}
                    </T>
                  </View>
                </Tap>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <T s={14} w={600}>
            Quantity
          </T>
          <QtyStepper value={qty} onChange={setQty} min={1} max={MAX_QTY} h={52} />
        </View>
        <View style={{ alignItems: "flex-end", flexShrink: 1 }}>
          <T s={13} c={C.text}>
            Subtotal
          </T>
          <T s={18} w={700} numberOfLines={1} adjustsFontSizeToFit>
            {formatETB(unit * qty)}
          </T>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Tap onPress={() => add(false)} disabled={buy.busy} hitSlop={0} style={{ flex: 1, height: 58, borderRadius: 14, backgroundColor: C.navy, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, opacity: buy.busy ? 0.7 : 1 }}>
          <Icon xml={addedToCart ? ICON.check : ICON.cart} size={18} color={C.white} />
          <T s={16} w={700} c={C.white}>
            {buy.busy && going === "cart" ? "Adding…" : addedToCart ? "Added" : "Add to cart"}
          </T>
        </Tap>
        <Tap onPress={() => add(true)} disabled={buy.busy} hitSlop={0} style={{ flex: 1.2, height: 58, borderRadius: 14, borderWidth: 1.5, borderColor: C.navy, alignItems: "center", justifyContent: "center", opacity: buy.busy ? 0.7 : 1 }}>
          <T s={16} w={700} c={C.navy}>
            {buy.busy && going === "checkout" ? "One moment…" : "Buy now"}
          </T>
        </Tap>
      </View>
      {buy.err ? <InlineError>{buy.err}</InlineError> : null}
      <T s={13} c={C.muted} center lh={17} style={{ marginTop: -10 }}>
        {warrantyNote}
      </T>
    </View>
  );
}

// ── Delivery estimator ────────────────────────────────────────────────────────

function DeliveryEstimator() {
  const store = storeVals(useShop());
  const [fulfil, setFulfil] = useState<"delivery" | "pickup">("delivery");
  const options = [
    { id: "delivery" as const, label: "Home delivery", sub: "Free over " + formatETB(FREE_DELIVERY_THRESHOLD) },
    { id: "pickup" as const, label: "Pick up", sub: store.name + ", " + store.address + " · free" },
  ];
  return (
    <View style={{ marginTop: 8, borderWidth: 1, borderColor: C.line, borderRadius: 24, padding: 24, gap: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.greenBg, alignItems: "center", justifyContent: "center" }}>
          <Icon xml={ICON.truck} size={22} color={C.green} sw={1.7} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <T s={16} w={700}>
            Deliver to {store.city}
          </T>
          <Countdown cutoffHour={store.sameDayCutoffHour} />
        </View>
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel="How to get it" style={{ gap: 12 }}>
        {options.map((o) => {
          const on = o.id === fulfil;
          return (
            <Tap
              key={o.id}
              onPress={() => setFulfil(o.id)}
              hitSlop={0}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              pressedStyle={{ opacity: 0.9 }}
              style={{ minHeight: 64, paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: on ? C.green : C.lineStrong, borderRadius: 16, backgroundColor: on ? "#F4FAF5" : C.white }}
            >
              <Radio checked={on} />
              <View style={{ flex: 1, gap: 2 }}>
                <T s={14} w={700}>
                  {o.label}
                </T>
                <T s={13} c={C.muted} lh={17}>
                  {o.sub}
                </T>
              </View>
            </Tap>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line }}>
        <Icon xml={ICON.returns} size={18} color={C.navy} sw={1.8} style={{ marginTop: 2 }} />
        <T s={14} lh={21} c={C.text} style={{ flex: 1 }}>
          <T s={14} w={700} lh={21}>
            Returns:
          </T>{" "}
          buying? Free returns within {plural(store.returnDays, "day")}. Renting? We collect it from your door on the return date.
        </T>
      </View>
    </View>
  );
}

/** "Order in the next 5h 12m for delivery today": time left until the store's same-day cut-off. */
function Countdown({ cutoffHour }: { cutoffHour: number }) {
  const now = new Date(useNow(15_000));
  let cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cutoffHour, 0, 0);
  let day = "today";
  if (now >= cutoff) {
    cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, cutoffHour, 0, 0);
    day = "tomorrow";
  }
  const left = Math.max(0, Math.floor((cutoff.getTime() - now.getTime()) / 60000));
  const minutes = left % 60;
  return (
    <T s={14} c={C.text} lh={18}>
      Order in the next{" "}
      <T s={14} w={700} c={C.green} style={{ fontVariant: ["tabular-nums"] }}>
        {Math.floor(left / 60)}h {(minutes < 10 ? "0" : "") + minutes}m
      </T>{" "}
      for delivery {day}
    </T>
  );
}

function Assurance({ icon, sw, bg, fg, title, sub, first }: { icon: string; sw: number; bg: string; fg: string; title: string; sub: string; first?: boolean }) {
  return (
    <View style={[{ paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }, !first && { borderTopWidth: 1, borderTopColor: C.line }]}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        <Icon xml={icon} size={20} color={fg} sw={sw} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T s={14} w={700}>
          {title}
        </T>
        <T s={12} c={C.muted}>
          {sub}
        </T>
      </View>
    </View>
  );
}
