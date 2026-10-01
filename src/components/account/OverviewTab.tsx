/*
 * Account › Overview: greeting, the four stat tiles, active rentals (extend / schedule pickup),
 * recent orders, deposit refunds and the rental-bundles banner.
 */
import React from "react";
import { useWindowDimensions, View } from "react-native";
import { C, GUTTER } from "@/theme";
import { formatETB, storeVals, useShop } from "@/lib/store";
import { Btn, H, Icon, ICON, Serif, T, Tap } from "@/components/ui";
import { ProductArt } from "@/components/ProductArt";
import { dayLabel, decorateOrder, EmptyBox, ExtendNote, plural, ProgressBar, RentalButtons, StatusPill, Thumb, type Account, type Rental } from "./shared";

export function OverviewTab({ a }: { a: Account }) {
  const shop = useShop();
  const store = storeVals(shop);
  const { width } = useWindowDimensions();
  const tileW = (width - GUTTER * 2 - 16) / 2;
  const firstName = (a.user.name || "").trim().split(/\s+/)[0] || "there";
  const { current, all } = a.rentals;
  const onTheWay = a.orders.filter((o) => o.status === "PACKED" || o.status === "OUT_FOR_DELIVERY").length;
  const outToday = a.orders.filter((o) => o.status === "OUT_FOR_DELIVERY").length;
  const depositsHeld = current.reduce((t, r) => t + r.deposit, 0);
  const wishOnSale = shop.wishlist.filter((id) => !!a.products.find((p) => p.id === id)?.was).length;
  // Deposit refunds: returned rentals are refunded, everything else is held.
  const deposits = all.filter((r) => r.deposit > 0).slice(0, 4);

  return (
    <>
      <View style={{ gap: 24, alignItems: "flex-start" }}>
        <View style={{ gap: 10 }}>
          <T s={13} w={700} c={C.navy} ls={1.3} upper>
            {dayLabel(a.todayISO)}
          </T>
          <H s={48} lh={48} ls={-2.16} accessibilityRole="header">
            {"Welcome back, " + firstName + ". "}
            <Serif c={C.green} ls={-0.96}>
              {"Here's your week."}
            </Serif>
          </H>
        </View>
        <Btn title="Continue shopping" variant="navy" href="/shop" h={48} px={20} s={14} icon={ICON.arrowRight} iconSize={16} style={{ gap: 8 }} />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <StatTile width={tileW} label="Active rentals" fg={C.green} bg={C.greenBg} icon={ICON.calendar} value={String(current.length)} sub={"Next return " + (current[0] ? current[0].endFmt : "none")} onPress={() => a.goTab("rentals")} />
        <StatTile
          width={tileW}
          label="Orders on the way"
          fg={C.navy}
          bg={C.sky}
          icon={ICON.truck}
          value={String(onTheWay)}
          sub={outToday + " arriving today"}
          onPress={() => {
            a.setOrderTab("way");
            a.goTab("orders");
          }}
        />
        <StatTile width={tileW} label="Deposits held" fg="#7A5700" bg={C.butter} icon={ICON.shield} value={formatETB(depositsHeld)} sub={"Across " + plural(current.length, "rental") + ", refundable"} small />
        <StatTile width={tileW} label="Saved items" fg="#9A1F52" bg={C.rose} icon={ICON.heart} value={String(shop.wishlist.length)} sub={wishOnSale + " on sale now"} onPress={() => a.goTab("wishlist")} />
      </View>

      {/* active rentals */}
      <View style={{ gap: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View style={{ gap: 6 }}>
            <T s={13} w={700} c={C.green} ls={1.3} upper>
              Renting now
            </T>
            <H s={24} lh={24} ls={-0.84}>
              Active rentals
            </H>
          </View>
          <TextLink title="All rentals" color={C.green} onPress={() => a.goTab("rentals")} />
        </View>
        {current.map((r) => (
          <RentalCard key={r.id} r={r} a={a} />
        ))}
        {current.length === 0 ? <EmptyBox title="No active rentals" text="Rentals you book will show up here." /> : null}
      </View>

      {/* recent orders */}
      <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 28, backgroundColor: C.white, overflow: "hidden" }}>
        <View style={{ paddingVertical: 24, paddingHorizontal: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <H s={26} lh={31} ls={-0.91} style={{ flexShrink: 1 }}>
            Recent orders
          </H>
          <TextLink title="All orders" color={C.navy} onPress={() => a.goTab("orders")} />
        </View>
        {a.orders.slice(0, 4).map((order) => {
          const o = decorateOrder(order);
          return (
            <View key={o.id} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 14, paddingHorizontal: 20, gap: 6 }}>
              <View style={{ flexDirection: "row", gap: 16 }}>
                <T s={14} w={700} style={{ flex: 1 }}>
                  {o.no}
                </T>
                <T s={14} c={C.text} style={{ flex: 1 }}>
                  {o.date}
                </T>
              </View>
              <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {o.items.slice(0, 2).map((it) => (
                    <Thumb key={it.id} kind={it.kind} bg={it.bg} size={48} art={44} r={12} />
                  ))}
                  <T s={13} c={C.muted} style={{ flexShrink: 1 }}>
                    {o.itemCount}
                  </T>
                </View>
                <T s={14} w={700} style={{ flex: 1 }}>
                  {o.totalFmt}
                </T>
              </View>
              <View style={{ marginTop: 8, flexDirection: "row", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
                <StatusPill tone={o.st} style={{ alignSelf: "center" }} />
                <Tap href={o.trackHref} label={o.trackLabel} hitSlop={2} style={{ height: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 12, backgroundColor: C.white, justifyContent: "center" }}>
                  <T s={13} w={700} c={C.navy}>
                    {o.trackText}
                  </T>
                </Tap>
              </View>
            </View>
          );
        })}
        {a.orders.length === 0 ? (
          <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 28, paddingHorizontal: 20 }}>
            <T s={15} c={C.muted} center>
              Orders you place will show up here.
            </T>
          </View>
        ) : null}
      </View>

      <View style={{ gap: 20 }}>
        {/* deposit refunds */}
        <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 28, padding: 26, gap: 18 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 12, rowGap: 4 }}>
            <H s={22} lh={26} ls={-0.66}>
              Deposit refunds
            </H>
            <T s={12} w={600} c={C.muted}>
              {a.user.phone ? "To Telebirr " + a.user.phone : "To your payment method"}
            </T>
          </View>
          <View style={{ gap: 14 }}>
            {deposits.map((r) => {
              const refunded = r.status === "returned";
              return (
                <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Thumb kind={r.kind} bg={r.bg} size={40} art={36} r={12} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T s={14} w={700}>
                      {r.name}
                    </T>
                    <T s={12} c={C.muted}>
                      {(refunded ? "Returned " + r.endShort + " · refunded" : "Refund after inspection on return") + " · " + r.depositFmt}
                    </T>
                  </View>
                  <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: refunded ? C.greenBg : C.butter, justifyContent: "center" }}>
                    <T s={12} w={700} c={refunded ? C.green : "#7A5700"}>
                      {refunded ? "Refunded" : "Held"}
                    </T>
                  </View>
                </View>
              );
            })}
            {deposits.length === 0 ? (
              <T s={14} c={C.muted}>
                No deposits yet. Deposits on rentals show up here.
              </T>
            ) : null}
          </View>
          <T s={12} c={C.muted} lh={18}>
            {"Deposits are returned within " + plural(store.depositRefundDays, "working day") + " of the item passing inspection."}
          </T>
        </View>

        {/* rental bundles banner */}
        <Tap href="/shop" hitSlop={0} style={{ backgroundColor: C.navy, borderRadius: 28, paddingVertical: 22, paddingHorizontal: 18, flexDirection: "row", alignItems: "flex-end", gap: 8, overflow: "hidden" }}>
          <View style={{ flex: 1, gap: 14, alignItems: "flex-start" }}>
            <View style={{ gap: 10 }}>
              <T s={12} w={700} c={C.mint} ls={0.96} upper>
                Rental bundles
              </T>
              <H s={24} lh={24} ls={-0.96} c={C.white}>
                {"Hosting soon? "}
                <Serif c={C.mint} ls={-0.96}>
                  One booking.
                </Serif>
              </H>
              <T s={14} c="#CFE2F3" lh={21}>
                Garden party bundle: tent, 20 chairs, speaker and lights from ETB 6,500 a day.
              </T>
            </View>
            <View style={{ height: 46, paddingHorizontal: 20, borderRadius: 12, backgroundColor: C.green, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <T s={14} w={700} c={C.white}>
                Book a bundle
              </T>
              <Icon xml={ICON.arrowRight} size={16} color={C.white} />
            </View>
          </View>
          <ProductArt kind="tent" size={116} style={{ marginRight: -10 }} />
        </Tap>
      </View>
    </>
  );
}

