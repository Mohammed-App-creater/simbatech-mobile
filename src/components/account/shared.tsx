/*
 * Account page: what its tabs share — Addis-time date formatting, the order / rental values the
 * website computes in AccountScreen.renderVals(), and the small UI pieces the tabs have in common.
 */
import React from "react";
import { ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { C, F } from "@/theme";
import { formatETB } from "@/lib/store";
import type { AddressDTO, OrderDTO, PaymentMethodDTO, ProductDTO, UserDTO } from "@/lib/types";
import { Field, H, Icon, ICON, PhoneField, T, Tap, type FieldProps, type PhoneFieldProps } from "@/components/ui";
import { ProductArt } from "@/components/ProductArt";

// ── Tabs ──────────────────────────────────────────────────────────────────────

export const NAV = ["overview", "orders", "rentals", "wishlist", "addresses", "payment", "settings"] as const;
export type AccountTab = (typeof NAV)[number];
export const isAccountTab = (v: unknown): v is AccountTab => NAV.includes(v as AccountTab);

export type OrderFilter = "all" | "way" | "delivered" | "cancelled";
export type RentFilter = "active" | "upcoming" | "past";

export const ORDER_TABS: { id: OrderFilter; label: string; test: (o: OrderDTO) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "way", label: "On the way", test: (o) => o.status === "PACKED" || o.status === "OUT_FOR_DELIVERY" },
  { id: "delivered", label: "Delivered", test: (o) => o.status === "DELIVERED" },
  { id: "cancelled", label: "Cancelled", test: (o) => o.status === "CANCELLED" },
];

/** Everything the tabs read and change; owned by AccountScreen so it survives switching tabs. */
export type Account = {
  user: UserDTO;
  /** the day number (Addis Ababa) the page was loaded on */
  today: number;
  todayISO: string;
  products: ProductDTO[];
  orders: OrderDTO[];
  rentals: RentalGroups;
  goTab: (tab: AccountTab) => void;
  orderTab: OrderFilter;
  setOrderTab: (t: OrderFilter) => void;
  openOrder: string | null;
  setOpenOrder: (id: string | null) => void;
  rentTab: RentFilter;
  setRentTab: (t: RentFilter) => void;
  /** rental item ids with a pickup booked */
  pickup: Record<number, boolean>;
  togglePickup: (itemId: number) => void;
  extBusy: number | null;
  extError: { id: number; message: string } | null;
  extend: (itemId: number) => void;
  addresses: AddressDTO[];
  setAddresses: (list: AddressDTO[]) => void;
  methods: PaymentMethodDTO[];
  setMethods: (list: PaymentMethodDTO[]) => void;
  notif: Record<string, boolean>;
  setNotif: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
};

// ── Dates (the shop's calendar: Addis Ababa, UTC+3, no DST) ───────────────────

