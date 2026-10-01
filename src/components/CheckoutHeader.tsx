/*
 * The slim header of the checkout flow (checkout, order confirmed): logo, the "Secure checkout"
 * pill, "Need help?" with the store's phone, and the Details → Delivery → Payment progress steps.
 */
import React, { useEffect, useRef } from "react";
import { ScrollView, View } from "react-native";
import { C, GUTTER } from "@/theme";
import { storeVals, useShop } from "@/lib/store";
import { Icon, ICON, T, Tap } from "./ui";
import { Logo } from "./ProductArt";
import { openUrl, telHref } from "./SiteFooter";

export type CheckoutStep = { label: string; done: boolean; current: boolean };

const ALL_DONE: CheckoutStep[] = ["Details", "Delivery", "Payment"].map((label) => ({ label, done: true, current: false }));
const IDLE = "#D5D3CC";

/** Pass the live `steps` on the checkout page; leave them out where every step is complete (order confirmed). */
export function CheckoutHeader({ steps }: { steps?: CheckoutStep[] }) {
  const store = storeVals(useShop());
  const list = steps || ALL_DONE;
  const withStatus = !!steps;
  const current = list.findIndex((st) => st.current);
  const scroller = useRef<ScrollView>(null);
  const stepX = useRef<number[]>([]);
  // on narrow phones the steps scroll sideways: keep the step in progress in view
  useEffect(() => {
    if (current > 0) scroller.current?.scrollTo({ x: Math.max(0, (stepX.current[current] || 0) - 60), animated: true });
  }, [current]);

  return (
    <View style={{ backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.line, paddingTop: 10, paddingBottom: 12, gap: 24 }}>
      <Tap href="/" label="Simbatech home" style={{ alignSelf: "flex-start", marginLeft: GUTTER }}>
        <Logo height={36} />
      </Tap>

      <View style={{ paddingHorizontal: GUTTER, flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 16, rowGap: 8 }}>
        <View style={{ height: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.greenBg, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon xml={ICON.lock} size={15} color={C.green} />
          <T s={13} w={700} c={C.green}>
            Secure checkout
          </T>
        </View>
        <View>
          <T s={12} c={C.muted} lh={15}>
            Need help?
          </T>
          <Tap onPress={() => openUrl(telHref(store.phone))} label={"Call " + store.phone}>
            <T s={14} w={700} c={C.navy} lh={17.5}>
              {store.phone}
            </T>
          </Tap>
        </View>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={withStatus ? "Checkout progress" : "Checkout progress, all steps complete"}
        contentContainerStyle={{ flexGrow: 1, alignItems: "center", paddingHorizontal: GUTTER }}
      >
        {list.map((st, i) => {
          const active = st.done || st.current;
          const tone = st.done ? C.green : st.current ? C.navy : IDLE;
          return (
            <React.Fragment key={st.label}>
              {i > 0 ? <View style={{ flexGrow: 1, minWidth: 10, maxWidth: 48, height: 2, borderRadius: 999, marginHorizontal: 8, backgroundColor: list[i - 1].done ? C.green : IDLE }} /> : null}
              <View
                onLayout={(e) => {
                  stepX.current[i] = e.nativeEvent.layout.x;
                }}
                accessibilityState={{ selected: st.current }}
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 999, borderWidth: 2, borderColor: tone, backgroundColor: active ? tone : C.white, alignItems: "center", justifyContent: "center" }}>
                  {st.done ? (
                    <Icon xml={ICON.check} size={16} color={C.white} sw={2.6} />
                  ) : (
                    <T s={14} w={700} c={st.current ? C.white : C.muted}>
                      {i + 1}
                    </T>
                  )}
                </View>
                <View>
                  <T s={15} w={700} c={active ? C.ink : C.muted} lh={18}>
                    {st.label}
                  </T>
                  {withStatus ? (
                    <T s={12} c={C.muted} lh={14.4}>
                      {st.done ? "Complete" : st.current ? "In progress" : "Up next"}
                    </T>
                  ) : null}
                </View>
              </View>
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
}
