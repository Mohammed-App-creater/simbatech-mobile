/*
 * Pay: the gateway's hosted payment page for an order (/pay?order=<id>&url=<gateway URL>), opened
 * by the store after checkout or "Pay now". When the payment finishes the app shows the order's
 * confirmation page; closing the page goes to the order, which keeps its "Pay now" button.
 * The browser preview has no WebView, so it offers a button that opens the payment page.
 */
import React, { useCallback, useEffect } from "react";
import { BackHandler, Platform, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, GUTTER } from "@/theme";
import { openUrl } from "@/components/SiteFooter";
import { Btn, H, Icon, ICON, T, Tap } from "@/components/ui";
import { PayWebView } from "@/components/checkout/PayWebView";
import { confirmedHref, isGatewayUrl, urlHost } from "@/components/checkout/pay-return";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function PayScreen() {
  const params = useLocalSearchParams<{ order?: string | string[]; url?: string | string[] }>();
  const order = one(params.order) || "";
  const url = (one(params.url) || "").trim();
  const insets = useSafeAreaInsets();
  // without an order id, /order-confirmed opens the customer's latest order
  const orderHref = order ? confirmedHref(order) : "/order-confirmed";
  const close = useCallback(() => router.replace(orderHref as never), [orderHref]);

  // Android back leaves the payment and shows the order
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const valid = isGatewayUrl(url);
  const embedded = valid && Platform.OS !== "web";

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <View style={{ height: insets.top, backgroundColor: C.navy }} />
      <View style={{ height: 56, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <Tap onPress={close} label="Close payment" style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: C.sand, alignItems: "center", justifyContent: "center" }}>
          <Icon xml={ICON.close} size={18} />
        </Tap>
        <View style={{ flex: 1, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon xml={ICON.lock} size={14} color={C.green} />
            <T s={15} w={700}>
              Secure payment
            </T>
          </View>
          {valid ? (
            <T s={12} c={C.muted} numberOfLines={1}>
              {urlHost(url)}
            </T>
          ) : null}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {embedded ? (
        <PayWebView url={url} onReturn={(ret) => router.replace(confirmedHref(ret.orderId, ret.payment) as never)} onLeave={close} />
      ) : (
        <View style={{ flex: 1, padding: GUTTER, paddingTop: 40 }}>
          <View style={{ padding: 28, borderRadius: 28, borderWidth: 1, borderColor: C.line, gap: 14, alignItems: "flex-start" }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: valid ? C.greenBg : C.sand, alignItems: "center", justifyContent: "center" }}>
              <Icon xml={ICON.lock} size={24} color={valid ? C.green : C.muted} sw={1.8} />
            </View>
            <H s={28} lh={30}>
              {valid ? "Complete your payment" : "This payment link isn't valid"}
            </H>
            <T s={15} c={C.text} lh={22}>
              {valid
                ? "The payment page opens in your browser. When you have paid, come back to your order to see it confirmed."
                : "Open your order and choose Pay now to start the payment again."}
            </T>
            {valid ? <Btn title="Open payment page" full icon={ICON.arrowRight} onPress={() => openUrl(url)} /> : null}
            <Tap onPress={close} accessibilityRole="link" style={{ height: 40, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <T s={15} w={600} c={C.navy} style={{ textDecorationLine: "underline" }}>
                {order ? "View your order" : "Go to your orders"}
              </T>
            </Tap>
          </View>
        </View>
      )}
    </View>
  );
}
