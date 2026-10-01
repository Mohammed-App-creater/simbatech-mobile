/*
 * Cart: free-delivery progress, rentals and purchases (quantity, dates, save for later, remove),
 * saved items, deliver / pick up, the order summary with a promo code, and recommendations —
 * the website's cart page in its phone layout, driven by the session cart.
 */
import React, { useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { C, GUTTER } from "@/theme";
import { clearCatalogCache, listAddresses, listProducts } from "@/lib/catalog";
import { computeTotals, DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from "@/lib/pricing";
import { cart, formatETB, storeVals, useShop } from "@/lib/store";
import type { AddressDTO, CartDTO, CartLineDTO, ProductDTO } from "@/lib/types";
import { Screen } from "@/components/Screen";
import { Breadcrumbs, parseISO, QtyStepper } from "@/components/controls";
import { PayBadges, ProductArt } from "@/components/ProductArt";
import { ProductCard, productHref } from "@/components/ProductCard";
import { daysLabel, RentalDatesSheet } from "@/components/cart/RentalDatesSheet";
import { Btn, Field, H, Icon, ICON, LoadError, Loading, Note, Serif, T, Tap, useLoad } from "@/components/ui";
import { SectionHead } from "./HomeScreen";

const MAX_QTY = 20;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EMPTY_CART: CartDTO = { id: null, lines: [], saved: [], promo: null, totals: {}, count: 0 };

const dayLabel = (d: Date) => DOW[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()];
/** "Sat 3 Oct – Tue 6 Oct 2026" */
function rentalDates(l: CartLineDTO) {
  const a = parseISO(l.rentStart);
  const b = parseISO(l.rentEnd);
  return a && b ? dayLabel(a) + " – " + dayLabel(b) + " " + b.getFullYear() : "Dates to be confirmed";
}
/** 16 → "4pm", 9 → "9am" (the store's same-day cut-off hour) */
function hourLabel(h: number) {
  const n = Number(h);
  if (isNaN(n)) return String(h || "");
  return (n % 12 || 12) + (n < 12 || n === 24 ? "am" : "pm");
}
const variantOf = (l: CartLineDTO) => (l.variant && l.variant.label) || "";
const errMsg = (e: unknown): string => (e instanceof Error && e.message) || "Something went wrong. Please try again.";

type CartData = { recommendations: ProductDTO[]; defaultAddress: AddressDTO | null };
/** Runs a cart action for one line: its controls are disabled while pending and the error shows on it. */
type Act = (lineId: number, fn: () => Promise<unknown>) => void;
type LineProps = { line: CartLineDTO; busy: boolean; error: string; act: Act };

export default function CartScreen() {
  const shop = useShop();
  const { width } = useWindowDimensions();
  const userId = shop.user ? shop.user.id : 0;

  // What the website's page loader passes in: a fresh cart, 4 products that aren't in it, the default address.
  const load = async (): Promise<CartData> => {
    const [fresh, products, addresses] = await Promise.all([cart.reload(), listProducts(), userId ? listAddresses() : Promise.resolve([])]);
    const inCart = [...fresh.lines, ...fresh.saved].map((l) => l.product.id);
    return {
      recommendations: products.filter((p) => !inCart.includes(p.id) && !p.rentOnly).slice(0, 4),
      defaultAddress: addresses.find((a) => a.isDefault) || addresses[0] || null,
    };
  };
  const { data, error, loading, reload, setData } = useLoad<CartData>(load, [userId]);

  const [delivery, setDelivery] = useState<"deliver" | "pickup">("deliver");
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [actionError, setActionError] = useState<{ id: number | null; msg: string }>({ id: null, msg: "" });
  const [dates, setDates] = useState<{ line: CartLineDTO | null; open: boolean; n: number }>({ line: null, open: false, n: 0 });
  const pending = useRef(new Set<number>());

  const act: Act = (lineId, fn) => {
    if (pending.current.has(lineId)) return;
    pending.current.add(lineId);
    setBusy((b) => ({ ...b, [lineId]: true }));
    setActionError({ id: null, msg: "" });
    const done = (err?: unknown) => {
      pending.current.delete(lineId);
      setBusy((b) => {
        const next = { ...b };
        delete next[lineId];
        return next;
      });
      if (err) setActionError({ id: lineId, msg: errMsg(err) });
    };
    fn().then(() => done(), done);
  };

  const c = shop.cart || EMPTY_CART;
  const lines = c.lines || [];
  const saved = c.saved || [];
  const rentals = lines.filter((l) => l.mode === "rent");
  const buys = lines.filter((l) => l.mode === "buy");
  const hasAnything = lines.length + saved.length > 0;
  const canCheckout = lines.length > 0;

  const store = storeVals(shop);
  const storeAddr = store.address + (String(store.address).indexOf(store.city) < 0 ? ", " + store.city : "");
  const defAddr = data && data.defaultAddress && data.defaultAddress.line1 ? data.defaultAddress : null;
  const defAddrText = defAddr ? [defAddr.line1, defAddr.area, defAddr.city].filter(Boolean).join(", ") : "";

  // Totals: the API's sub-totals, with the delivery fee previewed for the chosen option.
  const pickup = delivery === "pickup";
  const base = { purchases: c.totals.purchases || 0, rentals: c.totals.rentals || 0, deposit: c.totals.deposit || 0, percentOff: c.promo ? c.promo.percentOff : 0 };
  const t = computeTotals({ ...base, pickup });
  const deliverT = pickup ? computeTotals(base) : t;
  const goods = t.purchases - t.discount;
  const unlocked = t.purchases > 0 && t.freeDeliveryRemaining === 0;
  const pct = Math.min(100, Math.round((Math.max(0, goods) / FREE_DELIVERY_THRESHOLD) * 100));
  const buyUnits = buys.reduce((n, l) => n + l.qty, 0);
  const rentDays = rentals.reduce((n, l) => n + (l.rentDays || 0), 0);
  const checkoutHref = pickup ? "/checkout?fulfilment=pickup" : "/checkout";

  const deliveryOpts = [
    {
      id: "deliver" as const,
      title: "Deliver to me",
      fee: deliverT.deliveryFee === 0 ? "Free" : formatETB(DELIVERY_FEE),
      line1: (defAddr ? "To " + defAddrText + "." : "Anywhere in " + store.city + ".") + " Pick a delivery slot at checkout.",
      line2: "Same-day available before " + hourLabel(store.sameDayCutoffHour),
    },
    {
      id: "pickup" as const,
      title: "Pick up in store",
      fee: "Free",
      line1: store.name + " store, " + storeAddr + ".",
      line2: "Ready in " + store.pickupReadyHours + " hours · we will text you",
    },
  ];

  const applyPromo = () => {
    if (promoBusy) return;
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      setPromoError("Enter a promo code first.");
      return;
    }
    setPromoBusy(true);
    setPromoError("");
    cart.applyPromo(code).then(
      () => {
        setPromoBusy(false);
        setPromoInput("");
      },
      (err) => {
        setPromoBusy(false);
        setPromoError(errMsg(err));
      },
    );
  };
  const removePromo = () => {
    if (promoBusy) return;
    setPromoBusy(true);
    setPromoError("");
    cart.removePromo().then(
      () => setPromoBusy(false),
      (err) => {
        setPromoBusy(false);
        setActionError({ id: null, msg: errMsg(err) });
      },
    );
  };

  const lineProps = (l: CartLineDTO): LineProps => ({ line: l, busy: !!busy[l.id], error: actionError.id === l.id ? actionError.msg : "", act });
  // errors that don't belong to a line still on the page show under the groups
  const onPage = actionError.id != null && [...lines, ...saved].some((l) => l.id === actionError.id);
  const cardW = (width - GUTTER * 2 - 12) / 2;

  return (
    <Screen
      onRefresh={async () => {
        clearCatalogCache();
        try {
          setData(await load());
          setActionError({ id: null, msg: "" });
        } catch (e) {
          setActionError({ id: null, msg: errMsg(e) });
        }
      }}
    >
      {!data ? (
        loading ? (
          <Loading />
        ) : (
          <LoadError message={error} onRetry={reload} />
        )
      ) : (
        <>
          <Breadcrumbs separator="slash" items={[{ label: "Home", href: "/" }, { label: "Cart" }]} style={{ paddingTop: 26 }} />
          <View style={{ paddingHorizontal: GUTTER, paddingTop: 2, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", columnGap: 16 }}>
            <H s={48} lh={52} ls={-2.16} accessibilityRole="header">
              Your cart{" "}
              <Serif c={C.navy} ls={-0.96}>
                ({lines.length})
              </Serif>
            </H>
            <Tap href="/" style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon xml={ICON.arrowLeft} size={16} color={C.navy} />
              <T s={15} w={600} c={C.navy}>
                Continue shopping
              </T>
            </Tap>
          </View>

          {hasAnything ? (
            <>
              {/* progress to free delivery */}
              <View style={{ paddingHorizontal: GUTTER, paddingTop: 20 }}>
                <View style={{ paddingVertical: 20, paddingHorizontal: 24, borderWidth: 1, borderColor: C.line, borderRadius: 24, backgroundColor: C.white, flexDirection: "row", alignItems: "center", gap: 20 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: unlocked ? C.greenBg : C.sky, alignItems: "center", justifyContent: "center" }}>
                    <Icon xml={ICON.truck} size={22} sw={1.7} color={unlocked ? C.green : C.navy} />
                  </View>
                  <View style={{ flex: 1, gap: 10 }}>
                    <View style={{ gap: 3 }}>
                      <T s={16} w={700} lh={21} accessibilityLiveRegion="polite">
                        {unlocked ? "You have unlocked free delivery" : "You’re " + formatETB(t.freeDeliveryRemaining) + " away from free delivery"}
                      </T>
                      <T s={13} c={C.muted} lh={17}>
                        Free delivery on purchases over {formatETB(FREE_DELIVERY_THRESHOLD)}
                      </T>
                    </View>
                    <View accessibilityRole="progressbar" accessibilityLabel="Progress to free delivery" accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ height: 10, borderRadius: 999, backgroundColor: "#F1EEE8", overflow: "hidden" }}>
                      <View style={{ height: 10, width: `${pct}%`, borderRadius: 999, backgroundColor: unlocked ? "#418D4D" : C.blue }} />
                    </View>
                  </View>
                </View>
              </View>

              <View style={{ paddingHorizontal: GUTTER, paddingTop: 24, gap: 20 }}>
                {rentals.length ? (
                  <Group tone="rent" title="Rentals" tail="— returned to us" note="We deliver it, then collect it on the return date">
                    {rentals.map((l) => (
                      <RentalLine key={l.id} {...lineProps(l)} onChangeDates={() => setDates((d) => ({ line: l, open: true, n: d.n + 1 }))} />
                    ))}
                  </Group>
                ) : null}
                {buys.length ? (
                  <Group tone="buy" title="Purchases" tail="— yours to keep" note="Genuine, with warranty">
                    {buys.map((l) => (
                      <PurchaseLine key={l.id} {...lineProps(l)} />
                    ))}
                  </Group>
                ) : null}

                {saved.length ? (
                  <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: "#D5D3CC", borderRadius: 28, paddingVertical: 18, paddingHorizontal: 24, gap: 14 }}>
                    <T s={13} w={700} c={C.navy} ls={1.3} upper>
                      Saved for later ({saved.length})
                    </T>
                    {saved.map((l) => (
                      <SavedLine key={l.id} {...lineProps(l)} />
                    ))}
                  </View>
                ) : null}

                {actionError.msg && !onPage ? <Note>{actionError.msg}</Note> : null}

                {/* deliver or pick up: carried to checkout */}
                <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 28, padding: 24, gap: 16 }}>
                  <H s={22} lh={26} ls={-0.66} accessibilityRole="header">
                    How do you want it?
                  </H>
                  <View style={{ gap: 14 }} accessibilityRole="radiogroup">
                    {deliveryOpts.map((d) => {
                      const on = delivery === d.id;
                      return (
                        <Tap
                          key={d.id}
                          onPress={() => setDelivery(d.id)}
                          hitSlop={0}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on }}
                          pressedStyle={{ opacity: 0.9 }}
                          style={{ minHeight: 112, padding: 18, flexDirection: "row", alignItems: "flex-start", gap: 14, borderWidth: 2, borderColor: on ? C.navy : C.line, borderRadius: 20, backgroundColor: on ? C.sky : C.white }}
                        >
                          <View style={{ width: 22, height: 22, marginTop: 2, borderRadius: 999, borderWidth: 2, borderColor: on ? C.navy : "#B4B8BF", alignItems: "center", justifyContent: "center" }}>
                            {on ? <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: C.navy }} /> : null}
                          </View>
                          <View style={{ flex: 1, gap: 4 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                              <T s={16} w={700} style={{ flexShrink: 1 }}>
                                {d.title}
                              </T>
                              <T s={14} w={700} c={d.fee === "Free" ? C.green : C.ink}>
                                {d.fee}
                              </T>
                            </View>
                            <T s={14} lh={20.3} c={C.text}>
                              {d.line1}
                            </T>
                            <T s={13} c={C.muted}>
                              {d.line2}
                            </T>
                          </View>
                        </Tap>
                      );
                    })}
                  </View>
                  <T s={13} c={C.muted} lh={17}>
                    {pickup
                      ? "Rentals picked up in store go back to the same store during opening hours (" + store.hours + ") on the return date."
                      : "Rentals are always delivered and collected by us, whatever you choose for purchases."}
                  </T>
                </View>
              </View>

              {/* order summary */}
              <View style={{ paddingHorizontal: GUTTER, paddingTop: 24 }}>
                <View accessibilityLabel="Order summary" style={{ borderWidth: 1, borderColor: C.line, borderRadius: 28, padding: 28, gap: 18, backgroundColor: C.white, boxShadow: "0 24px 60px -32px rgba(13,79,139,0.35)" }}>
                  <H s={26} lh={31} ls={-0.91} accessibilityRole="header">
                    Order summary
                  </H>
                  <View style={{ gap: 12 }}>
                    <SumRow label={"Purchases (" + buyUnits + (buyUnits === 1 ? " item)" : " items)")} value={formatETB(t.purchases)} />
                    {c.promo ? <SumRow label={c.promo.code + " · " + c.promo.percentOff + "% off purchases"} value={"−" + formatETB(t.discount)} green /> : null}
                    <SumRow label={"Rentals (" + rentals.length + (rentals.length === 1 ? " item" : " items") + " · " + daysLabel(rentDays) + ")"} value={formatETB(t.rentals)} />
                    <SumRow label="Delivery" value={t.deliveryFee === 0 ? "Free" : formatETB(t.deliveryFee)} valueColor={t.deliveryFee === 0 ? C.green : C.ink} />
                    <SumRow label="Refundable deposit" chip="Rental" value={formatETB(t.deposit)} />
                  </View>

                  <View style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line, gap: 8 }}>
                    {c.promo ? (
                      <View style={{ height: 48, paddingLeft: 14, paddingRight: 6, borderRadius: 12, backgroundColor: C.greenBg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
                          <Icon xml={ICON.check} size={16} sw={2.2} color={C.greenDark} />
                          <T s={14} w={600} c={C.greenDark} numberOfLines={1} style={{ flexShrink: 1 }}>
                            {c.promo.code} applied
                          </T>
                        </View>
                        <Tap onPress={removePromo} disabled={promoBusy} label="Remove promo code" style={{ height: 44, paddingHorizontal: 10, justifyContent: "center", opacity: promoBusy ? 0.5 : 1 }}>
                          <T s={13} w={700} c={C.greenDark} style={{ textDecorationLine: "underline" }}>
                            Remove
                          </T>
                        </Tap>
                      </View>
                    ) : (
                      <>
                        <T s={14} w={600}>
                          Promo code
                        </T>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Field
                            value={promoInput}
                            onChangeText={(v) => {
                              setPromoInput(v.toUpperCase());
                              setPromoError("");
                            }}
                            onSubmitEditing={applyPromo}
                            placeholder="Enter code"
                            accessibilityLabel="Promo code"
                            autoCapitalize="characters"
                            autoCorrect={false}
                            autoComplete="off"
                            returnKeyType="done"
                            h={48}
                            containerStyle={{ flex: 1 }}
                            boxStyle={promoError ? { borderColor: C.red } : null}
                          />
                          <Btn title="Apply" variant="navy" h={48} r={12} s={14} px={18} onPress={applyPromo} disabled={promoBusy} />
                        </View>
                        <View style={{ minHeight: 18 }}>
                          <Note>{promoError}</Note>
                        </View>
                      </>
                    )}
                  </View>

                  <View style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ gap: 2, flex: 1 }}>
                      <T s={16} w={700}>
                        Total
                      </T>
                      <T s={12} c={C.muted}>
                        + {formatETB(t.deposit)} refundable deposit
                      </T>
                    </View>
                    <H s={24} lh={28} ls={-0.84} numberOfLines={1} accessibilityLiveRegion="polite">
                      {formatETB(t.total)}
                    </H>
                  </View>
                  <Btn title="Checkout securely" iconLeft={ICON.lock} h={56} s={16} full href={canCheckout ? checkoutHref : undefined} disabled={!canCheckout} style={!canCheckout ? { opacity: 0.5 } : null} />
                  <View style={{ alignItems: "center", gap: 10 }}>
                    <T s={12} c={C.muted}>
                      We accept
                    </T>
                    <PayBadges style={{ justifyContent: "center" }} />
                  </View>
                </View>
              </View>
            </>
          ) : (
            <EmptyCart />
          )}

          {data.recommendations.length ? (
            <View style={{ paddingHorizontal: GUTTER, paddingTop: 48, gap: 32 }}>
              <SectionHead eyebrow="Goes well with your cart" title="You might also need" link={{ label: "See more", href: "/shop" }} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {data.recommendations.map((p) => (
                  <ProductCard key={p.id} product={p} style={{ width: cardW }} />
                ))}
              </View>
            </View>
          ) : null}

          {dates.line ? <RentalDatesSheet key={dates.n} line={dates.line} open={dates.open} onClose={() => setDates((d) => ({ ...d, open: false }))} /> : null}
        </>
      )}
    </Screen>
  );
}