function TextLink({ title, color, onPress }: { title: string; color: string; onPress: () => void }) {
  return (
    <Tap onPress={onPress} style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
      <T s={15} w={600} c={color}>
        {title}
      </T>
      <Icon xml={ICON.arrowRight} size={16} color={color} />
    </Tap>
  );
}

function StatTile({ width, label, fg, bg, icon, value, sub, onPress, small }: { width: number; label: string; fg: string; bg: string; icon: string; value: string; sub: string; onPress?: () => void; small?: boolean }) {
  const body = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        <T s={14} w={600} c={fg} style={{ flexShrink: 1 }}>
          {label}
        </T>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
          <Icon xml={icon} size={18} color={fg} sw={1.8} />
        </View>
      </View>
      <View style={{ gap: 2 }}>
        <H s={small ? 25 : 38} lh={small ? 26 : 38} ls={small ? -1 : -1.52} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </H>
        <T s={13} c={C.text}>
          {sub}
        </T>
      </View>
    </>
  );
  const style = { width, minHeight: 136, borderRadius: 24, paddingVertical: 20, paddingHorizontal: 8, backgroundColor: bg, justifyContent: "space-between", gap: 8 } as const;
  return onPress ? (
    <Tap onPress={onPress} hitSlop={0} style={style}>
      {body}
    </Tap>
  ) : (
    <View style={style}>{body}</View>
  );
}

