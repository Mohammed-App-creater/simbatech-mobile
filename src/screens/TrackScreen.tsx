/*
 * /track — public order lookup: order number + the phone used on the order → the tracking
 * timeline (Placed / Packed / Out for delivery / Delivered), the delivery details, the items and
 * the totals. ?number=…&phone=… prefills the form and looks the order up straight away.
 */
import React, { useEffect, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { C, GUTTER } from "@/theme";
import { isCompletePhone } from "@/lib/phone";
import { bootstrap, formatETB, trackOrder } from "@/lib/store";
import type { OrderDTO } from "@/lib/types";
import { Screen } from "@/components/Screen";
import { ProductArt } from "@/components/ProductArt";
import { fmtDate, fmtDay, fmtStamp, fmtTime } from "@/components/pages/dates";
import { PageEyebrow, PageIntro } from "@/components/pages/PageIntro";
import { Btn, Field, H, Icon, ICON, PhoneField, T } from "@/components/ui";

const TRACK = [
  { status: "PLACED", label: "Placed" },
  { status: "PACKED", label: "Packed" },
  { status: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { status: "DELIVERED", label: "Delivered" },
];
const HEADINGS = ["Your purchases are being packed", "Your order is packed and ready to go", "Your order is out for delivery", "Your order has been delivered"];
const METHOD: Record<string, string> = { telebirr: "TELEBIRR", card: "CARD", cod: "PAY ON DELIVERY" };
const FAILED = "Something went wrong. Please try again.";
// non-breaking space and word joiner: keep "12pm – 3pm" together on one line
const NBSP = String.fromCharCode(160);
const NOBREAK = (s: string) => s.replace(/ /g, NBSP).replace(/([–-])/g, "$1" + String.fromCharCode(0x2060));

const dayWord = (n: number) => n + (n === 1 ? " day" : " days");
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

const CARD = { borderWidth: 1, borderColor: C.line, borderRadius: 28, padding: 28, backgroundColor: C.white } as const;

export default function TrackScreen() {
  const params = useLocalSearchParams<{ number?: string; phone?: string }>();
  const number = one(params.number);
  const phone = one(params.phone);
  // a link to another order starts the page afresh
  return <Track key={number + "|" + phone} initNumber={number} initPhone={phone} />;
}

function Track({ initNumber, initPhone }: { initNumber: string; initPhone: string }) {
  const [number, setNumber] = useState(initNumber);
  const [phone, setPhone] = useState(initPhone);
  // /track?number=…&phone=… looks the order up straight away (the page starts in the busy state)
  const auto = !!(initNumber && initPhone);
  const [busy, setBusy] = useState(auto);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderDTO | null>(null);
  // what the order on screen was found with, for pull to refresh
  const shown = useRef<{ number: string; phone: string } | null>(null);

  useEffect(() => {
    if (!auto) return undefined;
    let stale = false;
    const n = initNumber.trim();
    const p = initPhone.trim();
    trackOrder(n, p)
      .then(
        (o) => {
          if (stale) return;
          shown.current = { number: n, phone: p };
          setOrder(o);
        },
        (err) => {
          if (!stale) setError((err && err.message) || FAILED);
        },
      )
      .then(() => {
        if (!stale) setBusy(false);
      });
    return () => {
      stale = true;
    };
  }, [auto, initNumber, initPhone]);

  const submit = async () => {
    if (busy) return;
    const n = number.trim();
    const p = phone.trim();
    if (!n || !p) {
      setError("Enter your order number and the phone number used on the order.");
      return;
    }
    if (!isCompletePhone(p)) {
      setError("Enter the 9 digits after +251, starting with 9 or 7 (e.g. 911 234 567).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const o = await trackOrder(n, p);
      shown.current = { number: n, phone: p };
      setOrder(o);
    } catch (err: any) {
      shown.current = null;
      setOrder(null);
      setError((err && err.message) || FAILED);
    } finally {
      setBusy(false);
    }
  };

  // pull to refresh re-reads the order on screen (its status moves as the store works on it)
  const refresh = async () => {
    const last = shown.current;
    await Promise.all([bootstrap(), last ? trackOrder(last.number, last.phone).then((o) => shown.current === last && setOrder(o)).catch(() => {}) : null]);
  };

  return (
    <Screen onRefresh={refresh}>
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 48, gap: 32 }}>
        <PageIntro eyebrow="Customer care" title="Track your order" summary="Enter your order number and the phone number you used at checkout. No sign-in needed." />
        <View style={[CARD, { gap: 18 }]}>
          <View style={{ gap: 16 }}>
            <Field
              label="Order number"
              r={14}
              boxStyle={{ paddingHorizontal: 16 }}
              placeholder="ST-123456"
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="next"
              value={number}
              onChangeText={(text) => {
                setNumber(text.toUpperCase());
                setError("");
              }}
              onSubmitEditing={submit}
            />
            <PhoneField
              label="Phone number"
              r={14}
              value={phone}
              onChangeText={(local) => {
                setPhone(local);
                setError("");
              }}
              returnKeyType="search"
              onSubmitEditing={submit}
            />
          </View>
          <View style={{ gap: 16 }}>
            <Btn title={busy ? "Looking up…" : "Track order"} onPress={submit} busy={busy} h={54} s={16} px={28} icon={ICON.arrowRight} />
            {error ? (
              <T s={13} w={600} c={C.red} accessibilityLiveRegion="polite">
                {error}
              </T>
            ) : (
              <T s={13} c={C.muted}>
                Your order number is in your confirmation SMS and email.
              </T>
            )}
          </View>
        </View>
      </View>
      {order ? (
        <View style={{ paddingHorizontal: GUTTER, paddingTop: 24, gap: 24 }}>
          <View style={{ gap: 20 }}>
            <Timeline order={order} />
            <DeliveryCard order={order} />
          </View>
          <Summary order={order} />
        </View>
      ) : null}
    </Screen>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

// The timeline steps, computed exactly like the confirmation page does.
function trackSteps(o: OrderDTO) {
  const cancelled = o.status === "CANCELLED";
  const step: number = o.step || 0;
  const current = cancelled ? -1 : step + 1;
  const eventAt: Record<string, string> = {};
  (o.events || []).forEach((e: { status: string; at: string }) => {
    eventAt[e.status] = e.at;
  });
  const slotShort = o.deliveryDate ? fmtDay(o.deliveryDate) + (o.deliveryWindow ? ", " + o.deliveryWindow : "") : "";
  return TRACK.map((t, i) => {
    const done = !cancelled && i <= step;
    const cur = i === current;
    const time = eventAt[t.status] ? fmtStamp(eventAt[t.status]) : i === 1 ? "Expected soon" : i === 2 ? slotShort || "To be scheduled" : o.deliveryDate ? fmtDay(o.deliveryDate) : "To be scheduled";
    return {
      label: t.label,
      time,
      done,
      cur,
      last: i === TRACK.length - 1,
      state: done ? "Done" : cur ? "In progress" : cancelled ? "Cancelled" : "Pending",
      stateFg: done ? C.green : cur ? C.navy : C.muted,
      ring: done ? C.green : cur ? C.blue : "#D5D3CC",
      bg: done ? C.green : C.white,
      dotBg: cur ? C.blue : "#D5D3CC",
      labelFg: done || cur ? C.ink : C.muted,
      lineBg: done && i < step ? C.green : C.line,
    };
  });
}

function Timeline({ order: o }: { order: OrderDTO }) {
  const cancelled = o.status === "CANCELLED";
  const steps = trackSteps(o);
  const events: { at: string }[] = o.events || [];
  const lastEvent = events[events.length - 1];
  return (
    <View style={[CARD, { gap: 24 }]}>
      <View style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <PageEyebrow>Live tracking</PageEyebrow>
          <H s={26} lh={31} ls={-0.91} accessibilityRole="header">
            {cancelled ? "This order was cancelled" : HEADINGS[Math.min(o.step || 0, 3)]}
          </H>
        </View>
        <View style={{ alignSelf: "flex-start", height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.sky, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: C.blue, boxShadow: "0 0 0 4px rgba(22,121,190,0.2)" }} />
          <T s={13} w={600} c={C.navy}>
            {lastEvent ? "Updated " + fmtTime(lastEvent.at) : "Placed " + fmtDay(o.createdAt)}
          </T>
        </View>
      </View>
      {/* the steps, top to bottom, joined by a line */}
      <View accessibilityRole="list">
        {steps.map((t) => (
          <View key={t.label} style={{ flexDirection: "row", paddingHorizontal: 8, gap: 14 }} accessibilityLabel={t.label + ", " + t.time + ", " + t.state}>
            <View style={{ width: 40, alignItems: "center" }}>
              <View
                style={[
                  { width: 40, height: 40, borderRadius: 999, borderWidth: 2, borderColor: t.ring, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" },
                  t.cur && { boxShadow: "0 0 0 6px rgba(22,121,190,0.15)" },
                ]}
              >
                {t.done ? <Icon xml={ICON.check} size={18} color={C.white} sw={2.6} /> : <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: t.dotBg }} />}
              </View>
              {t.last ? null : <View style={{ width: 2, flex: 1, minHeight: 22, marginVertical: 4, borderRadius: 999, backgroundColor: t.lineBg }} />}
            </View>
            <View style={{ flex: 1, paddingTop: 8, paddingBottom: 18, gap: 3 }}>
              <T s={15} w={700} c={t.labelFg}>
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
    </View>
  );
}

// ── Delivery details ──────────────────────────────────────────────────────────

/** A "label … value" line; long values wrap and stay right-aligned. */
function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <T s={15} c={C.text}>
        {label}
      </T>
      <T s={15} w={bold ? 700 : 600} c={color} style={{ flex: 1, textAlign: "right" }}>
        {value}
      </T>
    </View>
  );
}

function DeliveryCard({ order: o }: { order: OrderDTO }) {
  const pickup = o.fulfilment === "pickup" || !o.address;
  const slot = o.deliveryDate ? fmtDate(o.deliveryDate) + (o.deliveryWindow ? " · " + NOBREAK(String(o.deliveryWindow)) : "") : "To be scheduled";
  return (
    <View style={[CARD, { gap: 18 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.sky, alignItems: "center", justifyContent: "center" }}>
          <Icon xml={ICON.truck} size={22} color={C.navy} sw={1.7} />
        </View>
        <H s={22} lh={26} ls={-0.66} accessibilityRole="header">
          {pickup ? "Store pick-up" : "Delivery"}
        </H>
      </View>
      <View style={{ gap: 12 }}>
        <Row label="Order number" value={o.number} bold />
        <Row label="Placed" value={fmtDate(o.createdAt)} />
        <Row label={pickup ? "Ready for pick-up" : "Delivery slot"} value={slot} />
        {pickup ? null : <Row label="Address" value={o.address.line1 + (o.address.area ? ", " + o.address.area : "") + (o.address.city ? ", " + o.address.city : "")} />}
      </View>
    </View>
  );
}

// ── Order summary ─────────────────────────────────────────────────────────────

function Summary({ order: o }: { order: OrderDTO }) {
  const { width } = useWindowDimensions();
  const items: any[] = o.items || [];
  const rentItems = items.filter((i) => i.mode === "rent");
  const t = o.totals || {};
  const pay = o.payment || {};
  // the site's total: clamp(24px, 6vw, 32px)
  const totalSize = Math.min(32, Math.max(24, width * 0.06));
  return (
    <View style={[CARD, { gap: 18, boxShadow: "0 24px 60px -32px rgba(13,79,139,0.35)" }]}>
      <H s={26} lh={31} ls={-0.91} accessibilityRole="header">
        Order summary
      </H>
      <View style={{ gap: 14 }}>
        {items.map((l, i) => {
          const rent = l.mode === "rent";
          return (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: l.bg, alignItems: "center", justifyContent: "center" }}>
                <ProductArt kind={l.kind} size={54} />
                <View style={{ position: "absolute", top: -6, right: -6, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 999, backgroundColor: rent ? C.green : C.navy, alignItems: "center", justifyContent: "center" }}>
                  <T s={11} w={700} c={C.white}>
                    {l.qty}
                  </T>
                </View>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T s={14} w={700}>
                  {l.name + (l.variant ? " · " + l.variant : "")}
                </T>
                <T s={12} w={600} c={rent ? C.green : C.muted}>
                  {rent ? "Rental · " + dayWord(l.rentDays || 0) : "Purchase · Qty " + l.qty}
                </T>
              </View>
              <T s={14} w={700}>
                {formatETB(l.lineTotal + (rent ? l.extraCharge || 0 : 0))}
              </T>
            </View>
          );
        })}
      </View>
      <View style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line, gap: 12 }}>
        {t.purchases > 0 ? <Row label="Purchases" value={formatETB(t.purchases)} /> : null}
        {t.discount > 0 ? <Row label="Discount" value={"−" + formatETB(t.discount)} color={C.green} /> : null}
        {rentItems.length > 0 ? (
          <Row label={rentItems.length === 1 ? "Rental · " + dayWord(rentItems[0].rentDays || 0) : "Rentals · " + rentItems.length + " items"} value={formatETB(t.rentals || 0)} />
        ) : null}
        {t.deliveryFee > 0 ? <Row label="Delivery" value={formatETB(t.deliveryFee)} /> : <Row label="Delivery" value="Free" color={C.green} />}
        {t.deposit > 0 ? <Row label="Refundable deposit" value={formatETB(t.deposit)} /> : null}
        <Row
          label={pay.status === "paid" ? "Paid with" : "Payment"}
          value={(METHOD[pay.method] || String(pay.method || "").toUpperCase()) + (pay.status === "paid" || !pay.status ? "" : " · " + pay.status)}
          bold
          color="#1F9D55"
        />
      </View>
      <View style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T s={16} w={700}>
            Total
          </T>
          {t.deposit > 0 ? (
            <T s={12} c={C.muted}>
              {"+ " + formatETB(t.deposit) + " refundable deposit"}
            </T>
          ) : null}
        </View>
        <H s={totalSize} lh={totalSize * 1.18} ls={-0.035 * totalSize}>
          {formatETB(t.total || 0)}
        </H>
      </View>
    </View>
  );
}
