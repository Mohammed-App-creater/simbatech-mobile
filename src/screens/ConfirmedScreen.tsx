/*
 * Order confirmed: the thank-you block (order number, Pay now for unpaid online orders, Track order),
 * live tracking, delivery details, rentals (with "Extend rental") and the order summary.
 * The website's confirmation page in its phone layout. `/order-confirmed` without an id opens the
 * customer's latest order.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { C, GUTTER } from "@/theme";
import { getOrder, listOrders, listProducts } from "@/lib/catalog";
import { DAY_MS } from "@/lib/pricing";
import { api, formatETB as fmt, payments, storeVals, useShop } from "@/lib/store";
import type { OrderDTO } from "@/lib/types";
import { Screen } from "@/components/Screen";
import { CheckoutHeader } from "@/components/CheckoutHeader";
import { ProductArt } from "@/components/ProductArt";
import { Btn, Eyebrow, H, Icon, ICON, LoadError, Loading, Serif, T, Tap, useLoad } from "@/components/ui";
import { Card, OrderLine, SOFT, SUMMARY_SHADOW, SumRow, TotalRow } from "@/components/checkout/parts";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TRACK = [
  { status: "PLACED", label: "Placed" },
  { status: "PACKED", label: "Packed" },
  { status: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { status: "DELIVERED", label: "Delivered" },
];
const HEADINGS = ["Your purchases are being packed", "Your order is packed and ready to go", "Your order is out for delivery", "Your order has been delivered"];
const METHOD: Record<string, string> = { telebirr: "TELEBIRR", card: "CARD", cod: "PAY ON DELIVERY" };

// Timestamps are shown in the shop's time (Addis Ababa, UTC+3 all year), whatever zone the phone is in.
const parseTime = (iso: string) => new Date(String(iso).replace(/(\.\d{3})\d+/, "$1")).getTime();
const shopTime = (iso: string) => new Date(parseTime(iso) + 3 * 3_600_000);
// "Tue 6 Oct"
function fmtDay(iso: string | null | undefined) {
  if (!iso) return "";
  const d = shopTime(iso);
  return DOW[d.getUTCDay()] + " " + d.getUTCDate() + " " + MON[d.getUTCMonth()];
}
// "Tue 6 Oct 2026"
const fmtDate = (iso: string | null | undefined) => (iso ? fmtDay(iso) + " " + shopTime(iso).getUTCFullYear() : "");
// "10:42am"
function fmtTime(iso: string) {
  const d = shopTime(iso);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return (h % 12 || 12) + ":" + (m < 10 ? "0" : "") + m + (h < 12 ? "am" : "pm");
}
// "Tue 29 Sep, 10:42am"
const fmtStamp = (iso: string) => fmtDay(iso) + ", " + fmtTime(iso);
const firstName = (n: string) => (n || "").trim().split(/\s+/)[0] || "there";
const dayWord = (n: number) => n + (n === 1 ? " day" : " days");
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function ConfirmedScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; payment?: string | string[] }>();
  const id = one(params.id) || "";
  const payment = one(params.payment);
  const paymentResult = payment === "paid" || payment === "failed" ? payment : null;
  const shop = useShop();
  const userId = shop.user ? shop.user.id : null;
  const { data: order, error, loading, reload, setData } = useLoad<OrderDTO | null>(() => getOrder(id), [id, userId]);

  // coming back to this page (e.g. after closing the payment page) shows the order as it is now
  const seen = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (seen.current) reload();
      seen.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <Screen header={false} onRefresh={reload}>
      <CheckoutHeader />
      {order ? (
        <ConfirmedBody key={order.id} order={order} setOrder={setData} paymentResult={paymentResult} />
      ) : order === null ? (
        <NotFound signedIn={!!shop.user} />
      ) : loading ? (
        <Loading />
      ) : (
        <LoadError message={error} onRetry={reload} />
      )}
    </Screen>
  );
}

/** `/order-confirmed` (no id): the signed-in customer's latest order, or their account when they have none. */
export function LatestOrderRedirect() {
  const shop = useShop();
  const signedIn = !!shop.user;
  const { data, error, loading, reload } = useLoad<OrderDTO[] | null>(async () => (shop.ready && signedIn ? listOrders() : null), [shop.ready, signedIn]);

  if (shop.ready && !signedIn) return <Redirect href={"/signin?next=/account" as never} />;
  if (shop.ready && data) {
    const latest = data.slice().sort((a, b) => parseTime(b.createdAt) - parseTime(a.createdAt))[0];
    return <Redirect href={(latest ? "/order-confirmed/" + latest.id : "/account") as never} />;
  }
  return (
    <Screen header={false}>
      <CheckoutHeader />
      {error && !loading && shop.ready ? <LoadError message={error} onRetry={reload} /> : <Loading />}
    </Screen>
  );
}

