/*
 * Account › Rentals: active rentals (progress, extend by a day, schedule pickup), upcoming and
 * past bookings, and the "How rentals work" note.
 */
import React from "react";
import { View } from "react-native";
import { C } from "@/theme";
import { Icon, ICON, T, Tap } from "@/components/ui";
import { ProductArt } from "@/components/ProductArt";
import { EmptyBox, ExtendNote, MiniBtn, plural, ProgressBar, RentalButtons, SegTabs, StatusPill, TabTitle, type Account, type Rental, type RentFilter } from "./shared";

export function RentalsTab({ a }: { a: Account }) {
  const { active, upcoming, past } = a.rentals;
  const tab = a.rentTab;
  const tabs: { id: RentFilter; label: string; count: number }[] = [
    { id: "active", label: "Active", count: active.length },
    { id: "upcoming", label: "Upcoming", count: upcoming.length },
    { id: "past", label: "Past", count: past.length },
  ];
  const list = tab === "active" ? active : tab === "past" ? past : upcoming;

  return (
    <>
      <View style={{ gap: 24 }}>
        <TabTitle eyebrow="Rent by the day" title="My rentals" color={C.green} />
        <SegTabs label="Filter rentals" tabs={tabs} value={tab} onChange={a.setRentTab} accent={C.green} px={18} />
      </View>

      <View style={{ gap: 20 }}>
        {list.map((r) => (tab === "active" ? <ActiveCard key={r.id} r={r} a={a} /> : <OtherCard key={r.id} r={r} past={tab === "past"} />))}
        {list.length === 0 ? <EmptyBox title="Nothing here yet" text="Rentals in this state will show up here." /> : null}
      </View>

      <View style={{ backgroundColor: C.greenBg, borderRadius: 24, paddingVertical: 22, paddingHorizontal: 26, flexDirection: "row", alignItems: "center", gap: 18 }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
          <Icon xml={ICON.shield} size={22} color={C.green} sw={1.7} />
        </View>
        <View style={{ flex: 1, gap: 2, alignItems: "flex-start" }}>
          <T s={15} w={700}>
            How rentals work
          </T>
          <T s={14} c={C.text}>
            We deliver, you use it, we collect. Extend anytime before your return date; deposits come back after inspection.
          </T>
          <Tap href="/p/rental-terms" style={{ marginTop: 8 }}>
            <T s={14} w={700} c={C.green} style={{ textDecorationLine: "underline" }}>
              Rental terms
            </T>
          </Tap>
        </View>
      </View>
    </>
  );
}

const CARD = { borderWidth: 1, borderColor: C.line, borderRadius: 28, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 20, gap: 18, backgroundColor: C.white } as const;

/** Artwork panel with the status pill (and an optional dark pill on the right). */
function ArtPanel({ r, pill, right }: { r: Rental; pill: { label: string; fg: string; dot: string }; right?: string }) {
  return (
    <View style={{ height: 200, borderRadius: 22, backgroundColor: r.bg, alignItems: "center", justifyContent: "center" }}>
      <ProductArt kind={r.kind} size={124} />
      <StatusPill tone={pill} bg={C.white} style={{ position: "absolute", top: 14, left: 14, paddingHorizontal: 12 }} />
      {right ? (
        <View style={{ position: "absolute", top: 14, right: 14, height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.ink, justifyContent: "center" }}>
          <T s={12} w={700} c={C.white}>
            {right}
          </T>
        </View>
      ) : null}
    </View>
  );
}

/** Name + dates on the left, cost + deposit note on the right. */
function Summary({ r, href, sub }: { r: Rental; href?: string; sub: string }) {
  const name = (
    <T s={19} w={700} ls={-0.38}>
      {r.name}
    </T>
  );
  return (
    <View style={{ paddingHorizontal: 4, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1, gap: 4 }}>
        {href ? (
          <Tap href={href} hitSlop={0}>
            {name}
          </Tap>
        ) : (
          name
        )}
        <T s={14} c={C.text}>
          {r.startFmt + " to " + r.endFmt + " · " + plural(r.total, "day")}
        </T>
      </View>
      <View style={{ maxWidth: 110, gap: 2, alignItems: "flex-end" }}>
        <T s={17} w={700}>
          {r.costFmt}
        </T>
        <T s={12} c={C.muted} style={{ textAlign: "right" }}>
          {sub}
        </T>
      </View>
    </View>
  );
}

function ActiveCard({ r, a }: { r: Rental; a: Account }) {
  return (
    <View style={CARD}>
      <ArtPanel r={r} pill={{ label: "Active", fg: C.green, dot: "#418D4D" }} right={r.leftLabel} />
      <Summary r={r} href={r.href} sub={"+ deposit " + r.depositFmt} />
      <View style={{ paddingHorizontal: 4, gap: 8 }}>
        <ProgressBar pct={r.pct} label={r.name + " rental progress"} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <T s={13} c={C.muted}>
            {"Day " + r.elapsed + " of " + r.total}
          </T>
          <T s={13} c={C.muted}>
            {"Return by " + r.endFmt}
          </T>
        </View>
        <ExtendNote r={r} a={a} />
      </View>
      <RentalButtons r={r} a={a} />
    </View>
  );
}

/** Upcoming and past bookings. */
function OtherCard({ r, past }: { r: Rental; past: boolean }) {
  const booking = "/order-confirmed/" + r.orderId;
  return (
    <View style={CARD}>
      <ArtPanel r={r} pill={past ? { label: "Returned", fg: C.text, dot: C.faint } : { label: "Upcoming", fg: C.navy, dot: "#1679BE" }} />
      <Summary r={r} sub={past ? "Deposit refunded" : "+ deposit " + r.depositFmt} />
      <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#F6F5F1", flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon xml={ICON.truck} size={16} color={C.green} sw={1.8} />
        <T s={13} c={C.text} style={{ flex: 1 }}>
          {past ? "Returned " + r.endShort + " · deposit refunded" : "Delivery " + r.startFmt + (r.window ? ", " + r.window : "")}
        </T>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <MiniBtn title={past ? "Leave a review" : "Change dates"} tone="outlineGreen" href={past ? r.href : booking} h={46} px={6} s={14} style={{ flex: 1 }} />
        <MiniBtn title={past ? "Rent again" : "View booking"} tone="green" href={past ? r.href : booking} h={46} px={6} s={14} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
