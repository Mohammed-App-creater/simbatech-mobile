/*
 * Where an online payment ends. The gateway's hosted page finally sends the browser to
 * <site>/api/payments/return?tx_ref=… (the API verifies the payment there) and the API answers with a
 * redirect to <site>/order-confirmed/<id>?payment=paid|failed. The pay screen lets the first one load
 * and turns the second one into an in-app navigation. Pure helpers, no React Native imports.
 */

export type PayReturn = { orderId: string; payment: "paid" | "failed" | null };

function splitUrl(url: string): { path: string; query: string } | null {
  const m = /^https?:\/\/[^/?#]+([^?#]*)(?:\?([^#]*))?/i.exec(String(url || "").trim());
  return m ? { path: m[1] || "/", query: m[2] || "" } : null;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function queryParam(query: string, name: string): string | null {
  for (const pair of query.split("&")) {
    const eq = pair.indexOf("=");
    const key = decode(eq < 0 ? pair : pair.slice(0, eq));
    if (key === name) return eq < 0 ? "" : decode(pair.slice(eq + 1));
  }
  return null;
}

const CONFIRMED = "/order-confirmed/";

/** The order and result in a confirmation-page URL (<site>/order-confirmed/<id>?payment=paid|failed); null for any other URL. */
export function parseReturnUrl(url: string): PayReturn | null {
  const parts = splitUrl(url);
  if (!parts || !parts.path.startsWith(CONFIRMED)) return null;
  const orderId = decode(parts.path.slice(CONFIRMED.length).split("/")[0]);
  if (!orderId) return null;
  const result = queryParam(parts.query, "payment");
  return { orderId, payment: result === "paid" || result === "failed" ? result : null };
}

/** The API endpoint the gateway sends the customer back to (it must load, so the payment gets verified). */
export function isPaymentReturn(url: string): boolean {
  const parts = splitUrl(url);
  return !!parts && parts.path.replace(/\/+$/, "") === "/api/payments/return";
}

/** In-app path of an order's confirmation page, with the payment result when there is one. */
export function confirmedHref(orderId: string, payment?: string | null): string {
  return CONFIRMED + encodeURIComponent(orderId) + (payment === "paid" || payment === "failed" ? "?payment=" + payment : "");
}

/** Only secure web pages are opened as a payment page. */
export function isGatewayUrl(url: string | null | undefined): url is string {
  return /^https:\/\/[^/?#\s]+/i.test(String(url || "").trim());
}

/** "checkout.chapa.co" — shown in the pay screen's header so the customer sees where they are paying. */
export function urlHost(url: string): string {
  const m = /^https?:\/\/([^/?#:@]+)/i.exec(String(url || "").trim());
  return m ? m[1].toLowerCase() : "";
}
