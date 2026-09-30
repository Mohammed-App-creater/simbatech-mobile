/*
 * App-wide session store shared by every screen: the signed-in user, the cart, the wishlist, the
 * store's details and which sign-in methods are available — plus every action that changes them
 * (cart, wishlist, auth incl. OTP / password reset, reviews, payment methods, notifications,
 * checkout, payments, tracking, contact). Ported from simbatech-web/src/lib/client/store.js so the
 * app and the site behave the same.
 *
 * The app loads the snapshot once at start-up (`bootstrap()` → GET /api/shell); actions keep it up
 * to date. Components read it with `useShop()`.
 */
import { useSyncExternalStore } from "react";
import { router } from "expo-router";
import { api, ApiError } from "./api";
import { formatETB } from "./pricing";
import type { AuthConfig, CartDTO, PaymentMethodDTO, ReviewsDTO, Shell, StoreDTO, UserDTO } from "./types";

export type ShopState = {
  /** false until the first /api/shell answer (or failure) */
  ready: boolean;
  /** set when the app could not reach the API at start-up */
  bootError: string | null;
  user: UserDTO | null;
  cart: CartDTO | null;
  wishlist: string[];
  store: StoreDTO | null;
  auth: AuthConfig | null;
};

let state: ShopState = { ready: false, bootError: null, user: null, cart: null, wishlist: [], store: null, auth: null };
const listeners = new Set<() => void>();