export const DAY = 86_400_000;
const TZ_OFFSET = 3 * 3_600_000;
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WDL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MOL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Local (Addis) calendar day number of an ISO timestamp. */
export const dayNo = (iso: string) => Math.floor((Date.parse(iso) + TZ_OFFSET) / DAY);
// A Date whose UTC fields are the Addis calendar day of `iso`.
const local = (iso: string) => new Date(Date.parse(iso) + TZ_OFFSET);
/** "Sat 3 Oct" */
export const dFmt = (iso: string) => {
  const d = local(iso);
  return WD[d.getUTCDay()] + " " + d.getUTCDate() + " " + MO[d.getUTCMonth()];
};
/** "3 Oct" */
export const dShort = (iso: string) => {
  const d = local(iso);
  return d.getUTCDate() + " " + MO[d.getUTCMonth()];
};
/** "3 Oct 2026" */
export const dLong = (iso: string) => dShort(iso) + " " + local(iso).getUTCFullYear();
/** "3 Oct, 16:26" */
export const stamp = (iso: string) => {
  const d = local(iso);
  const hh = d.getUTCHours();
  const mm = d.getUTCMinutes();
  return dShort(iso) + ", " + (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
};
/** "Wednesday, 30 September" */
export const dayLabel = (iso: string) => {
  const d = local(iso);
  return WDL[d.getUTCDay()] + ", " + d.getUTCDate() + " " + MOL[d.getUTCMonth()];
};
export const yearOf = (iso: string) => local(iso).getUTCFullYear();

export const plural = (n: number, w: string) => n + " " + w + (n === 1 ? "" : "s");
export const errText = (err: unknown): string => {
  const message = err ? (err as { message?: unknown }).message : null;
  return typeof message === "string" && message ? message : "Something went wrong. Please try again.";
};
export const PHONE_HINT = "Enter the 9 digits after +251, starting with 9 or 7 (e.g. 911 234 567).";
export const RED = "#B02418";

// ── Orders ────────────────────────────────────────────────────────────────────

export type Tone = { label: string; bg: string; fg: string; dot: string };

const ST: Record<string, Tone> = {
  out: { label: "Out for delivery", bg: "#EAF3FA", fg: "#0D4F8B", dot: "#1679BE" },
  processing: { label: "Processing", bg: "#FFF0E0", fg: "#9A4A06", dot: "#F08A24" },
  delivered: { label: "Delivered", bg: "#E4F2E6", fg: "#2F7A3C", dot: "#418D4D" },
  cancelled: { label: "Cancelled", bg: "#FDECEA", fg: "#B02418", dot: "#C42A1C" },
};
const STATUS_KEY: Record<string, string> = { PLACED: "processing", PACKED: "processing", OUT_FOR_DELIVERY: "out", DELIVERED: "delivered", CANCELLED: "cancelled" };
const TRACK = [
  { status: "PLACED", label: "Ordered" },
  { status: "PACKED", label: "Packed" },
  { status: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { status: "DELIVERED", label: "Delivered" },
];
const METHOD: Record<string, string> = { telebirr: "Telebirr", card: "card", cod: "cash on delivery" };
const PAY_STATUS: Record<string, Tone> = {
  paid: { label: "Paid", bg: "#E4F2E6", fg: "#2F7A3C", dot: "#418D4D" },
  pending: { label: "Payment pending", bg: "#FFF0E0", fg: "#9A4A06", dot: "#F08A24" },
  failed: { label: "Payment failed", bg: "#FDECEA", fg: "#B02418", dot: "#C42A1C" },
  refunded: { label: "Refunded", bg: "#EAF3FA", fg: "#0D4F8B", dot: "#1679BE" },
};

export type OrderItem = {
  id: number;
  productSlug: string | null;
  rentRate: number | null;
  name: string;
  kind: string;
  bg: string;
  mode: "buy" | "rent";
  lineTotal: number;
  rentStart: string | null;
  rentEnd: string | null;
  rentDays: number | null;
  deposit: number;
  rentalStatus: string | null;
  extendedDays: number;
  extraCharge: number;
};

export const itemHref = (item: { productSlug?: string | null } | undefined) => (item && item.productSlug ? "/product/" + item.productSlug : "/shop");

export type TimelineStep = { label: string; time: string; done: boolean; current: boolean; dotBg: string; dotBorder: string; lineBg: string; labelFg: string };

/** The values an order row / card shows (status pill, headline, tracking timeline, actions). */
export function decorateOrder(o: OrderDTO) {
  const items: OrderItem[] = o.items || [];
  const pay = o.payment || {};
  const at: Record<string, string> = {};
  (o.events || []).forEach((e: { status: string; at: string }) => {
    at[e.status] = e.at;
  });
  const cancelled = o.status === "CANCELLED";
  let raw: { label: string; time: string; state: "done" | "current" | "todo" | "cancel" }[];
  if (cancelled) {
    raw = [
      { label: "Ordered", time: stamp(o.createdAt), state: "done" },
      { label: "Cancelled", time: at.CANCELLED ? stamp(at.CANCELLED) : "", state: "cancel" },
    ];
    if (pay.status === "refunded") raw.push({ label: "Refund issued", time: "Refunded", state: "done" });
  } else {
    const reached = o.step || 0;
    raw = TRACK.map((t, i) => {
      const state = i <= reached ? "done" : i === reached + 1 ? "current" : "todo";
      const time = at[t.status] ? stamp(at[t.status]) : state === "current" ? "In progress" : i === 3 && o.deliveryDate ? "Expected " + dFmt(o.deliveryDate) : "Pending";
      return { label: i === 1 && state === "current" ? "Packing" : t.label, time, state };
    });
  }
  let lastDone = -1;
  raw.forEach((x, i) => {
    if (x.state !== "todo") lastDone = i;
  });
  const steps: TimelineStep[] = raw.map((x, i) => {
    const done = x.state === "done";
    const cancel = x.state === "cancel";
    const cur = x.state === "current";
    const col = cancel ? "#C42A1C" : C.navy;
    return {
      label: x.label,
      time: x.time,
      done: done || cancel,
      current: cur,
      dotBg: done || cancel ? col : C.white,
      dotBorder: done || cancel ? col : cur ? "#1679BE" : "#C9C6BE",
      lineBg: i === raw.length - 1 ? "transparent" : i < lastDone ? C.navy : "#D9D6CE",
      labelFg: x.state === "todo" ? C.muted : cancel ? RED : C.ink,
    };
  });

  const key = STATUS_KEY[o.status] || "processing";
  const pickupOrder = o.fulfilment === "pickup";
  const slot = o.deliveryDate ? dFmt(o.deliveryDate) + (o.deliveryWindow ? ", " + o.deliveryWindow : "") : "";
  const headline =
    key === "cancelled"
      ? "Cancelled" + (pay.status === "refunded" ? " · refunded" : "")
      : key === "delivered"
        ? (pickupOrder ? "Collected " : "Delivered ") + dFmt(at.DELIVERED || o.createdAt)
        : key === "out"
          ? "Arriving " + (slot || "soon")
          : pickupOrder
            ? "Ready for pickup " + (slot || "soon")
            : slot
              ? "Expected by " + dFmt(o.deliveryDate)
              : "Being packed";
  const inProgress = key === "out" || key === "processing";
  const finished = key === "delivered" || key === "cancelled";
  const payKey = PAY_STATUS[pay.status] ? pay.status : "pending";
  const payStatus: Tone = payKey === "pending" && pay.method === "cod" ? { ...PAY_STATUS.pending, label: "Pay on delivery" } : PAY_STATUS[payKey];

  return {
    id: o.id,
    no: o.number,
    date: dLong(o.createdAt),
    st: ST[key],
    items,
    itemCount: plural(items.length, "item"),
    names: items.map((i) => i.name).join(", "),
    totalFmt: formatETB(o.totals.total),
    headline,
    trackingNo: "Tracking no. " + o.number,
    where: (o.address ? o.address.line1 + ", " + o.address.city : "Pick up in store") + " · " + (pay.status === "paid" ? "Paid with " : "Paying with ") + (METHOD[pay.method] || pay.method),
    steps,
    cta: finished ? "Buy again" : "View items",
    ctaHref: finished ? itemHref(items[0]) : "/order-confirmed/" + o.id,
    trackText: inProgress ? "Track" : "Details",
    trackLabel: (inProgress ? "Track order " : "Order details ") + o.number,
    trackHref: "/order-confirmed/" + o.id,
    payStatus,
    payable: !!pay.payable && !cancelled,
  };
}

// ── Rentals (items with mode "rent" on orders that weren't cancelled) ─────────

export type Rental = {
  id: number;
  orderId: string;
  name: string;
  kind: string;
  bg: string;
  href: string;
  end: number;
  startDay: number;
  started: boolean;
  status: string | null;
  rateFmt: string;
  startFmt: string;
  endFmt: string;
  endShort: string;
  total: number;
  elapsed: number;
  pct: number;
  leftLabel: string;
  leftFg: string;
  extendedDays: number;
  extraCharge: number;
  costFmt: string;
  deposit: number;
  depositFmt: string;
  window: string | null;
  pickupTime: string;
};

export type RentalGroups = { all: Rental[]; current: Rental[]; active: Rental[]; upcoming: Rental[]; past: Rental[] };

export function rentalGroups(orders: OrderDTO[], today: number): RentalGroups {
  const all: Rental[] = [];
  orders.forEach((o) => {
    if (o.status === "CANCELLED") return;
    (o.items as OrderItem[]).forEach((r) => {
      if (r.mode !== "rent" || !r.rentStart || !r.rentEnd) return;
      const rate = r.rentRate || (r.extendedDays ? Math.round((r.extraCharge || 0) / r.extendedDays) : 0);
      const start = dayNo(r.rentStart);
      const end = dayNo(r.rentEnd);
      const total = Math.max(1, end - start);
      const started = today >= start;
      const left = Math.max(0, end - today);
      const elapsed = started ? Math.min(total, Math.max(1, today - start + 1)) : 0;
      all.push({
        id: r.id,
        orderId: o.id,
        name: r.name,
        kind: r.kind,
        bg: r.bg,
        href: itemHref(r),
        end,
        startDay: start,
        started,
        status: r.rentalStatus,
        rateFmt: rate ? formatETB(rate) : "day rate",
        startFmt: dFmt(r.rentStart),
        endFmt: dFmt(r.rentEnd),
        endShort: dShort(r.rentEnd),
        total,
        elapsed,
        pct: Math.round((elapsed / total) * 100),
        leftLabel: !started ? "Starts " + dShort(r.rentStart) : left === 0 ? "Due today" : plural(left, "day") + " left",
        leftFg: left <= 2 ? "#9A4A06" : C.green,
        extendedDays: r.extendedDays || 0,
        extraCharge: r.extraCharge || 0,
        costFmt: formatETB(r.lineTotal + (r.extraCharge || 0)),
        deposit: r.deposit || 0,
        depositFmt: formatETB(r.deposit || 0),
        window: o.deliveryWindow || null,
        pickupTime: o.deliveryWindow || "9am – 8pm",
      });
    });
  });
  // Overview: everything not yet returned (scheduled or active), soonest return first.
  const current = all.filter((r) => r.status === "scheduled" || r.status === "active").sort((x, y) => x.end - y.end);
  // Rentals tab: active = started, upcoming = not started yet, past = returned.
  return {
    all,
    current,
    active: current.filter((r) => r.status === "active" || r.started),
    upcoming: current.filter((r) => r.status !== "active" && !r.started).sort((x, y) => x.startDay - y.startDay),
    past: all.filter((r) => r.status === "returned").sort((x, y) => y.end - x.end),
  };
}

// ── Icons the account page adds to the shared set ─────────────────────────────

export const AI = {
  overview:
    '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="4" rx="1.5"/><rect x="13" y="10" width="7" height="10" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/>',
  orders: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  payment: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  admin: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/>',
  signOut: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  headset: '<path d="M4 13a8 8 0 0 1 16 0"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/>',
} as const;

// ── UI pieces ─────────────────────────────────────────────────────────────────

/** Small uppercase label + the tab's big heading ("PURCHASES / My orders"). */
export function TabTitle({ eyebrow, title, color = C.navy }: { eyebrow: string; title: string; color?: string }) {
  return (
    <View style={{ gap: 10 }}>
      <T s={13} w={700} c={color} ls={1.3} upper>
        {eyebrow}
      </T>
      <H s={48} lh={48} ls={-2.16} accessibilityRole="header">
        {title}
      </H>
    </View>
  );
}

/** Status pill with a coloured dot ("● Delivered"). */
export function StatusPill({ tone, h = 28, bg, style }: { tone: Pick<Tone, "label" | "fg" | "dot"> & { bg?: string }; h?: number; bg?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ alignSelf: "flex-start", height: h, paddingHorizontal: h >= 28 ? 11 : 10, borderRadius: 999, backgroundColor: bg ?? tone.bg, flexDirection: "row", alignItems: "center", gap: h >= 28 ? 7 : 6 }, style]}>
      <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: tone.dot }} />
      <T s={12} w={700} c={tone.fg}>
        {tone.label}
      </T>
    </View>
  );
}