function RentalCard({ r, a }: { r: Rental; a: Account }) {
  return (
    <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 28, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 20, gap: 18, backgroundColor: C.white }}>
      <View style={{ flexDirection: "row", gap: 18 }}>
        <Tap href={r.href} label={r.name} hitSlop={0}>
          <Thumb kind={r.kind} bg={r.bg} size={136} art={124} r={22} />
        </Tap>
        <View style={{ flex: 1, paddingTop: 4, gap: 8, alignItems: "flex-start" }}>
          <View style={{ minHeight: 26, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 13, backgroundColor: C.greenBg, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: "#418D4D" }} />
            <T s={12} w={700} c={C.green} style={{ flexShrink: 1 }}>
              {"Renting · " + r.rateFmt + " / day"}
            </T>
          </View>
          <Tap href={r.href} hitSlop={0}>
            <T s={19} w={700} ls={-0.38}>
              {r.name}
            </T>
          </Tap>
          <T s={14} c={C.text}>
            {"Return by "}
            <T s={14} w={700}>
              {r.endFmt}
            </T>
          </T>
          <T s={13} c={C.muted}>
            {"Deposit " + r.depositFmt + " · " + r.startFmt + " start"}
          </T>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <T s={13} w={600}>
            {"Day " + r.elapsed + " of " + r.total}
          </T>
          <T s={13} w={700} c={r.leftFg}>
            {r.leftLabel}
          </T>
        </View>
        <ProgressBar pct={r.pct} label={r.name + " rental progress"} />
        <ExtendNote r={r} a={a} />
      </View>
      <RentalButtons r={r} a={a} detailed />
    </View>
  );
}
