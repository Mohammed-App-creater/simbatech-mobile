/*
 * Account › Orders: the filter tabs and one expandable card per order with its status, tracking
 * timeline, "Pay now" for unpaid online orders, "Get help" and "View items" / "Buy again".
 */
import React, { useState } from "react";
import { View } from "react-native";
import { C } from "@/theme";
import { payments } from "@/lib/store";
import type { OrderDTO } from "@/lib/types";
import { Icon, ICON, T, Tap } from "@/components/ui";
import { decorateOrder, EmptyBox, errText, FormError, MiniBtn, ORDER_TABS, SegTabs, StatusPill, TabTitle, Thumb, type Account } from "./shared";

export function OrdersTab({ a }: { a: Account }) {
  const [payBusy, setPayBusy] = useState<string | null>(null); // order id being sent to the gateway
  const [payError, setPayError] = useState<{ id: string; message: string } | null>(null);
  const filter = ORDER_TABS.find((t) => t.id === a.orderTab) || ORDER_TABS[0];
  const list = a.orders.filter(filter.test);

  const payNow = (order: OrderDTO) => {
    if (payBusy) return;
    setPayBusy(order.id);
    setPayError(null);
    payments.payNow(order.id).then(
      () => setPayBusy(null),
      (err) => {
        setPayBusy(null);
        setPayError({ id: order.id, message: errText(err) });
      },
    );
  };

  return (
    <>
      <View style={{ gap: 24 }}>
        <TabTitle eyebrow="Purchases" title="My orders" />
        <SegTabs label="Filter orders" tabs={ORDER_TABS.map((t) => ({ id: t.id, label: t.label, count: a.orders.filter(t.test).length }))} value={filter.id} onChange={a.setOrderTab} />
      </View>
      <View style={{ gap: 14 }}>
        {list.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            open={order.id === a.openOrder}
            onToggle={() => a.setOpenOrder(a.openOrder === order.id ? null : order.id)}
            paying={payBusy === order.id}
            payError={payError && payError.id === order.id ? payError.message : ""}
            onPay={() => payNow(order)}
          />
        ))}
        {list.length === 0 ? <EmptyBox title="Nothing here yet" text="Orders in this state will show up here." /> : null}
      </View>
    </>
  );
}

const LEFT_COL = 104;

function OrderCard({ order, open, onToggle, paying, payError, onPay }: { order: OrderDTO; open: boolean; onToggle: () => void; paying: boolean; payError: string; onPay: () => void }) {
  const o = decorateOrder(order);
  return (
    <View style={{ borderWidth: 1, borderColor: open ? "#BFD8EE" : C.line, borderRadius: 24, backgroundColor: C.white, overflow: "hidden" }}>
      <Tap onPress={onToggle} hitSlop={0} label={"Order " + o.no + ", " + o.st.label} accessibilityState={{ expanded: open }} style={{ paddingVertical: 16, paddingHorizontal: 24, gap: 8 }} pressedStyle={{ backgroundColor: "#FAFAF8" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: LEFT_COL, gap: 4 }}>
            <T s={16} w={700}>
              {o.no}
            </T>
            <T s={13} c={C.muted}>
              {"Placed " + o.date}
            </T>
          </View>
          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            {o.items.map((it) => (
              <Thumb key={it.id} kind={it.kind} bg={it.bg} size={56} art={52} r={14} />
            ))}
            <T s={14} c={C.text} numberOfLines={1} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 100 }}>
              {o.names}
            </T>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <T s={16} w={700} style={{ width: LEFT_COL }}>
            {o.totalFmt}
          </T>
          <StatusPill tone={o.st} style={{ alignSelf: "center" }} />
        </View>
        <View style={[{ width: 40, height: 40, borderRadius: 999, backgroundColor: C.sand, alignItems: "center", justifyContent: "center" }, open && { transform: [{ rotate: "180deg" }] }]}>
          <Icon xml={ICON.chevronDown} size={16} />
        </View>
      </Tap>

      {open ? (
        <View style={{ marginHorizontal: 24, marginBottom: 24, padding: 24, borderRadius: 20, backgroundColor: "#F6F5F1", gap: 22 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 10, alignItems: "flex-start" }}>
              <T s={15} w={700}>
                {o.headline}
              </T>
              <StatusPill tone={o.payStatus} />
            </View>
            <T s={13} c={C.muted} style={{ maxWidth: 96 }}>
              {o.trackingNo}
            </T>
          </View>

          {/* tracking timeline, two steps per row */}
          <View accessibilityLabel={"Tracking timeline for " + o.no} style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 16, marginHorizontal: -8 }}>
            {o.steps.map((s, i) => (
              <View key={i} style={{ width: "50%", paddingHorizontal: 8, gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={[
                      { width: 22, height: 22, borderRadius: 999, borderWidth: 2, borderColor: s.dotBorder, backgroundColor: s.dotBg, alignItems: "center", justifyContent: "center" },
                      s.current && { boxShadow: "0 0 0 5px rgba(22,121,190,0.18)" },
                    ]}
                  >
                    {s.done ? <Icon xml={ICON.check} size={12} color={C.white} sw={3} /> : null}
                  </View>
                  <View style={{ flex: 1, height: 3, marginHorizontal: 8, borderRadius: 999, backgroundColor: s.lineBg }} />
                </View>
                <View style={{ paddingRight: 16, gap: 2 }}>
                  <T s={14} w={700} c={s.labelFg}>
                    {s.label}
                  </T>
                  {s.time ? (
                    <T s={12} c={C.muted}>
                      {s.time}
                    </T>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: C.lineStrong, paddingTop: 18, gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon xml={ICON.pin} size={16} color={C.navy} sw={1.8} />
              <T s={13} c={C.text} style={{ flex: 1 }}>
                {o.where}
              </T>
            </View>
            <FormError>{payError}</FormError>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {o.payable ? <MiniBtn title={paying ? "Opening payment…" : "Pay now"} tone="green" onPress={onPay} disabled={paying} /> : null}
              <MiniBtn title="Get help" tone="outline" href="/p/contact" />
              <MiniBtn title={o.cta} tone="navy" href={o.ctaHref} />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