function set(patch: Partial<ShopState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function shopState(): ShopState {
  return state;
}

/** Re-renders the component whenever the store changes. */
export function useShop(): ShopState {
  return useSyncExternalStore(subscribe, shopState, shopState);
}

// ── Start-up ──
let booting: Promise<void> | null = null;
/** Loads { user, cart, wishlist, store, auth } for this device's session. Safe to call again to retry or refresh. */
export function bootstrap(): Promise<void> {
  booting =
    booting ||
    api<Shell>("GET", "/api/shell")
      .then((shell) => set({ ready: true, bootError: null, user: shell.user, cart: shell.cart, wishlist: shell.wishlist || [], store: shell.store, auth: shell.auth }))
      .catch((e) => set({ ready: true, bootError: (e && e.message) || "Can't reach Simbatech." }))
      .finally(() => (booting = null));
  return booting;
}

// ── Navigation ──
// Screens use the same paths as the website (/shop?mode=rent, /product/<slug>, /p/<slug>, …).
let currentPath = "/";
export function setCurrentPath(path: string) {
  currentPath = path || "/";
}
export function getCurrentPath() {
  return currentPath;
}
export function navigate(href: string, { replace = false }: { replace?: boolean } = {}) {
  if (replace) router.replace(href as never);
  else router.push(href as never);
}

// ── Store details (from StoreSettings in the admin) with safe fallbacks ──
const STORE_DEFAULTS: StoreDTO = {
  name: "Simbatech",
  city: "Addis Ababa",
  address: "Bole Road, Addis Ababa",
  phone: "0911 000 000",
  whatsapp: "0911 000 000",
  email: "hello@simbatech.et",
  hours: "Mon–Sat, 8am–7pm",
  sameDayCutoffHour: 16,
  pickupReadyHours: 2,
  returnDays: 7,
  depositRefundDays: 3,
  warranty: "12-month manufacturer's warranty",
  damagePolicy: "Normal wear is fine. Damage beyond that is charged from the deposit.",
  payOnDeliveryTerms: "Pay the driver by Telebirr or card when your order arrives.",
};
export function storeVals(s: Pick<ShopState, "store"> | null | undefined): StoreDTO {
  return { ...STORE_DEFAULTS, ...((s && s.store) || {}) };
}
export function authConfig(s: Pick<ShopState, "auth"> | null | undefined): AuthConfig {
  return { google: false, otp: true, otpDevMode: false, passwordReset: true, ...((s && s.auth) || {}) };
}

// ── Header values every screen shows ──
export function headerVals(s: ShopState) {
  const cartDto = s.cart;
  const first = s.user ? s.user.name.split(" ")[0] : null;
  return {
    cartCount: cartDto ? cartDto.count : 0,
    cartTotal: formatETB(cartDto ? cartDto.totals.total : 0),
    wishCount: s.wishlist.length,
    signedIn: !!s.user,
    userName: s.user ? s.user.name : "",
    userInitials: s.user
      ? s.user.name
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "",
    accountHref: s.user ? "/account" : "/signin",
    accountHello: first ? "Hello, " + first : "Hello, sign in",
  };
}

/** Where the header search goes: the shop, filtered by the query and the Buy/Rent toggle. */
export function searchHref(query: string, mode: "buy" | "rent") {
  const parts: string[] = [];
  const q = query.trim();
  if (q) parts.push("q=" + encodeURIComponent(q));
  if (mode === "rent") parts.push("mode=rent");
  return "/shop" + (parts.length ? "?" + parts.join("&") : "");
}

// ── Cart ──
function setCart(cartDto: CartDTO) {
  set({ cart: cartDto });
  return cartDto;
}

export type CartAddInput = {
  productId: string;
  mode: "buy" | "rent";
  qty?: number;
  variant?: string;
  /** yyyy-mm-dd */
  rentStart?: string;
  rentDays?: number;
  addOns?: string[];
};

export const cart = {
  add: (input: CartAddInput) => api<CartDTO>("POST", "/api/cart", input).then(setCart),
  /** Books every rentable product in a bundle. */
  addBundle: (input: { bundleId: string; rentStart?: string; rentDays?: number }) => api<CartDTO>("POST", "/api/cart/bundle", input).then(setCart),
  update: (lineId: number, patch: Record<string, unknown>) => api<CartDTO>("PATCH", "/api/cart/items/" + lineId, patch).then(setCart),
  remove: (lineId: number) => api<CartDTO>("DELETE", "/api/cart/items/" + lineId).then(setCart),
  applyPromo: (code: string) => api<CartDTO>("POST", "/api/cart/promo", { code }).then(setCart),
  removePromo: () => api<CartDTO>("DELETE", "/api/cart/promo").then(setCart),
  reload: () => api<CartDTO>("GET", "/api/cart").then(setCart),
};

// ── Wishlist ──
export const wishlist = {
  has: (s: ShopState, productId: string) => s.wishlist.includes(productId),
  /** Toggles a product; guests are sent to sign in first. */
  toggle: async (productId: string) => {
    if (!state.user) {
      navigate("/signin?next=" + encodeURIComponent(currentPath));
      return;
    }
    const saved = !state.wishlist.includes(productId);
    set({ wishlist: saved ? [...state.wishlist, productId] : state.wishlist.filter((id) => id !== productId) }); // optimistic
    try {
      const res = await api<{ ids: string[] }>("POST", "/api/wishlist", { productId, saved });
      set({ wishlist: res.ids });
    } catch (e) {
      set({ wishlist: saved ? state.wishlist.filter((id) => id !== productId) : [...state.wishlist, productId] });
      throw e;
    }
  },
};

// ── Auth ──
async function afterAuth(user: UserDTO) {
  const [cartRes, wishRes] = await Promise.all([api<CartDTO>("GET", "/api/cart"), api<{ ids: string[] }>("GET", "/api/wishlist")]);
  set({ user, cart: cartRes, wishlist: wishRes.ids });
  return user;
}

export type OtpSendResult = { sent: boolean; phone: string; newAccount: boolean; expiresInMinutes: number; resendInSeconds: number; devCode?: string };
export type ForgotResult = { via: "email" | "sms"; sent: boolean; devLink?: string; devCode?: string; resendInSeconds?: number };

export const auth = {
  signIn: async (identifier: string, password: string, remember: boolean) =>
    afterAuth((await api<{ user: UserDTO }>("POST", "/api/auth/signin", { identifier, password, remember })).user),
  signUp: async (name: string, identifier: string, password: string) =>
    afterAuth((await api<{ user: UserDTO }>("POST", "/api/auth/signup", { name, identifier, password })).user),
  signOut: async () => {
    await api("POST", "/api/auth/signout");
    set({ user: null, wishlist: [], cart: await api<CartDTO>("GET", "/api/cart") });
  },
  /** Phone sign-in step 1. */
  otpSend: (phone: string) => api<OtpSendResult>("POST", "/api/auth/otp/send", { phone }),
  /** Step 2. `name` is required when `newAccount` was true (the API answers 422 field "name" otherwise). */
  otpVerify: async (phone: string, code: string, name?: string, remember?: boolean) =>
    afterAuth((await api<{ user: UserDTO }>("POST", "/api/auth/otp/verify", { phone, code, name, remember })).user),
  forgotPassword: (identifier: string) => api<ForgotResult>("POST", "/api/auth/password/forgot", { identifier }),
  /** Either { uid, token, password } (email link) or { phone, code, password } (SMS). Signs the user in. */
  resetPassword: async (payload: Record<string, string>) => afterAuth((await api<{ user: UserDTO }>("POST", "/api/auth/password/reset", payload)).user),
  /** `current` may be empty when the account has no password yet (Google / OTP accounts). */
  changePassword: async (current: string, password: string) => {
    const { user } = await api<{ user: UserDTO }>("POST", "/api/auth/password/change", { current, password });
    set({ user });
    return user;
  },
  updateProfile: async (patch: Partial<Pick<UserDTO, "name" | "email" | "phone">>) => {
    const { user } = await api<{ user: UserDTO }>("PATCH", "/api/auth/me", patch);
    set({ user });
    return user;
  },
};

// ── Notification preferences: { sms, email, remind, deals } ──
export const notifications = {
  get: () => api<Record<string, boolean>>("GET", "/api/auth/notifications"),
  update: (patch: Record<string, boolean>) => api<Record<string, boolean>>("PATCH", "/api/auth/notifications", patch),
};

// ── Saved payment methods ──
export const paymentMethods = {
  list: () => api<{ methods: PaymentMethodDTO[] }>("GET", "/api/payment-methods").then((r) => r.methods),
  /** { kind: "telebirr", phone } or { kind: "card", brand: "Visa"|"Mastercard", last4, expiry: "MM/YY", holder? }, plus label?, isDefault? */
  add: (data: Record<string, unknown>) => api<{ methods: PaymentMethodDTO[] }>("POST", "/api/payment-methods", data).then((r) => r.methods),
  update: (id: number, patch: Record<string, unknown>) => api<{ methods: PaymentMethodDTO[] }>("PATCH", "/api/payment-methods/" + id, patch).then((r) => r.methods),
  remove: (id: number) => api<{ methods: PaymentMethodDTO[] }>("DELETE", "/api/payment-methods/" + id).then((r) => r.methods),
};

// ── Reviews ──
export const reviews = {
  list: (productId: string) => api<ReviewsDTO>("GET", "/api/products/" + productId + "/reviews"),
  write: (productId: string, data: { rating: number; title?: string; body: string }) => api<ReviewsDTO>("POST", "/api/products/" + productId + "/reviews", data),
  remove: (productId: string) => api<ReviewsDTO>("DELETE", "/api/products/" + productId + "/reviews"),
};

// ── Checkout & payments ──
export type CheckoutResult = { orderId: string; number: string; payment: { status: "paid" | "pending"; method: string; redirectUrl?: string; simulated?: boolean } };

/** Places the order. */
export async function placeOrder(payload: Record<string, unknown>) {
  const res = await api<CheckoutResult>("POST", "/api/checkout", payload);
  await cart.reload();
  return res;
}

const payHref = (orderId: string, url: string) => "/pay?order=" + encodeURIComponent(orderId) + "&url=" + encodeURIComponent(url);

/** After placeOrder: open the payment page if the order needs paying online, otherwise the confirmation. */
export function finishCheckout(res: CheckoutResult) {
  if (res.payment && res.payment.redirectUrl) navigate(payHref(res.orderId, res.payment.redirectUrl), { replace: true });
  else navigate("/order-confirmed/" + res.orderId, { replace: true });
}

export const payments = {
  /** (Re)start online payment for an unpaid Telebirr / card order; opens the gateway's page. */
  payNow: async (orderId: string) => {
    const { redirectUrl } = await api<{ redirectUrl: string }>("POST", "/api/payments/start", { orderId });
    navigate(payHref(orderId, redirectUrl));
  },
};

/** Public order lookup for the Track order screen. */
export const trackOrder = (number: string, phone: string) => api("GET", "/api/orders/track?number=" + encodeURIComponent(number) + "&phone=" + encodeURIComponent(phone));

/** { topic: "support"|"sell"|"careers"|"other", name, contact, message } */
export const sendContact = (data: { topic: string; name: string; contact: string; message: string }) => api("POST", "/api/contact", data);

export const subscribeNewsletter = (email: string) => api("POST", "/api/newsletter", { email });

export { api, ApiError, formatETB };
