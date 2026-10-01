/*
 * Checkout: contact, delivery address (saved or new) or pick-up, delivery day and time window,
 * the rental schedule, payment method (Telebirr, card, pay on delivery), terms, and the order
 * summary with live totals. Guests can check out. The website's checkout page in its phone layout.
 */
import React, { useRef, useState } from "react";
import { ActivityIndicator, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { C, GUTTER } from "@/theme";
import { listAddresses, listPaymentMethods } from "@/lib/catalog";
import { readDeliverArea, useDeliverArea } from "@/lib/deliver-area";
import { isCompletePhone } from "@/lib/phone";
import { computeTotals, DAY_MS, FREE_DELIVERY_THRESHOLD, SAME_DAY_FEE, shopToday } from "@/lib/pricing";
import { finishCheckout, formatETB as fmt, navigate, placeOrder, shopState, storeVals, useShop } from "@/lib/store";
import type { AddressDTO, CartDTO, PaymentMethodDTO, UserDTO } from "@/lib/types";
import { Screen, useScreenScroll } from "@/components/Screen";
import { CheckoutHeader, type CheckoutStep } from "@/components/CheckoutHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PayBadges, PayLogo, ProductArt } from "@/components/ProductArt";
import { Checkbox } from "@/components/controls";
import { Eyebrow, Field, H, Icon, ICON, LoadError, Loading, PhoneField, T, Tap, useLoad } from "@/components/ui";
import { Card, OrderLine, SOFT, SUMMARY_SHADOW, SumRow, TotalRow } from "@/components/checkout/parts";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WINDOWS = [
  { id: "w1", label: "9am – 12pm" },
  { id: "w2", label: "12pm – 3pm" },
  { id: "w3", label: "3pm – 6pm" },
  { id: "w4", label: "6pm – 8pm" },
];
type PayId = "telebirr" | "card" | "cod";
const PAYS: { id: PayId; title: string; sub: string; logos?: string[]; chip?: string }[] = [
  { id: "telebirr", title: "Telebirr", sub: "Pay instantly from your phone", logos: ["telebirr"] },
  { id: "card", title: "Debit or credit card", sub: "Visa or Mastercard", logos: ["visa", "mastercard"] },
  { id: "cod", title: "Pay on delivery", sub: "Telebirr or card at your door", chip: "ON DELIVERY" },
];
const BLUE = C.navy;
const GREEN = C.green;
const GREY = "#B4B8BF";
const IDLE_LINE = "#D5D3CC";
const FIELD_BOX = { paddingHorizontal: 16 };

const digits = (v: string, max: number) => String(v || "").replace(/\D/g, "").slice(0, max);
// Dates are handled as UTC midnights of yyyy-mm-dd strings, so labels don't depend on the phone's time zone.
const isoDate = (iso: string) => new Date(String(iso).slice(0, 10) + "T00:00:00Z");
const addDays = (iso: string, n: number) => new Date(isoDate(iso).getTime() + n * DAY_MS).toISOString().slice(0, 10);
const dayMonth = (iso: string) => isoDate(iso).getUTCDate() + " " + MON[isoDate(iso).getUTCMonth()];
const dow = (iso: string) => DOW[isoDate(iso).getUTCDay()];
const longDate = (iso: string) => dow(iso) + " " + dayMonth(iso) + " " + isoDate(iso).getUTCFullYear();
// 16 -> "4pm", 9 -> "9am" (the store's same-day cut-off hour)
function hourLabel(h: number) {
  const n = Number(h);
  if (isNaN(n)) return String(h || "");
  return (n % 12 || 12) + (n < 12 || n === 24 ? "am" : "pm");
}
// Saved card chip label: "Visa •••• 4242 · 12/28"
const cardLabel = (m: PaymentMethodDTO) => [m.brand, "••••", m.last4].filter(Boolean).join(" ") + (m.expiry ? " · " + m.expiry : "");
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Field paths the checkout API reports ({ error, field }) -> the form field that shows the message.
type Slot = "name" | "phone" | "email" | "newLine" | "newArea" | "newCity" | "telebirr" | "cardNo";
const FIELD_SLOTS: Record<string, Slot> = {
  "contact.name": "name",
  "contact.phone": "phone",
  "contact.email": "email",
  "newAddress.line1": "newLine",
  "newAddress.area": "newArea",
  "newAddress.city": "newCity",
  "payment.phone": "telebirr",
  "payment.cardLast4": "cardNo",
};
// Which section holds each field (the page scrolls there when the API rejects it).
type SectionId = "contact" | "address" | "payment" | "terms";
const SLOT_SECTION: Record<Slot, SectionId> = { name: "contact", phone: "contact", email: "contact", newLine: "address", newArea: "address", newCity: "address", telebirr: "payment", cardNo: "payment" };

type Saved = { userId: number | null; addresses: AddressDTO[]; paymentMethods: PaymentMethodDTO[] };
type DayId = "today" | "tomorrow" | "date";
type Form = {
  name: string;
  phone: string;
  email: string;
  addr: number | "new";
  newLine: string;
  newArea: string;
  newCity: string;
  day: DayId;
  date: string;
  win: string;
  pay: PayId;
  telebirr: string;
  /** id of the saved card chip in use (null = a new card typed below) */
  savedCard: number | null;
  cardNo: string;
  cardExp: string;
  cardCvc: string;
  billingSame: boolean;
  billAddr: string;
  terms: boolean;
  termsError: string;
  /** field -> message from the API */
  errors: Partial<Record<Slot, string>>;
  orderError: string;
};
type TextKey = "name" | "phone" | "email" | "newLine" | "newArea" | "newCity" | "telebirr" | "cardNo" | "cardExp" | "cardCvc" | "billAddr";

function initialForm(user: UserDTO | null, saved: Saved): Form {
  const def = saved.addresses.find((a) => a.isDefault) || saved.addresses[0];
  // the default saved Telebirr number prefills the phone field
  const telebirrs = saved.paymentMethods.filter((m) => m.kind === "telebirr" && m.phone);
  const defTelebirr = telebirrs.find((m) => m.isDefault) || telebirrs[0];
  return {
    name: user ? user.name || "" : "",
    phone: user ? user.phone || "" : "",
    email: user ? user.email || "" : "",
    addr: def ? def.id : "new",
    newLine: "",
    // the sub-city picked in the header's "Deliver to" prefills a new address's area
    newArea: readDeliverArea(),
    newCity: "",
    day: "tomorrow",
    date: "",
    win: "w2",
    pay: "telebirr",
    telebirr: defTelebirr ? defTelebirr.phone || "" : user ? user.phone || "" : "",
    savedCard: null,
    cardNo: "",
    cardExp: "",
    cardCvc: "",
    billingSame: true,
    billAddr: "",
    terms: false,
    termsError: "",
    errors: {},
    orderError: "",
  };
}

const START_STEPS: CheckoutStep[] = ["Details", "Delivery", "Payment"].map((label, i) => ({ label, done: false, current: i === 0 }));

export default function CheckoutScreen() {
  const shop = useShop();
  const userId = shop.user ? shop.user.id : null;
  // true from "Place order" until the app leaves this page, so the emptied cart doesn't bounce the customer to /cart
  const [placing, setPlacing] = useState(false);
  const { data, error, loading, reload } = useLoad(async (): Promise<Saved | null> => {
    const s = shopState();
    if (!s.ready) return null;
    if (!s.user) return { userId: null, addresses: [], paymentMethods: [] };
    const [addresses, paymentMethods] = await Promise.all([listAddresses(), listPaymentMethods()]);
    return { userId: s.user.id, addresses, paymentMethods };
  }, [shop.ready, userId]);

  const hasLines = !!shop.cart && shop.cart.lines.length > 0;
  if (shop.ready && !hasLines && !placing) return <Redirect href="/cart" />;
  const saved = data && data.userId === userId ? data : null;

  return (
    <Screen header={false} footer={false} bg={SOFT}>
      {saved ? (
        <CheckoutBody key={String(userId)} saved={saved} placing={placing} setPlacing={setPlacing} />
      ) : (
        <>
          <CheckoutHeader steps={START_STEPS} />
          {error && !loading && shop.ready ? <LoadError message={error} onRetry={reload} /> : <Loading />}
        </>
      )}
    </Screen>
  );
}

function CheckoutBody({ saved, placing, setPlacing }: { saved: Saved; placing: boolean; setPlacing: (v: boolean) => void }) {
  const shop = useShop();
  const store = storeVals(shop);
  const params = useLocalSearchParams<{ fulfilment?: string | string[] }>();
  const { scrollTo } = useScreenScroll();
  const { width } = useWindowDimensions();
  const deliverArea = useDeliverArea();
  const [s, setS] = useState<Form>(() => initialForm(shop.user, saved));
  const [frozenCart, setFrozenCart] = useState<CartDTO | null>(null);
  const tops = useRef<Record<string, number>>({});

  const patch = (p: Partial<Form>) => setS((prev) => ({ ...prev, ...p }));
  // typing in a field clears the API's message for it
  const setField = (k: TextKey, format?: (v: string) => string) => (v: string) =>
    setS((prev) => {
      const next = { ...prev, [k]: format ? format(v) : v };
      if (prev.errors[k as Slot]) {
        const errors = { ...prev.errors };
        delete errors[k as Slot];
        next.errors = errors;
      }
      return next;
    });
  // the saved "Deliver to" area can arrive after the first render (it is read from storage at start-up)
  const [seenArea, setSeenArea] = useState(deliverArea);
  if (deliverArea !== seenArea) {
    setSeenArea(deliverArea);
    if (deliverArea && !s.newArea) setS({ ...s, newArea: deliverArea });
  }

  // where each section starts, for scrolling to a field the API rejected
  const mark = (id: string, e: LayoutChangeEvent) => {
    tops.current[id] = e.nativeEvent.layout.y;
  };
  const reveal = (id: SectionId) => scrollTo(Math.max(0, (tops.current.main || 0) + (tops.current.grid || 0) + (tops.current[id] || 0) - 12));

  const errors = s.errors;
  const savedCards = saved.paymentMethods.filter((m) => m.kind === "card" && m.last4);
  const savedCard = savedCards.find((m) => m.id === s.savedCard) || null;

  // Cart (frozen while the order is being placed, so the summary doesn't empty before the app navigates)
  const c = (placing && frozenCart) || shop.cart || { lines: [], promo: null, totals: {} as Record<string, number> };
  const cartLines = c.lines || [];
  const rentalLines = cartLines.filter((l) => l.mode === "rent");

  // Dates from the shop's "today" (Addis Ababa), the same day the API uses for same-day delivery
  const todayIso = shopToday();
  const tomorrowIso = addDays(todayIso, 1);
  const DAYS: { id: DayId; label: string; sub: string }[] = [
    { id: "today", label: "Today", sub: dow(todayIso) + " " + dayMonth(todayIso) },
    { id: "tomorrow", label: "Tomorrow", sub: dow(tomorrowIso) + " " + dayMonth(tomorrowIso) },
    { id: "date", label: "Pick a date", sub: "" },
  ];
  // Next five delivery days after tomorrow (no deliveries on Sundays).
  const DATES: { id: string; dow: string; day: string }[] = [];
  for (let n = 2; DATES.length < 5 && n < 14; n++) {
    const iso = addDays(todayIso, n);
    if (isoDate(iso).getUTCDay() !== 0) DATES.push({ id: iso, dow: dow(iso), day: dayMonth(iso) });
  }
  const selDate = s.date || DATES[0].id;

  // Completion
  const contactDone = s.name.trim().length > 1 && isCompletePhone(s.phone) && /.+@.+\..+/.test(s.email);
  const addrs = saved.addresses;
  const isNew = s.addr === "new" || addrs.length === 0;
  // Pick-up (from /checkout?fulfilment=pickup) only applies to purchase-only carts: rentals are always delivered and collected.
  const pickupAsked = one(params.fulfilment) === "pickup";
  const pickup = pickupAsked && rentalLines.length === 0;
  const addrDone = !isNew || !!(s.newLine.trim() && s.newCity.trim());
  const isToday = s.day === "today";
  const slotDone = !!s.win && !(isToday && s.win === "w1");
  const payValid =
    s.pay === "cod" ||
    (s.pay === "telebirr" && isCompletePhone(s.telebirr)) ||
    (s.pay === "card" && (!!savedCard || (digits(s.cardNo, 19).length >= 15 && digits(s.cardExp, 4).length === 4 && digits(s.cardCvc, 4).length >= 3)));
  const billingOk = s.billingSame || !!s.billAddr.trim();
  const flags = [contactDone, pickup || (addrDone && slotDone), payValid && billingOk && s.terms];
  const currentStep = flags.indexOf(false);
  const steps: CheckoutStep[] = ["Details", "Delivery", "Payment"].map((label, i) => ({ label, done: flags[i], current: i === currentStep }));

  // Totals (the same rules the server applies when it places the order)
  const base = c.totals || {};
  const t = computeTotals({
    purchases: base.purchases || 0,
    rentals: base.rentals || 0,
    deposit: base.deposit || 0,
    percentOff: c.promo ? c.promo.percentOff : 0,
    pickup,
    sameDay: !pickup && isToday,
  });
  const baseFee = t.deliveryFee;
  const fee = t.deliveryFee + t.sameDayFee;

  const deliveryIso = s.day === "date" ? selDate : isToday ? todayIso : tomorrowIso;
  const dayLabel = s.day === "date" ? dow(selDate) + " " + dayMonth(selDate) : (DAYS.find((d) => d.id === s.day) || DAYS[1]).sub;
  const winLabel = (WINDOWS.find((w) => w.id === s.win) || WINDOWS[1]).label;

  const rentals = rentalLines.map((l) => ({
    id: l.id,
    name: l.product.name,
    kind: l.product.kind,
    bg: l.product.bg,
    variant: l.variant ? l.variant.label : "",
    href: "/product/" + l.product.id,
    price: fmt(l.lineTotal),
    daysLabel: "· " + l.rentDays + (l.rentDays === 1 ? " day" : " days"),
    startLabel: l.rentStart ? longDate(l.rentStart) : "To be confirmed",
    endLabel: l.rentEnd ? longDate(l.rentEnd) : "To be confirmed",
    note: "No need to bring it back — we collect it from the same address. Your " + fmt(l.deposit) + " deposit is refunded after the " + l.product.name + " is checked, within " + store.depositRefundDays + " days.",
  }));
  const hasRentals = rentals.length > 0;
  const rentDays = rentalLines.reduce((a, l) => a + (l.rentDays || 0), 0);
  const termsTail =
    rentals.length === 0
      ? "."
      : rentals.length === 1
        ? ", and will have the " + rentals[0].name + " ready for collection on " + rentals[0].endLabel + "."
        : ", and will have my rentals ready for collection on their return dates.";
  const codText =
    "Pay by Telebirr or card when your purchases arrive." +
    (rentals.length === 0
      ? ""
      : rentals.length === 1
        ? " The rental and its " + fmt(t.deposit) + " deposit are paid when the " + rentals[0].name + " is delivered."
        : " The rentals and their " + fmt(t.deposit) + " deposit are paid when they are delivered.") +
    (store.payOnDeliveryTerms ? " " + store.payOnDeliveryTerms : "");
  const slotNote = isToday
    ? "Same-day delivery for orders placed before " + hourLabel(store.sameDayCutoffHour) + ". A " + fmt(SAME_DAY_FEE) + " fee applies."
    : baseFee
      ? "Delivery is " + fmt(baseFee) + ". Add " + fmt(t.freeDeliveryRemaining) + " more in purchases for free delivery."
      : t.purchases > 0
        ? "Free delivery: your purchases are over the " + fmt(FREE_DELIVERY_THRESHOLD) + " free-delivery threshold."
        : "Free delivery: rentals are always delivered and collected free.";

  const ready = s.terms && !placing;

  const submit = () => {
    const payment: Record<string, unknown> = { method: s.pay };
    if (s.pay === "telebirr") payment.phone = s.telebirr;
    if (s.pay === "card") {
      const d = digits(s.cardNo, 19);
      if (savedCard) payment.cardLast4 = savedCard.last4;
      else if (d.length >= 4) payment.cardLast4 = d.slice(-4); // never send the full card data
    }
    const payload: Record<string, unknown> = {
      contact: { name: s.name, phone: s.phone, email: s.email },
      fulfilment: pickup ? "pickup" : "delivery",
      payment,
      acceptTerms: true,
    };
    if (!pickup) {
      payload.deliveryDate = deliveryIso;
      payload.deliveryWindow = winLabel;
      if (isNew) payload.newAddress = { line1: s.newLine, area: s.newArea, city: s.newCity, phone: s.phone || undefined };
      else payload.addressId = s.addr;
    }

    setFrozenCart(shop.cart);
    setPlacing(true);
    patch({ errors: {}, orderError: "", termsError: "" });
    // Online payments go to the payment page, everything else to the confirmation page.
    // `placing` stays true so the frozen summary holds until the app leaves this page.
    placeOrder(payload).then(finishCheckout, (err) => {
      setPlacing(false);
      const message = (err && err.message) || "Something went wrong. Please try again.";
      if (err && err.field === "acceptTerms") {
        patch({ termsError: message });
        reveal("terms");
        return;
      }
      let slot: Slot | null = err && err.field ? FIELD_SLOTS[err.field] || null : null;
      if (!slot && !(err && err.field) && /telebirr/i.test(message)) slot = "telebirr";
      if (slot) {
        patch({ errors: { [slot]: message } });
        reveal(SLOT_SECTION[slot]);
      } else patch({ orderError: message });
    });
  };
  const onPlaceOrder = () => {
    if (placing) return;
    if (!s.terms) {
      patch({ termsError: "Please accept the terms to place your order." });
      reveal("terms");
      return;
    }
    submit();
  };

  // back to the cart that is underneath this page (or open it when checkout was opened directly)
  const toCart = () => (router.canGoBack() ? router.dismissTo("/cart" as never) : navigate("/cart", { replace: true }));
  const deliverInstead = () => router.setParams({ fulfilment: undefined });

  const inner = width - 2 * GUTTER - 58; // card content width: gutters, 28px padding and the border
  const half = Math.floor((inner - 10) / 2);
  const placeFg = ready ? C.white : C.text;

  return (
    <>
      <CheckoutHeader steps={steps} />
      <View onLayout={(e) => mark("main", e)} style={{ paddingTop: 40, paddingHorizontal: GUTTER, gap: 28 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View style={{ gap: 8 }}>
            <Eyebrow s={13}>Almost there</Eyebrow>
            <H s={48} lh={48} ls={-2.16} accessibilityRole="header">
              Checkout
            </H>
          </View>
          <Tap onPress={toCart} accessibilityRole="link" style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon xml={ICON.arrowLeft} size={16} color={C.navy} />
            <T s={15} w={600} c={C.navy}>
              Back to cart
            </T>
          </Tap>
        </View>

        <View onLayout={(e) => mark("grid", e)} style={{ gap: 20 }}>
          {/* 1 · Contact */}
          <Card onLayout={(e) => mark("contact", e)}>
            <SectionHead n={1} title="Contact" status={contactDone ? "Complete" : "Required"} ok={contactDone} />
            <View style={{ gap: 16 }}>
              <Field label="Full name" value={s.name} onChangeText={setField("name")} placeholder="First and last name" autoComplete="name" textContentType="name" autoCapitalize="words" error={errors.name} boxStyle={FIELD_BOX} />
              <PhoneField label="Phone" value={s.phone} onChangeText={setField("phone")} error={errors.phone} />
              <Field
                label="Email"
                value={s.email}
                onChangeText={setField("email")}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.email}
                boxStyle={FIELD_BOX}
              />
            </View>
          </Card>

          {/* 2 · Delivery address */}
          <Card onLayout={(e) => mark("address", e)}>
            <SectionHead
              n={2}
              title="Delivery address"
              status={pickup ? "Pick up in store" : addrDone ? (isNew ? "New address" : "Saved address") : "Add street and city"}
              ok={pickup || addrDone}
            />
            {pickupAsked && !pickup ? (
              <T s={13} c={C.muted} lh={19}>
                Rentals are always delivered and collected by us, so this order will be delivered rather than picked up.
              </T>
            ) : null}
            {pickup ? (
              <PickupPanel text={"We'll text you when your order is ready to collect from " + store.name + ", " + store.address + "."} onDeliver={deliverInstead} />
            ) : (
              <>
                <View accessibilityRole="radiogroup" style={{ gap: 14 }}>
                  {addrs.map((a) => {
                    const on = !isNew && s.addr === a.id;
                    return (
                      <Tap
                        key={a.id}
                        onPress={() => patch({ addr: a.id })}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        hitSlop={0}
                        style={{ minHeight: 124, padding: 18, gap: 6, borderWidth: 2, borderColor: on ? BLUE : C.line, borderRadius: 20, backgroundColor: on ? C.sky : C.white }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Icon xml={ICON.pin} size={16} color={C.navy} />
                            <T s={15} w={700} numberOfLines={1} style={{ flexShrink: 1 }}>
                              {a.label}
                            </T>
                          </View>
                          <RadioDot on={on} size={20} dot={8} />
                        </View>
                        <T s={14} c={C.text} lh={20.3}>
                          {[a.line1, a.area].filter(Boolean).join(", ")}
                        </T>
                        <T s={13} c={C.muted}>
                          {[a.city, a.phone || a.notes].filter(Boolean).join(" · ")}
                        </T>
                      </Tap>
                    );
                  })}
                  <Tap
                    onPress={() => patch({ addr: "new" })}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isNew }}
                    hitSlop={0}
                    style={{ minHeight: 124, padding: 18, gap: 8, alignItems: "center", justifyContent: "center", borderWidth: 2, borderStyle: "dashed", borderColor: isNew ? BLUE : IDLE_LINE, borderRadius: 20, backgroundColor: isNew ? C.sky : C.white }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: C.sky, alignItems: "center", justifyContent: "center" }}>
                      <Icon xml={ICON.plus} size={18} color={C.navy} sw={2.2} />
                    </View>
                    <T s={15} w={700} c={C.navy}>
                      Add new address
                    </T>
                  </Tap>
                </View>
                {isNew ? (
                  <View style={{ padding: 20, borderRadius: 20, backgroundColor: SOFT, gap: 16 }}>
                    <Field
                      label="Street, building, house no."
                      value={s.newLine}
                      onChangeText={setField("newLine")}
                      placeholder={"e.g. " + store.address}
                      autoComplete="address-line1"
                      textContentType="streetAddressLine1"
                      error={errors.newLine}
                      boxStyle={FIELD_BOX}
                    />
                    <Field label="Area or estate" value={s.newArea} onChangeText={setField("newArea")} placeholder="Neighbourhood or estate" error={errors.newArea} boxStyle={FIELD_BOX} />
                    <Field label="Town or city" value={s.newCity} onChangeText={setField("newCity")} placeholder={store.city} textContentType="addressCity" error={errors.newCity} boxStyle={FIELD_BOX} />
                  </View>
                ) : null}
              </>
            )}
          </Card>

          {/* 3 · Delivery slot */}
          <Card gap={18}>
            <SectionHead
              n={3}
              title="Delivery slot"
              sub="for your purchases"
              status={pickup ? "We will text you" : slotDone ? dayLabel + ", " + winLabel : "Choose a window"}
              ok={pickup || slotDone}
            />
            {pickup ? (
              <PickupPanel text={"Ready in " + store.pickupReadyHours + " hours · we will text you"} onDeliver={deliverInstead} />
            ) : (
              <>
                <View accessibilityRole="radiogroup" accessibilityLabel="Delivery day" style={{ flexDirection: "row", gap: 6, padding: 4, backgroundColor: C.sand, borderRadius: 14 }}>
                  {DAYS.map((d) => {
                    const on = s.day === d.id;
                    return (
                      <Tap
                        key={d.id}
                        onPress={() => patch(d.id === "today" && s.win === "w1" ? { day: d.id, win: "w2" } : { day: d.id })}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        hitSlop={0}
                        style={[{ flex: 1, height: 52, borderRadius: 11, alignItems: "center", justifyContent: "center", gap: 1 }, on && { backgroundColor: C.white, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }]}
                      >
                        <T s={14} w={600} c={on ? BLUE : C.text} numberOfLines={1}>
                          {d.label}
                        </T>
                        {d.sub ? (
                          <T s={12} w={500} c={C.muted} numberOfLines={1}>
                            {d.sub}
                          </T>
                        ) : null}
                      </Tap>
                    );
                  })}
                </View>
                {s.day === "date" ? (
                  <View accessibilityRole="radiogroup" accessibilityLabel="Choose a date" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    {DATES.map((d) => {
                      const on = selDate === d.id;
                      return (
                        <Tap
                          key={d.id}
                          onPress={() => patch({ date: d.id })}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on }}
                          hitSlop={0}
                          style={{ width: half, height: 68, borderWidth: 2, borderColor: on ? BLUE : C.line, borderRadius: 16, backgroundColor: on ? C.sky : C.white, alignItems: "center", justifyContent: "center", gap: 2 }}
                        >
                          <T s={12} w={600} c={C.muted}>
                            {d.dow}
                          </T>
                          <T s={17} w={700}>
                            {d.day}
                          </T>
                        </Tap>
                      );
                    })}
                  </View>
                ) : null}
                <View accessibilityRole="radiogroup" accessibilityLabel="Time window" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {WINDOWS.map((w) => {
                    const full = isToday && w.id === "w1";
                    const on = s.win === w.id && !full;
                    return (
                      <Tap
                        key={w.id}
                        onPress={() => patch({ win: w.id })}
                        disabled={full}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on, disabled: full }}
                        hitSlop={0}
                        style={{ width: half, height: 72, borderWidth: 2, borderColor: on ? BLUE : C.line, borderRadius: 16, backgroundColor: full ? SOFT : on ? C.sky : C.white, alignItems: "center", justifyContent: "center", gap: 3 }}
                      >
                        <T s={15} w={700} c={full ? C.muted : C.ink}>
                          {w.label}
                        </T>
                        <T s={12} w={600} c={full ? C.muted : isToday ? "#B4431C" : baseFee ? C.text : GREEN}>
                          {full ? "Unavailable" : isToday ? "Same-day " + fmt(SAME_DAY_FEE) : baseFee ? fmt(baseFee) : "Free"}
                        </T>
                      </Tap>
                    );
                  })}
                </View>
                <T s={13} c={C.muted} lh={17}>
                  {slotNote}
                </T>
              </>
            )}
          </Card>

          {/* 4 · Rental schedule */}
          {hasRentals ? (
            <Card pad={0} gap={0} style={{ overflow: "hidden" }}>
              <View style={{ paddingVertical: 18, paddingHorizontal: 28, backgroundColor: C.greenBg, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 20, rowGap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Badge n={4} bg={GREEN} />
                  <H s={24} lh={29} ls={-0.72} c={C.greenDark} accessibilityRole="header">
                    Rental schedule
                  </H>
                </View>
                <Tap href={rentals[0].href} style={{ height: 44, justifyContent: "center" }}>
                  <T s={14} w={600} c={C.greenDark} style={{ textDecorationLine: "underline" }}>
                    Change dates
                  </T>
                </Tap>
              </View>
              {rentals.map((r) => (
                <View key={r.id} style={{ paddingVertical: 24, paddingHorizontal: 28, alignItems: "center", gap: 16 }}>
                  <View style={{ width: 104, height: 104, borderRadius: 22, backgroundColor: r.bg, alignItems: "center", justifyContent: "center" }}>
                    <ProductArt kind={r.kind} size={96} />
                  </View>
                  <View style={{ alignSelf: "stretch", gap: 14 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 12, rowGap: 2 }}>
                      <T s={17} w={700} style={{ flexShrink: 1 }}>
                        {r.name}
                        {r.variant ? (
                          <T s={13} w={500} c={C.muted}>
                            {" · " + r.variant}
                          </T>
                        ) : null}
                      </T>
                      <T s={15} w={700}>
                        {r.price + " "}
                        <T s={15} w={500} c={C.muted}>
                          {r.daysLabel}
                        </T>
                      </T>
                    </View>
                    <View style={{ gap: 12 }}>
                      <ScheduleTile icon={ICON.truck} label="We deliver it" date={r.startLabel} time="9am – 12pm" />
                      <ScheduleTile icon={ICON.refresh} label="We collect it" date={r.endLabel} time="3pm – 6pm" />
                    </View>
                    <T s={13} c={C.text} lh={19.5}>
                      {r.note}
                    </T>
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          {/* Payment method */}
          <Card gap={18} onLayout={(e) => mark("payment", e)}>
            <SectionHead n={hasRentals ? 5 : 4} title="Payment method" status={payValid ? "Ready" : "Required"} ok={payValid} />
            <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
              {PAYS.map((po) => {
                const on = s.pay === po.id;
                return (
                  <Tap
                    key={po.id}
                    onPress={() => patch({ pay: po.id })}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    hitSlop={0}
                    style={{ minHeight: 76, paddingVertical: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 2, borderColor: on ? BLUE : C.line, borderRadius: 20, backgroundColor: on ? C.sky : C.white }}
                  >
                    <RadioDot on={on} size={22} dot={10} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T s={16} w={700}>
                        {po.title}
                      </T>
                      <T s={13} c={C.muted}>
                        {po.sub}
                      </T>
                    </View>
                    <View style={{ height: 32, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.white }}>
                      {po.logos ? (
                        po.logos.map((b) => <PayLogo key={b} brand={b} scale={b === "telebirr" ? 22 / 24 : 1} />)
                      ) : (
                        <T s={12} w={800} c={C.text} numberOfLines={1}>
                          {po.chip}
                        </T>
                      )}
                    </View>
                  </Tap>
                );
              })}
            </View>

            {s.pay === "telebirr" ? (
              <View style={{ padding: 20, borderRadius: 20, backgroundColor: SOFT, gap: 16 }}>
                <PhoneField label="Telebirr phone number" value={s.telebirr} onChangeText={setField("telebirr")} error={errors.telebirr} />
                <View style={{ minHeight: 52, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.greenBg, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Icon xml={ICON.phone} size={20} color={C.greenDark} sw={1.8} />
                  <T s={13} c={C.greenDark} lh={18.2} style={{ flex: 1 }}>
                    <T s={13} w={700} c={C.greenDark} lh={18.2}>
                      You&apos;ll get a prompt on your phone.
                    </T>{" "}
                    Enter your Telebirr PIN to pay.
                  </T>
                </View>
              </View>
            ) : null}

            {s.pay === "card" ? (
              <View style={{ padding: 20, borderRadius: 20, backgroundColor: SOFT, gap: 16 }}>
                {savedCards.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    <T s={14} w={600}>
                      Saved cards
                    </T>
                    <View accessibilityRole="radiogroup" accessibilityLabel="Saved cards" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {savedCards.map((m) => {
                        const on = !!savedCard && savedCard.id === m.id;
                        return (
                          <Tap
                            key={m.id}
                            onPress={() =>
                              setS((prev) => {
                                const er = { ...prev.errors };
                                delete er.cardNo;
                                return { ...prev, savedCard: on ? null : m.id, errors: er };
                              })
                            }
                            accessibilityRole="radio"
                            accessibilityState={{ checked: on }}
                            hitSlop={4}
                            style={{ height: 36, paddingHorizontal: 14, justifyContent: "center", borderWidth: 2, borderColor: on ? BLUE : C.line, borderRadius: 999, backgroundColor: on ? C.sky : C.white }}
                          >
                            <T s={13} w={600} c={on ? BLUE : C.ink}>
                              {cardLabel(m)}
                            </T>
                          </Tap>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
                <Field
                  label="Card number"
                  value={s.cardNo}
                  onChangeText={(v) => {
                    setField("cardNo", (x) => digits(x, 19).replace(/(\d{4})(?=\d)/g, "$1 "))(v);
                    // typing a new number means the saved-card chip no longer applies
                    if (s.savedCard) patch({ savedCard: null });
                  }}
                  placeholder="1234 5678 9012 3456"
                  keyboardType="number-pad"
                  autoComplete="cc-number"
                  textContentType="creditCardNumber"
                  maxLength={23}
                  error={errors.cardNo}
                  boxStyle={FIELD_BOX}
                  style={{ fontVariant: ["tabular-nums"] }}
                />
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <Field
                    label="Expiry"
                    value={s.cardExp}
                    onChangeText={setField("cardExp", (v) => {
                      const d = digits(v, 4);
                      return d.length > 2 ? d.slice(0, 2) + " / " + d.slice(2) : d;
                    })}
                    placeholder="MM / YY"
                    keyboardType="number-pad"
                    autoComplete="cc-exp"
                    containerStyle={{ flex: 1 }}
                    boxStyle={FIELD_BOX}
                  />
                  <Field
                    label="CVC"
                    value={s.cardCvc}
                    onChangeText={setField("cardCvc", (v) => digits(v, 4))}
                    placeholder="123"
                    keyboardType="number-pad"
                    autoComplete="cc-csc"
                    secureTextEntry
                    containerStyle={{ flex: 1 }}
                    boxStyle={FIELD_BOX}
                  />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon xml={ICON.lock} size={14} color={C.muted} />
                  <T s={13} c={C.muted} lh={18} style={{ flex: 1 }}>
                    Card details are encrypted and handled by our payment provider, Telebirr.
                  </T>
                </View>
              </View>
            ) : null}

            {s.pay === "cod" ? (
              <View style={{ paddingVertical: 16, paddingHorizontal: 20, borderRadius: 20, backgroundColor: SOFT }}>
                <T s={14} c={C.text} lh={21}>
                  {codText}
                </T>
              </View>
            ) : null}
          </Card>

          {/* Billing and terms */}
          <Card gap={0} onLayout={(e) => mark("terms", e)} style={{ paddingVertical: 16 }}>
            <Tap
              onPress={() => patch({ billingSame: !s.billingSame })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: s.billingSame }}
              hitSlop={0}
              style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 14 }}
            >
              <Checkbox checked={s.billingSame} />
              <T s={15} style={{ flex: 1 }}>
                Billing address is the same as delivery
              </T>
            </Tap>
            {!s.billingSame ? (
              <Field
                label="Billing address"
                value={s.billAddr}
                onChangeText={setField("billAddr")}
                placeholder={"e.g. " + store.address + (String(store.address).indexOf(store.city) < 0 ? ", " + store.city : "")}
                autoComplete="street-address"
                containerStyle={{ paddingTop: 4, paddingBottom: 12, paddingLeft: 34 }}
                boxStyle={FIELD_BOX}
              />
            ) : null}
            <View style={{ height: 1, backgroundColor: C.line }} />
            <View style={{ minHeight: 60, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Checkbox checked={s.terms} onChange={(next) => patch({ terms: next, termsError: "" })} label="I agree to the terms" />
              <T s={15} c={s.termsError ? C.red : C.ink} lh={21.75} style={{ flex: 1 }} onPress={() => patch({ terms: !s.terms, termsError: "" })}>
                I agree to the{" "}
                <T s={15} w={600} c={C.navy} lh={21.75} style={{ textDecorationLine: "underline" }} accessibilityRole="link" onPress={() => navigate("/p/terms")}>
                  Terms of sale
                </T>{" "}
                and{" "}
                <T s={15} w={600} c={C.green} lh={21.75} style={{ textDecorationLine: "underline" }} accessibilityRole="link" onPress={() => navigate("/p/rental-terms")}>
                  Rental terms
                </T>
                {termsTail}
              </T>
            </View>
            {s.termsError ? (
              <T s={13} w={600} c={C.red} style={{ paddingLeft: 34, paddingBottom: 6 }} accessibilityRole="alert">
                {s.termsError}
              </T>
            ) : null}
          </Card>

          {/* Order summary */}
          <Card gap={18} style={{ marginTop: 4, boxShadow: SUMMARY_SHADOW }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
              <H s={26} lh={31} ls={-0.91} accessibilityRole="header">
                Your order
              </H>
              <Tap onPress={toCart} accessibilityRole="link">
                <T s={14} w={600} c={C.navy} style={{ textDecorationLine: "underline" }}>
                  Edit cart
                </T>
              </Tap>
            </View>
            <View style={{ gap: 14 }}>
              {cartLines.map((l) => {
                const rent = l.mode === "rent";
                return (
                  <OrderLine
                    key={l.id}
                    name={l.product.name}
                    kind={l.product.kind}
                    bg={l.product.bg}
                    qty={l.qty}
                    variant={l.variant ? l.variant.label : ""}
                    rent={rent}
                    meta={rent ? "Rental · " + (l.rentStart && l.rentEnd ? dayMonth(l.rentStart) + " – " + dayMonth(l.rentEnd) : l.rentDays + " days") : "Purchase · Qty " + l.qty + (l.qty > 1 ? " × " + fmt(l.unitPrice) : "")}
                    price={fmt(l.lineTotal)}
                  />
                );
              })}
            </View>
            <View style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line, gap: 12 }}>
              <SumRow label="Purchases" value={fmt(t.purchases)} />
              {t.discount > 0 ? (
                <SumRow label={c.promo ? c.promo.code + " · " + c.promo.percentOff + "% off purchases" : "Discount"} labelColor={GREEN} labelWeight={600} value={"−" + fmt(t.discount)} valueColor={GREEN} valueWeight={700} />
              ) : null}
              <SumRow label={"Rentals · " + rentDays + (rentDays === 1 ? " day" : " days")} value={fmt(t.rentals)} />
              <SumRow label="Delivery" sub={pickup ? "Pick up in store" : dayLabel + " · " + winLabel} value={fee ? fmt(fee) : "Free"} valueColor={fee ? C.ink : GREEN} />
              <SumRow label="Refundable deposit" value={fmt(t.deposit)} />
            </View>
            <TotalRow note={"+ " + fmt(t.deposit) + " refundable deposit"} total={fmt(t.total)} />
            <Tap
              onPress={onPlaceOrder}
              accessibilityState={{ disabled: !ready, busy: placing }}
              hitSlop={0}
              style={{ minHeight: 60, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, backgroundColor: ready ? GREEN : "#D5D8DD" }}
            >
              {placing ? <ActivityIndicator size="small" color={placeFg} /> : <Icon xml={ICON.lock} size={18} color={placeFg} />}
              <T s={17} w={700} c={placeFg} numberOfLines={1}>
                {"Place order · " + fmt(t.total)}
              </T>
            </Tap>
            <T s={13} c={s.orderError ? C.red : s.terms ? C.muted : C.text} center accessibilityLiveRegion="polite">
              {s.orderError ? s.orderError : placing ? "Placing your order…" : s.terms ? "You will not be charged until you confirm on your phone or card." : "Tick the terms box to place your order."}
            </T>
            <PayBadges style={{ justifyContent: "center" }} />
          </Card>
        </View>
      </View>
      <View style={{ height: 56 }} />
      <SiteFooter compact />
    </>
  );
}

function Badge({ n, bg }: { n: number; bg: string }) {
  return (
    <View style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <T s={14} w={700} c={C.white}>
        {n}
      </T>
    </View>
  );
}

/** Numbered section heading with its status on the right (it wraps underneath when there is no room). */
function SectionHead({ n, title, sub, status, ok }: { n: number; title: string; sub?: string; status: string; ok: boolean }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 20, rowGap: 12 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 12, maxWidth: "100%" }}>
        <Badge n={n} bg={ok ? GREEN : BLUE} />
        <H s={24} lh={29} ls={-0.72} accessibilityRole="header" style={{ flexShrink: 1 }}>
          {title}
          {sub ? (
            <T s={15} w={500} c={C.muted} ls={0}>
              {" " + sub}
            </T>
          ) : null}
        </H>
      </View>
      <T s={13} w={600} c={ok ? GREEN : C.muted} style={{ flexShrink: 1 }}>
        {status}
      </T>
    </View>
  );
}

function RadioDot({ on, size, dot }: { on: boolean; size: number; dot: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 999, borderWidth: 2, borderColor: on ? BLUE : GREY, alignItems: "center", justifyContent: "center" }}>
      {on ? <View style={{ width: dot, height: dot, borderRadius: 999, backgroundColor: BLUE }} /> : null}
    </View>
  );
}

/** Shown in place of the address / slot pickers when the order is collected from the store. */
function PickupPanel({ text, onDeliver }: { text: string; onDeliver: () => void }) {
  return (
    <View style={{ paddingVertical: 16, paddingHorizontal: 20, borderRadius: 20, backgroundColor: SOFT, gap: 6 }}>
      <T s={16} w={700}>
        Pick up in store
      </T>
      <T s={14} c={C.text} lh={20.3}>
        {text}
      </T>
      <Tap onPress={onDeliver} accessibilityRole="link" style={{ alignSelf: "flex-start" }}>
        <T s={14} w={600} c={C.navy} style={{ textDecorationLine: "underline" }}>
          Deliver instead
        </T>
      </Tap>
    </View>
  );
}

function ScheduleTile({ icon, label, date, time }: { icon: string; label: string; date: string; time: string }) {
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: SOFT, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.greenBg, alignItems: "center", justifyContent: "center" }}>
        <Icon xml={icon} size={18} color={C.green} sw={1.8} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T s={12} w={600} c={C.muted}>
          {label}
        </T>
        <T s={15} w={700}>
          {date}
        </T>
        <T s={13} c={C.text}>
          {time}
        </T>
      </View>
    </View>
  );
}