// ── Groups and lines ──────────────────────────────────────────────────────────

/** A bordered card with a tinted header: "Rentals — returned to us" / "Purchases — yours to keep". */
function Group({ tone, title, tail, note, children }: { tone: "rent" | "buy"; title: string; tail: string; note: string; children: React.ReactNode }) {
  const rent = tone === "rent";
  return (
    <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 28, overflow: "hidden", backgroundColor: C.white }}>
      <View style={{ paddingVertical: 18, paddingHorizontal: 24, backgroundColor: rent ? C.greenBg : C.sky, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: rent ? C.green : C.navy, alignItems: "center", justifyContent: "center" }}>
            <Icon xml={rent ? ICON.calendar : ICON.cart} size={18} sw={rent ? 2 : 1.8} color={C.white} />
          </View>
          {/* 20px (the site's 22px breaks "Purchases — yours to keep" at this width) */}
          <H s={20} lh={24} ls={-0.6} c={rent ? C.greenDark : C.navy} accessibilityRole="header" style={{ flex: 1 }}>
            {title}{" "}
            <H s={20} lh={24} ls={-0.6} w={500} c={rent ? C.green : C.navySoft}>
              {tail}
            </H>
          </H>
        </View>
        <T s={13} w={500} c={rent ? C.greenDark : C.navy}>
          {note}
        </T>
      </View>
      {children}
    </View>
  );
}