function NotFound({ signedIn }: { signedIn: boolean }) {
  return (
    <View style={{ paddingTop: 40, paddingHorizontal: GUTTER }}>
      <View style={{ padding: 28, borderRadius: 32, backgroundColor: SOFT, gap: 14, alignItems: "flex-start" }}>
        <Eyebrow s={13}>Order not found</Eyebrow>
        <H s={30} lh={32}>
          We couldn&apos;t find that order.
        </H>
        <T s={15} c={C.text} lh={22}>
          {signedIn
            ? "It may have been placed with a different account. You can look it up with the order number and the phone number used on the order."
            : "If you placed it while signed in, sign in to see it. You can also look it up with the order number and the phone number used on the order."}
        </T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 4 }}>
          <Btn title="Track an order" variant="navy" href="/track" iconLeft={ICON.truck} />
          {signedIn ? <Btn title="Your orders" variant="outline" w={600} href="/account" /> : <Btn title="Sign in" variant="outline" w={600} href="/signin?next=/account" />}
        </View>
        <Tap href="/shop" style={{ height: 36, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <T s={15} w={600} c={C.navy}>
            Continue shopping
          </T>
          <Icon xml={ICON.arrowRight} size={16} color={C.navy} />
        </Tap>
      </View>
    </View>
  );
}

type Extra = Record<string, { days: number; charge: number }>;