/** The sand-coloured segmented filter with a count on each tab (orders / rentals). */
export function SegTabs<Id extends string>({ tabs, value, onChange, label, accent = C.navy, px = 16 }: { tabs: { id: Id; label: string; count: number }[]; value: Id; onChange: (id: Id) => void; label: string; accent?: string; px?: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{ flexGrow: 0, alignSelf: "flex-start", maxWidth: "100%", borderRadius: 14, backgroundColor: C.sand }}
      contentContainerStyle={{ padding: 4, gap: 4 }}
    >
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <Tap
            key={t.id}
            onPress={() => onChange(t.id)}
            hitSlop={0}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[{ height: 44, paddingHorizontal: px, borderRadius: 11, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: on ? C.white : "transparent" }, on && { boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }]}
          >
            <T s={14} w={600} c={on ? C.ink : C.muted}>
              {t.label}
            </T>
            <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 999, backgroundColor: on ? accent : C.lineStrong, alignItems: "center", justifyContent: "center" }}>
              <T s={11} w={700} c={on ? C.white : C.text} lh={14}>
                {t.count}
              </T>
            </View>
          </Tap>
        );
      })}
    </ScrollView>
  );
}

/** Dashed placeholder shown when a list is empty. */
export function EmptyBox({ title, text, h = 200, children, style }: { title: string; text?: string; h?: number; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ minHeight: h, padding: 24, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.lineStrong, borderRadius: 24, alignItems: "center", justifyContent: "center", gap: 8 }, style]}>
      <T s={17} w={700} center>
        {title}
      </T>
      {text ? (
        <T s={15} c={C.muted} center>
          {text}
        </T>
      ) : null}
      {children}
    </View>
  );
}