/** The product's artwork on its colour tile, linking to the product. */
function ArtTile({ product: p, size }: { product: ProductDTO; size: number }) {
  const art = Math.round(size * 1.1);
  return (
    <Tap href={productHref(p)} label={p.name} hitSlop={0} style={{ width: size, height: size, borderRadius: size / 4, backgroundColor: p.bg, overflow: "hidden" }}>
      <ProductArt kind={p.kind} size={art} style={{ position: "absolute", left: (size - art) / 2, top: (size - art) / 2 }} />
    </Tap>
  );
}

function LineFrame({ line, busy, error, children }: { line: CartLineDTO; busy: boolean; error: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingVertical: 20, paddingHorizontal: 24, gap: 16, borderTopWidth: 1, borderTopColor: C.line, opacity: busy ? 0.55 : 1 }} accessibilityState={{ busy }}>
      <ArtTile product={line.product} size={88} />
      {children}
      <Note>{error}</Note>
    </View>
  );
}

function ProductName({ line }: { line: CartLineDTO }) {
  const variant = variantOf(line);
  return (
    <>
      <Tap href={productHref(line.product)} hitSlop={0}>
        <T s={18} w={700} lh={23} ls={-0.27}>
          {line.product.name}
        </T>
      </Tap>
      {variant ? (
        <T s={12} c={C.muted}>
          {variant}
        </T>
      ) : null}
    </>
  );
}

function RemoveButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Tap onPress={onPress} disabled={disabled} label={label} hitSlop={0} style={{ height: 44, paddingHorizontal: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Icon xml={ICON.trash} size={15} color={C.muted} />
      <T s={13} w={600} c={C.muted}>
        Remove
      </T>
    </Tap>
  );
}

function RentalLine({ line: l, busy, error, act, onChangeDates }: LineProps & { onChangeDates: () => void }) {
  const p = l.product;
  const days = l.rentDays || 0;
  return (
    <LineFrame line={l} busy={busy} error={error}>
      <View style={{ gap: 8 }}>
        <View style={{ alignSelf: "flex-start", height: 24, paddingHorizontal: 10, borderRadius: 999, backgroundColor: C.greenBg, justifyContent: "center" }}>
          <T s={12} w={700} c={C.green}>
            Rental · {daysLabel(days)}
          </T>
        </View>
        <ProductName line={l} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon xml={ICON.calendar} size={16} color={C.green} />
            <T s={14} c={C.text}>
              {rentalDates(l)}
            </T>
          </View>
          <Tap onPress={onChangeDates} disabled={busy} label={"Change dates for " + p.name} style={{ height: 32, justifyContent: "center" }}>
            <T s={14} w={600} c={C.green} style={{ textDecorationLine: "underline" }}>
              Change dates
            </T>
          </Tap>
        </View>
        <T s={13} c={C.muted} lh={17}>
          Refundable deposit {formatETB(l.deposit)} · held until it&apos;s back with us
        </T>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, flexShrink: 1 }}>
          <T s={20} w={700}>
            {formatETB(l.lineTotal)}
          </T>
          <T s={12} c={C.muted}>
            for {daysLabel(days)}
          </T>
        </View>
        <RemoveButton label={"Remove " + p.name + " rental"} disabled={busy} onPress={() => act(l.id, () => cart.remove(l.id))} />
      </View>
    </LineFrame>
  );
}

