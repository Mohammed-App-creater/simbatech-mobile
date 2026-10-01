/*
 * Browser-preview stand-in for the payment WebView (the real one is PayWebView.native.tsx).
 * There is no WebView on the web, so the pay screen shows a button that opens the gateway's page.
 */
import type { PayReturn } from "./pay-return";

export type PayWebViewProps = {
  /** the gateway's hosted payment page (https) */
  url: string;
  /** the API sent the browser to an order's confirmation page: show it in the app */
  onReturn: (ret: PayReturn) => void;
  /** the API sent the browser somewhere else after verifying: go back to the order */
  onLeave: () => void;
};

export function PayWebView(_props: PayWebViewProps) {
  return null;
}