function ConfirmedBody({ order: o, setOrder, paymentResult }: { order: OrderDTO; setOrder: (o: OrderDTO) => void; paymentResult: "paid" | "failed" | null }) {
  const shop = useShop();
  const store = storeVals(shop);
  const signedIn = !!shop.user;
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [extra, setExtra] = useState<Extra>({}); // rental item id -> days / charge added on this page
  const [rates, setRates] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [extendError, setExtendError] = useState<{ id: number; message: string } | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState("");

  const items: any[] = o.items || [];
  const rentItems = items.filter((i) => i.mode === "rent");
  const buyItems = items.filter((i) => i.mode !== "rent");
  const hasRentItems = rentItems.length > 0;

  // Day rates for the "Extra days ETB X each" line (older orders' items don't carry the product's rate).
  useEffect(() => {
    if (!hasRentItems) return;
    let live = true;
    listProducts()
      .then((products) => {
        const next: Record<string, number> = {};
        products.forEach((p) => {
          if (p.rent) next[p.name] = p.rent;
        });
        if (live) setRates(next);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [hasRentItems]);
  useEffect(() => () => void (copyTimer.current && clearTimeout(copyTimer.current)), []);

  const pay = o.payment || {};
  const paid = pay.status === "paid";
  const needsPay = !paid && !!pay.payable; // an unpaid Telebirr / card order that can be paid online
  const payFailed = paymentResult === "failed" || pay.status === "failed";
  const cancelled = o.status === "CANCELLED";
  const step: number = o.step || 0;
  const current = cancelled ? -1 : step + 1; // the step after the last one reached is "in progress"
  const events: { status: string; at: string }[] = o.events || [];
  const eventAt: Record<string, string> = {};
  events.forEach((e) => {
    eventAt[e.status] = e.at;
  });
  const lastEvent = events[events.length - 1];
  const slotShort = o.deliveryDate ? fmtDay(o.deliveryDate) + (o.deliveryWindow ? ", " + o.deliveryWindow : "") : "";
  const pickup = o.fulfilment === "pickup" || !o.address;
  const payPhone = pay.phone || o.contact.phone;
  const payNotice = payError ? payError : payFailed ? "Your payment didn't go through. You can try again." : "";

  const track = TRACK.map((t, i) => {
    const done = !cancelled && i <= step;
    const cur = i === current;
    return {
      label: t.label,
      time: eventAt[t.status] ? fmtStamp(eventAt[t.status]) : i === 1 ? "Expected within " + store.pickupReadyHours + " hours" : i === 2 ? slotShort || "To be scheduled" : o.deliveryDate ? fmtDay(o.deliveryDate) : "To be scheduled",
      done,
      cur,
      last: i === TRACK.length - 1,
      state: done ? "Done" : cur ? "In progress" : cancelled ? "Cancelled" : "Pending",
      stateFg: done ? C.green : cur ? C.navy : C.muted,
      ring: done ? C.green : cur ? C.blue : "#D5D3CC",
      lineBg: done && i < step ? C.green : C.line,
    };
  });

  // (Re)starts the online payment: the store opens the payment page.
  const payNow = () => {
    if (payBusy) return;
    setPayBusy(true);
    setPayError("");
    payments.payNow(o.id).then(
      () => setPayBusy(false),
      (err) => {
        setPayBusy(false);
        setPayError((err && err.message) || "Couldn't start the payment. Please try again.");
      },
    );
  };

  const copyOrder = () => {
    Clipboard.setStringAsync(o.number).catch(() => {});
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1800);
  };

  const extendItem = (item: any) => {
    if (busy) return;
    setBusy(item.id);
    setExtendError(null);
    api<{ charge: number }>("POST", "/api/rentals/" + item.id + "/extend", { days: 1 })
      .then((res) => {
        const charge = (res && res.charge) || 0;
        setOrder({
          ...o,
          items: items.map((i) =>
            i.id !== item.id
              ? i
              : { ...i, rentEnd: i.rentEnd ? new Date(parseTime(i.rentEnd) + DAY_MS).toISOString() : i.rentEnd, rentDays: (i.rentDays || 0) + 1, extendedDays: (i.extendedDays || 0) + 1, extraCharge: (i.extraCharge || 0) + charge },
          ),
          totals: { ...o.totals, rentals: o.totals.rentals + charge, total: o.totals.total + charge },
        });
        setExtra((prev) => {
          const was = prev[item.id] || { days: 0, charge: 0 };
          return { ...prev, [item.id]: { days: was.days + 1, charge: was.charge + charge } };
        });
        setBusy(null);
      })
      .catch((err) => {
        setBusy(null);
        setExtendError({ id: item.id, message: (err && err.message) || "Couldn't extend the rental. Please try again." });
      });
  };

  const extraDays = Object.values(extra).reduce((a, x) => a + x.days, 0);
  const extraCharge = Object.values(extra).reduce((a, x) => a + x.charge, 0);
  const itemNames = (buyItems.length ? buyItems : items).map((i) => i.name + (i.qty > 1 ? " ×" + i.qty : "")).join(", ");
  const trackHref = signedIn ? "/account" : "/track?number=" + encodeURIComponent(o.number) + "&phone=" + encodeURIComponent(o.contact.phone || "");

  return (
    <>
      {/* Thank you */}
      <View style={{ paddingTop: 40, paddingHorizontal: GUTTER }}>
        <View style={{ backgroundColor: C.greenBg, borderRadius: 32, paddingVertical: 50, paddingHorizontal: 38, gap: 14 }}>
          <View style={{ width: 72, height: 72, borderRadius: 999, backgroundColor: C.green, alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 10px rgba(47,122,60,0.15)" }}>
            <Icon xml={ICON.check} size={36} color={C.white} sw={2.6} />
          </View>
          <H s={33} lh={34} ls={-1.49} accessibilityRole="header">
            {needsPay ? "Almost there — " : "Thank you, " + firstName(o.contact.name) + "! "}
            <Serif c={C.green} ls={-0.66}>
              {needsPay ? "complete your payment." : "Your order is confirmed."}
            </Serif>
          </H>
          {payNotice ? (
            <T s={15} w={600} c={C.red} lh={21} accessibilityRole="alert">
              {payNotice}
            </T>
          ) : null}
          <View style={{ gap: 12, alignItems: "flex-start" }}>
            <View style={{ height: 36, paddingLeft: 14, paddingRight: 6, borderRadius: 10, backgroundColor: C.white, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <T s={15} w={600} c="#1F3B26">
                Order no.
              </T>
              <T s={15} w={800} c="#1F3B26" selectable style={{ fontVariant: ["tabular-nums"] }}>
                {o.number}
              </T>
              <Tap onPress={copyOrder} label="Copy order number" style={{ height: 28, paddingHorizontal: 10, borderRadius: 8, backgroundColor: C.sand, justifyContent: "center" }}>
                <T s={12} w={700} accessibilityLiveRegion="polite">
                  {copied ? "Copied" : "Copy"}
                </T>
              </Tap>
            </View>
            {o.contact.email ? (
              <T s={15} c="#1F3B26" lh={19}>
                We sent a confirmation to{" "}
                <T s={15} w={700} c="#1F3B26">
                  {o.contact.email}
                </T>
              </T>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 4 }}>
            {needsPay ? <Btn title={payBusy ? "Opening payment…" : "Pay now"} onPress={payNow} busy={payBusy} iconLeft={ICON.lock} /> : null}
            <Btn title="Track order" variant="navy" href={trackHref} iconLeft={ICON.truck} />
            <Btn title="Continue shopping" variant="outline" w={600} href="/shop" icon={ICON.arrowRight} />
          </View>
        </View>
      </View>

      <View style={{ paddingTop: 24, paddingHorizontal: GUTTER, gap: 20 }}>
        {/* Live tracking */}
        <Card gap={24}>
          <View style={{ gap: 12, alignItems: "flex-start" }}>
            <View style={{ gap: 4 }}>
              <Eyebrow s={13}>Live tracking</Eyebrow>
              <H s={26} lh={31} ls={-0.91} accessibilityRole="header">
                {cancelled ? "This order was cancelled" : HEADINGS[Math.min(step, 3)]}
              </H>
            </View>
            <View style={{ height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.sky, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: C.blue, boxShadow: "0 0 0 4px rgba(22,121,190,0.2)" }} />
              <T s={13} w={600} c={C.navy}>
                {"Updated " + fmtTime(lastEvent ? lastEvent.at : o.createdAt)}
              </T>
            </View>
          </View>
          <View accessibilityRole="list">
            {track.map((t) => (
              <View key={t.label} accessibilityState={{ selected: t.cur }} style={{ paddingHorizontal: 8, flexDirection: "row", gap: 14 }}>
                <View style={{ width: 40, alignItems: "center" }}>
                  <View
                    style={[
                      { width: 40, height: 40, borderRadius: 999, borderWidth: 2, borderColor: t.ring, backgroundColor: t.done ? C.green : C.white, alignItems: "center", justifyContent: "center" },
                      t.cur && { boxShadow: "0 0 0 6px rgba(22,121,190,0.15)" },
                    ]}
                  >
                    {t.done ? <Icon xml={ICON.check} size={18} color={C.white} sw={2.6} /> : <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: t.cur ? C.blue : "#D5D3CC" }} />}
                  </View>
                  {t.last ? null : <View style={{ flex: 1, width: 2, borderRadius: 999, marginVertical: 4, backgroundColor: t.lineBg }} />}
                </View>
                <View style={{ flex: 1, paddingTop: 8, paddingBottom: 18, gap: 3 }}>
                  <T s={15} w={700} c={t.done || t.cur ? C.ink : C.muted}>
                    {t.label}
                  </T>
                  <T s={13} c={C.muted}>
                    {t.time}
                  </T>
                  <T s={12} w={600} c={t.stateFg}>
                    {t.state}
                  </T>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Delivery */}
        <Card gap={18}>
          <CardHead icon={ICON.truck} tint={C.sky} color={C.navy} title="Delivery" />
          <View style={{ gap: 14 }}>
            <Detail label="Slot">
              <T s={15} w={700}>
                {o.deliveryDate ? fmtDate(o.deliveryDate) + (o.deliveryWindow ? " · " + o.deliveryWindow : "") : "To be scheduled"}
              </T>
            </Detail>
            <Detail label="Address">
              <T s={15} lh={21.75}>
                {pickup ? "Pick up in store\n" + store.name + ", " + store.address : o.address.line1 + ", " + o.address.area + "\n" + o.address.city}
              </T>
            </Detail>
            <Detail label="Items">
              <T s={15} lh={21}>
                {itemNames}
              </T>
            </Detail>
          </View>
          <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: SOFT }}>
            <T s={13} c={C.text} lh={19.5}>
              {pickup ? "We'll call " + o.contact.phone + " when your order is ready to pick up." : "Our driver calls " + ((o.address && o.address.phone) || o.contact.phone) + " about 30 minutes before arriving."}
            </T>
          </View>
        </Card>

        {/* Rentals */}
        {hasRentItems ? (
          <Card gap={18}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <CardHead icon={ICON.calendar} tint={C.greenBg} color={C.green} title="Your rental" />
              <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: C.greenBg, justifyContent: "center" }}>
                <T s={12} w={700} c={C.green}>
                  {rentItems.length === 1 && rentItems[0].rentalStatus === "returned" ? "Returned" : "We'll collect it"}
                </T>
              </View>
            </View>
            {rentItems.map((i) => {
              const price = i.lineTotal + (i.extraCharge || 0);
              const rate = i.rentRate || rates[i.name] || (i.extendedDays ? Math.round((i.extraCharge || 0) / i.extendedDays) : 0);
              const err = extendError && extendError.id === i.id ? extendError.message : "";
              const canExtend = signedIn && i.rentalStatus !== "returned" && !cancelled;
              return (
                <React.Fragment key={i.id}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                    <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: i.bg, alignItems: "center", justifyContent: "center" }}>
                      <ProductArt kind={i.kind} size={58} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T s={16} w={700}>
                        {i.name + (i.variant ? " · " + i.variant : "")}
                      </T>
                      <T s={14} w={600} c={C.green} lh={19} accessibilityLiveRegion="polite">
                        {dayWord(i.rentDays || 0) + " · " + fmt(price) + (i.deposit ? " · " + fmt(i.deposit) + " deposit" : "")}
                      </T>
                    </View>
                  </View>
                  <View style={{ gap: 12 }}>
                    <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: SOFT, gap: 2 }}>
                      <T s={12} w={600} c={C.muted}>
                        {o.fulfilment === "pickup" ? "Collected" : "Delivered"}
                      </T>
                      <T s={15} w={700}>
                        {fmtDate(i.rentStart)}
                      </T>
                    </View>
                    <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.greenBg, gap: 2 }}>
                      <T s={12} w={600} c={C.greenDark}>
                        Return date
                      </T>
                      <T s={15} w={700} c={C.greenDark} accessibilityLiveRegion="polite">
                        {fmtDate(i.rentEnd)}
                      </T>
                    </View>
                  </View>
                  {canExtend ? (
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <T s={13} c={err ? C.red : C.muted} lh={18.2} style={{ flex: 1 }} accessibilityLiveRegion="polite">
                        {err ? err : rate ? "Extra days " + fmt(rate) + " each" : "Extra days at the daily rate"}
                      </T>
                      <Btn title={busy === i.id ? "Extending…" : "Extend rental"} onPress={() => extendItem(i)} busy={busy === i.id} h={44} r={12} s={14} px={16} iconLeft={ICON.plus} iconSize={15} />
                    </View>
                  ) : null}
                </React.Fragment>
              );
            })}
          </Card>
        ) : null}

        {/* Order summary */}
        <Card gap={18} style={{ marginTop: 4, boxShadow: SUMMARY_SHADOW }}>
          <H s={26} lh={31} ls={-0.91} accessibilityRole="header">
            Order summary
          </H>
          <View style={{ gap: 14 }}>
            {items.map((l) => {
              const rent = l.mode === "rent";
              return (
                <OrderLine
                  key={l.id}
                  name={l.name}
                  kind={l.kind}
                  bg={l.bg}
                  qty={l.qty}
                  variant={l.variant || ""}
                  rent={rent}
                  meta={rent ? "Rental · " + dayWord(l.rentDays || 0) : "Purchase · Qty " + l.qty}
                  price={fmt(l.lineTotal + (rent ? l.extraCharge || 0 : 0))}
                />
              );
            })}
          </View>
          <View style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line, gap: 12 }}>
            {o.totals.purchases > 0 ? <SumRow label="Purchases" value={fmt(o.totals.purchases)} /> : null}
            {o.totals.discount > 0 ? <SumRow label="Discount" value={"−" + fmt(o.totals.discount)} valueColor={C.green} /> : null}
            {hasRentItems ? <SumRow label={rentItems.length === 1 ? "Rental · " + dayWord(rentItems[0].rentDays || 0) : "Rentals · " + rentItems.length + " items"} value={fmt(o.totals.rentals)} /> : null}
            <SumRow label="Delivery" value={o.totals.deliveryFee > 0 ? fmt(o.totals.deliveryFee) : "Free"} valueColor={o.totals.deliveryFee > 0 ? C.ink : C.green} />
            {o.totals.deposit > 0 ? <SumRow label="Refundable deposit" value={fmt(o.totals.deposit)} /> : null}
            <SumRow
              label={paid ? "Paid with" : "Payment"}
              value={
                pay.method === "cod"
                  ? "Pay the driver on delivery"
                  : (METHOD[pay.method] || String(pay.method).toUpperCase()) + (paid ? "" : pay.status === "failed" ? " · payment failed" : pay.status === "refunded" ? " · refunded" : " · not paid yet")
              }
              valueColor="#1F9D55"
              valueWeight={700}
            />
          </View>
          <TotalRow note={o.totals.deposit > 0 ? "+ " + fmt(o.totals.deposit) + " refundable deposit" : undefined} total={fmt(o.totals.total)} />
          {extraDays > 0 ? (
            <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.greenBg }}>
              <T s={13} c={C.greenDark} lh={19.5}>
                {"Extension of " +
                  dayWord(extraDays) +
                  (pay.method === "telebirr" ? " added. We'll send a Telebirr prompt for " : pay.method === "card" ? " added. We'll charge your card " : " added. You'll pay the extra ") +
                  fmt(extraCharge) +
                  (pay.method === "telebirr" ? " to " + payPhone + "." : pay.method === "card" ? "." : " when we collect it.")}
              </T>
            </View>
          ) : null}
        </Card>
      </View>
    </>
  );
}

function CardHead({ icon, tint, color, title }: { icon: string; tint: string; color: string; title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tint, alignItems: "center", justifyContent: "center" }}>
        <Icon xml={icon} size={22} color={color} sw={1.7} />
      </View>
      <H s={22} lh={26} ls={-0.66} accessibilityRole="header">
        {title}
      </H>
    </View>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 2 }}>
      <T s={12} w={600} c={C.muted}>
        {label}
      </T>
      {children}
    </View>
  );
}