function PurchaseLine({ line: l, busy, error, act }: LineProps) {
  const p = l.product;
  return (
    <LineFrame line={l} busy={busy} error={error}>
      <View style={{ gap: 8 }}>
        <T s={12} c={C.muted}>
          {p.cat}
        </T>
        <ProductName line={l} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 4 }}>
          <T s={14} w={600} c={p.was ? C.red : C.text}>
            {formatETB(l.unitPrice)} each
          </T>
          {p.was ? (
            <>
              <T s={13} c={C.muted} style={{ textDecorationLine: "line-through" }}>
                {formatETB(p.was)}
              </T>
              <View style={{ height: 22, paddingHorizontal: 8, borderRadius: 6, backgroundColor: C.red, justifyContent: "center" }}>
                <T s={11} w={700} c={C.white}>
                  Sale
                </T>
              </View>
            </>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 2 }}>
          <Tap onPress={() => act(l.id, () => cart.update(l.id, { savedForLater: true }))} disabled={busy} hitSlop={0} style={{ height: 44, paddingRight: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon xml={ICON.heart} size={15} sw={1.9} color={C.navy} />
            <T s={13} w={600} c={C.navy}>
              Save for later
            </T>
          </Tap>
          <T s={16} c="#D5D3CC">
            |
          </T>
          <RemoveButton label={"Remove " + p.name} disabled={busy} onPress={() => act(l.id, () => cart.remove(l.id))} />
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <T s={20} w={700} accessibilityLiveRegion="polite">
          {formatETB(l.lineTotal)}
        </T>
        <View accessibilityLabel={"Quantity for " + p.name}>
          <QtyStepper value={l.qty} min={1} max={MAX_QTY} disabled={busy} onChange={(qty) => act(l.id, () => cart.update(l.id, { qty }))} />
        </View>
      </View>
    </LineFrame>
  );
}