/** Product artwork on its coloured tile. */
export function Thumb({ kind, bg, size, art, r }: { kind: string; bg: string; size: number; art: number; r: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <ProductArt kind={kind} size={art} />
    </View>
  );
}

export function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ height: 10, borderRadius: 999, backgroundColor: "#F1EEE8", overflow: "hidden" }}>
      <View style={{ width: `${pct}%`, height: 10, borderRadius: 999, backgroundColor: "#418D4D" }} />
    </View>
  );
}

/** "Extended by 1 day · ETB 3,500 added to your bill", or the error from the last attempt. */
export function ExtendNote({ r, a }: { r: Rental; a: Account }) {
  const err = a.extError && a.extError.id === r.id ? a.extError.message : "";
  if (!err && r.extendedDays <= 0) return null;
  return (
    <T s={13} w={600} c={err ? RED : C.green} accessibilityLiveRegion="polite">
      {err || "Extended by " + plural(r.extendedDays, "day") + " · " + formatETB(r.extraCharge) + " added to your bill"}
    </T>
  );
}

/** "Extend +1 day" and "Schedule pickup" (or the booked pickup, tap to cancel) under a rental. */
export function RentalButtons({ r, a, detailed = false }: { r: Rental; a: Account; detailed?: boolean }) {
  const busy = a.extBusy === r.id;
  const booked = !!a.pickup[r.id];
  const extendLabel = detailed ? (busy ? "Extending… · " : "Extend +1 day · ") + r.rateFmt : busy ? "Extending…" : "Extend +1 day";
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Tap
        onPress={() => a.extend(r.id)}
        disabled={busy}
        hitSlop={0}
        label={"Extend " + r.name + " by one day"}
        style={{ flex: 1, minHeight: 46, paddingHorizontal: 6, paddingVertical: 4, borderWidth: 1, borderColor: C.green, borderRadius: 12, backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
        pressedStyle={{ backgroundColor: C.greenBg }}
      >
        <Icon xml={ICON.plus} size={16} color={C.green} sw={2.2} />
        <T s={14} w={700} c={C.green} center style={{ flexShrink: 1 }}>
          {extendLabel}
        </T>
      </Tap>
      {booked ? (
        <Tap
          onPress={() => a.togglePickup(r.id)}
          hitSlop={0}
          label={"Pickup booked for " + r.endFmt + ". Select to cancel"}
          style={{ flex: 1, minHeight: 46, paddingHorizontal: 6, paddingVertical: 4, borderWidth: 1.5, borderColor: "#CFE6D3", borderRadius: 12, backgroundColor: C.greenBg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Icon xml={ICON.check} size={16} color={C.green} sw={2.2} />
          <T s={14} w={700} c={C.green} center style={{ flexShrink: 1 }}>
            {"Pickup " + r.endShort + ", " + r.pickupTime}
          </T>
        </Tap>
      ) : (
        <Tap
          onPress={() => a.togglePickup(r.id)}
          hitSlop={0}
          style={{ flex: 1, minHeight: 46, paddingHorizontal: 6, borderRadius: 12, backgroundColor: C.green, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
          pressedStyle={{ backgroundColor: "#276833" }}
        >
          {detailed ? <Icon xml={ICON.truck} size={16} color={C.white} sw={1.8} /> : null}
          <T s={14} w={700} c={C.white} center style={{ flexShrink: 1 }}>
            Schedule pickup
          </T>
        </Tap>
      )}
    </View>
  );
}

type MiniTone = "navy" | "green" | "outline" | "outlineGreen" | "plainNavy" | "plainRed";
const MINI: Record<MiniTone, { bg: string; fg: string; border?: string; pressed: string }> = {
  navy: { bg: C.navy, fg: C.white, pressed: C.navySoft },
  green: { bg: C.green, fg: C.white, pressed: "#276833" },
  outline: { bg: C.white, fg: C.ink, border: C.lineStrong, pressed: "#F1F0EC" },
  outlineGreen: { bg: C.white, fg: C.green, border: C.green, pressed: C.greenBg },
  plainNavy: { bg: "transparent", fg: C.navy, pressed: "#F1F0EC" },
  plainRed: { bg: "transparent", fg: RED, pressed: "#F1F0EC" },
};

/** Small button used inside cards (44 high, radius 12): filled, outlined or text-only. */
export function MiniBtn({ title, onPress, href, tone = "navy", fg, disabled, label, h = 44, px = 16, s = 13, style }: { title: string; onPress?: () => void; href?: string; tone?: MiniTone; fg?: string; disabled?: boolean; label?: string; h?: number; px?: number; s?: number; style?: StyleProp<ViewStyle> }) {
  const look = MINI[tone];
  return (
    <Tap
      onPress={onPress}
      href={href}
      disabled={disabled}
      hitSlop={2}
      label={label}
      style={[{ height: h, paddingHorizontal: px, borderRadius: 12, backgroundColor: look.bg, alignItems: "center", justifyContent: "center" }, look.border ? { borderWidth: tone === "outlineGreen" ? 1.5 : 1, borderColor: look.border } : null, style]}
      pressedStyle={{ backgroundColor: look.pressed }}
    >
      <T s={s} w={700} c={fg ?? look.fg} numberOfLines={1}>
        {title}
      </T>
    </Tap>
  );
}

/** The dashed "+ Add …" tile at the end of the address / payment grids. */
export function AddTile({ title, onPress, disabled, width, h }: { title: string; onPress: () => void; disabled?: boolean; width: number; h: number }) {
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      hitSlop={0}
      style={{ width, minHeight: h, padding: 8, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#C9C6BE", borderRadius: 24, backgroundColor: "#F6F5F1", alignItems: "center", justifyContent: "center", gap: 10, opacity: disabled ? 0.6 : 1 }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
        <Icon xml={ICON.plus} size={18} color={C.navy} sw={2.2} />
      </View>
      <T s={15} w={700} c={C.navy} center>
        {title}
      </T>
    </Tap>
  );
}

// ── Form pieces (the site's 50px inputs with a 13px label above) ──────────────

const BOX = { borderWidth: 1 } as const;
const INPUT = { fontFamily: F.g600 } as const;

export function AField({ label, ...rest }: FieldProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T s={13} w={600}>
        {label}
      </T>
      <Field h={50} r={14} accessibilityLabel={label} {...rest} boxStyle={[BOX, { paddingHorizontal: 16 }]} style={INPUT} />
    </View>
  );
}

export function APhone({ label, ...rest }: PhoneFieldProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T s={13} w={600}>
        {label}
      </T>
      <PhoneField h={50} r={14} accessibilityLabel={label} {...rest} boxStyle={BOX} style={INPUT} />
    </View>
  );
}

/** Form-level error line (12px, the site's alert red). */
export function FormError({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <T s={12} c={RED} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {children}
    </T>
  );
}

/** "Save …" + "Cancel" under the inline address / payment forms. */
export function FormActions({ saveLabel, busy, onSave, onCancel }: { saveLabel: string; busy: boolean; onSave: () => void; onCancel: () => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <MiniBtn title={saveLabel} tone="green" onPress={onSave} disabled={busy} px={14} />
      <MiniBtn title="Cancel" tone="plainNavy" onPress={onCancel} px={14} />
    </View>
  );
}

/** Blue-tinted switch inside the payment form (Telebirr / Card, Visa / Mastercard). */
export function Segment<Id extends string>({ options, value, onChange, label }: { options: { id: Id; label: string }[]; value: Id; onChange: (id: Id) => void; label: string }) {
  return (
    <View accessibilityLabel={label} style={{ alignSelf: "flex-start", flexDirection: "row", gap: 2, padding: 3, borderRadius: 12, backgroundColor: C.sky }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Tap key={o.id} onPress={() => onChange(o.id)} hitSlop={4} accessibilityState={{ selected: on }} style={{ height: 30, paddingHorizontal: 14, borderRadius: 9, backgroundColor: on ? C.navy : "transparent", justifyContent: "center" }}>
            <T s={13} w={600} c={on ? C.white : C.navy}>
              {o.label}
            </T>
          </Tap>
        );
      })}
    </View>
  );
}
