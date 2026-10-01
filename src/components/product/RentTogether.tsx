/*
 * "Frequently rented together": this product plus other rentables in a swipeable row. Tick what
 * you need and add the set to the cart — each as a one-day rental starting tomorrow.
 */
import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { C } from "@/theme";
import { cart, formatETB } from "@/lib/store";
import { tomorrowISO } from "@/lib/hooks";
import type { ProductDTO } from "@/lib/types";
import { Checkbox } from "@/components/controls";
import { ProductArt } from "@/components/ProductArt";
import { H, Icon, ICON, Serif, T, Tap } from "@/components/ui";
import { errMsg, SOFT } from "./shared";

export function RentTogether({ product, others }: { product: ProductDTO; others: ProductDTO[] }) {
  const items = [product, ...others];
  const [picked, setPicked] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((p) => [p.id, true])));
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [err, setErr] = useState("");

  const chosen = items.filter((p) => picked[p.id]);
  const total = chosen.reduce((sum, p) => sum + (p.rent || 0), 0);
  const deposit = chosen.reduce((sum, p) => sum + (p.deposit || 0), 0);
  const none = chosen.length === 0;

  const toggle = (id: string) => {
    setPicked((prev) => ({ ...prev, [id]: !prev[id] }));
    setAdded(false);
    setErr("");
  };

  // Adds the ticked items one after another so the cart ends up with all of them.
  const addAll = async () => {
    if (none || busy) return;
    const start = tomorrowISO();
    setBusy(true);
    setAdded(false);
    setErr("");
    try {
      for (const p of chosen) await cart.add({ productId: p.id, mode: "rent", rentStart: start, rentDays: 1 });
      setAdded(true);
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  };

  return (
    <View style={{ backgroundColor: SOFT, borderRadius: 24, paddingVertical: 22, gap: 24 }}>
      <View style={{ paddingHorizontal: 20, gap: 8 }}>
        <T s={13} w={700} c={C.green} ls={1.3} upper>
          Rent the set
        </T>
        <H s={29.25} lh={31} ls={-1.17}>
          Frequently rented <Serif c={C.green}>together</Serif>
        </H>
        <T s={15} c={C.muted}>
          Tick what you need. Prices are per day.
        </T>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, alignItems: "stretch" }}>
        {items.map((p, i) => {
          const on = !!picked[p.id];
          return (
            <React.Fragment key={p.id}>
              {i > 0 ? (
                <View style={{ alignSelf: "center", width: 36, height: 36, borderRadius: 999, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
                  <Icon xml={ICON.plus} size={16} color={C.muted} sw={2.2} />
                </View>
              ) : null}
              <Tap
                onPress={() => toggle(p.id)}
                hitSlop={0}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                label={p.name + ", " + formatETB(p.rent || 0) + " per day"}
                pressedStyle={{ opacity: 0.9 }}
                style={{ width: 232, paddingTop: 12, paddingHorizontal: 12, paddingBottom: 16, borderWidth: 2, borderColor: on ? C.green : "transparent", borderRadius: 24, backgroundColor: C.white, gap: 12 }}
              >
                <View style={{ height: 150, borderRadius: 18, backgroundColor: p.bg, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <ProductArt kind={p.kind} size={132} />
                  <View style={{ position: "absolute", top: 12, left: 12 }}>
                    <Checkbox checked={on} size={22} />
                  </View>
                </View>
                <View style={{ paddingHorizontal: 4, gap: 4 }}>
                  <T s={12} w={600} c={C.muted}>
                    {i === 0 ? "This item" : p.cat}
                  </T>
                  <T s={15} w={700} ls={-0.15} numberOfLines={2}>
                    {p.name}
                  </T>
                  <T s={15} w={700} c={C.green}>
                    {formatETB(p.rent || 0)}
                    <T s={13} w={500} c={C.muted}>
                      {" / day"}
                    </T>
                  </T>
                </View>
              </Tap>
            </React.Fragment>
          );
        })}
      </ScrollView>

      <View style={{ marginHorizontal: 20, backgroundColor: C.white, borderRadius: 24, padding: 24, gap: 18 }}>
        <View style={{ gap: 6 }} accessibilityLiveRegion="polite">
          <T s={14} c={C.muted}>
            {chosen.length} {chosen.length === 1 ? "item" : "items"} selected
          </T>
          <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 6 }}>
            <H s={40} lh={40} ls={-1.6}>
              {formatETB(total)}
            </H>
            <T s={15} c={C.muted}>
              / day
            </T>
          </View>
          <T s={13} c={C.muted}>
            Plus refundable deposits, {formatETB(deposit)} in total.
          </T>
        </View>
        <View style={{ gap: 10 }}>
          <Tap
            onPress={addAll}
            disabled={none || busy}
            hitSlop={0}
            style={{ height: 54, borderRadius: 14, backgroundColor: none ? "#9AA39C" : C.green, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.7 : 1 }}
          >
            <Icon xml={ICON.cart} size={16} color={C.white} />
            <T s={15} w={700} c={C.white}>
              {busy ? "Adding…" : "Add " + chosen.length + " to cart"}
            </T>
          </Tap>
          {err ? (
            <T s={13} w={600} c={C.red} center accessibilityLiveRegion="polite">
              {err}
            </T>
          ) : null}
          {added ? (
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center" }} accessibilityLiveRegion="polite">
              <T s={13} w={600} c={C.green}>
                {"Added to your cart · "}
              </T>
              <Tap href="/cart">
                <T s={13} w={600} c={C.green} style={{ textDecorationLine: "underline" }}>
                  View cart
                </T>
              </Tap>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