function SavedLine({ line: l, busy, error, act }: LineProps) {
  const p = l.product;
  const variant = variantOf(l);
  return (
    <View style={{ gap: 8, opacity: busy ? 0.55 : 1 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
        <ArtTile product={p} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <T s={15} w={700} lh={20}>
            {p.name}
          </T>
          <T s={13} c={C.muted}>
            {(variant ? variant + " · " : "") + (l.mode === "rent" ? formatETB(l.lineTotal) + " · rental" : formatETB(l.unitPrice))}
          </T>
          <Tap
            onPress={() => act(l.id, () => cart.update(l.id, { savedForLater: false }))}
            disabled={busy}
            hitSlop={0}
            style={{ alignSelf: "flex-start", marginTop: 8, height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: C.navy, justifyContent: "center" }}
          >
            <T s={13} w={700} c={C.white}>
              Move to cart
            </T>
          </Tap>
        </View>
        <Tap onPress={() => act(l.id, () => cart.remove(l.id))} disabled={busy} label={"Delete " + p.name + " from saved"} hitSlop={0} style={{ width: 44, height: 44, marginTop: -10, marginRight: -12, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
          <Icon xml={ICON.close} size={16} sw={2.2} color={C.muted} />
        </Tap>
      </View>
      <Note>{error}</Note>
    </View>
  );
}

// ── Summary row, empty state ──────────────────────────────────────────────────

function SumRow({ label, value, chip, green, valueColor = C.ink }: { label: string; value: string; chip?: string; green?: boolean; valueColor?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
        <T s={15} w={green ? 600 : 400} c={green ? C.green : C.text} style={{ flexShrink: 1 }}>
          {label}
        </T>
        {chip ? (
          <View style={{ height: 20, paddingHorizontal: 7, borderRadius: 999, backgroundColor: C.greenBg, justifyContent: "center" }}>
            <T s={11} w={700} c={C.green}>
              {chip}
            </T>
          </View>
        ) : null}
      </View>
      <T s={15} w={green ? 700 : 600} c={green ? C.green : valueColor}>
        {value}
      </T>
    </View>
  );
}

function EmptyCart() {
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: 20 }}>
      <View style={{ borderRadius: 32, backgroundColor: "#F6F5F1", overflow: "hidden", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 }}>
        <View style={{ position: "absolute", right: -44, top: -56, width: 240, height: 240, borderRadius: 999, backgroundColor: C.sky }} />
        <ProductArt kind="blocks" size={150} style={{ alignSelf: "flex-end", marginRight: 12 }} />
        <View style={{ gap: 18, marginTop: 4 }}>
          <T s={13} w={700} c={C.navy} ls={1.3} upper>
            Nothing here yet
          </T>
          <H s={29.25} lh={32} ls={-1.17} accessibilityRole="header">
            Your cart is empty. <Serif c={C.green}>Let&apos;s fix that.</Serif>
          </H>
          <T s={17} lh={26.35} c={C.text}>
            Buy something to keep, or rent it for just the days you need it.
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingTop: 6 }}>
            <Btn title="Start shopping" variant="navy" icon={ICON.arrowRight} px={16} href="/shop" />
            <Btn title="Browse rentals" variant="outlineGreen" w={600} px={16} href="/shop?mode=rent" />
          </View>
        </View>
      </View>
    </View>
  );
}
