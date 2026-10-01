/*
 * The gateway's hosted payment page in a WebView (Android / iOS). It lets the gateway and the API's
 * /api/payments/return load, and hands the confirmation page the API redirects to back to the app
 * instead of loading it (see pay-return.ts).
 */
import React, { useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { WebView } from "react-native-webview";
import { C } from "@/theme";
import { Btn, H, ICON, T } from "@/components/ui";
import { isPaymentReturn, parseReturnUrl } from "./pay-return";
import type { PayWebViewProps } from "./PayWebView";

export function PayWebView({ url, onReturn, onLeave }: PayWebViewProps) {
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const sawReturn = useRef(false); // the API's return endpoint has been requested
  const finished = useRef(false);

  // true = the navigation was taken over by the app (don't load it)
  const intercept = (next: string) => {
    if (finished.current) return true;
    const ret = parseReturnUrl(next);
    if (ret) {
      finished.current = true;
      onReturn(ret);
      return true;
    }
    if (isPaymentReturn(next)) {
      sawReturn.current = true;
      return false;
    }
    // after verifying, the API sent the browser somewhere other than an order (it didn't recognise the payment)
    if (sawReturn.current && /^https?:/i.test(next)) {
      finished.current = true;
      onLeave();
      return true;
    }
    return false;
  };

  if (failed) {
    return (
      <View style={{ flex: 1, padding: 24, gap: 14, alignItems: "flex-start", justifyContent: "center" }}>
        <H s={24}>The payment page didn&apos;t load.</H>
        <T s={15} c={C.text} lh={22}>
          Check your connection and try again. You have not been charged.
        </T>
        <Btn
          title="Try again"
          variant="navy"
          h={46}
          iconLeft={ICON.refresh}
          onPress={() => {
            setFailed(false);
            setLoading(true);
            setProgress(0);
            setAttempt((n) => n + 1);
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <WebView
        key={attempt}
        source={{ uri: url }}
        style={{ flex: 1, backgroundColor: C.white }}
        onShouldStartLoadWithRequest={(req) => req.isTopFrame === false || !intercept(req.url)}
        onNavigationStateChange={(nav) => {
          intercept(nav.url);
        }}
        onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          if (!finished.current) setFailed(true);
        }}
        setSupportMultipleWindows={false}
        sharedCookiesEnabled
        domStorageEnabled
      />
      {loading ? (
        <>
          <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, height: 3, width: (Math.max(progress, 0.08) * 100 + "%") as `${number}%`, backgroundColor: C.green }} />
          {progress < 0.3 ? (
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: C.white }}>
              <ActivityIndicator size="large" color={C.navy} />
              <T s={14} c={C.muted}>
                Opening the secure payment page…
              </T>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
