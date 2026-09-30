/*
 * Shapes the API returns (defined by simbatech-api; mirrored from simbatech-web/src/lib/server/api.ts).
 */

export type ProductDTO = {
  id: string; // the slug
  name: string;
  description: string;
  cat: string;
  dept: string;
  brand: string;
  kind: string;
  bg: string;
  sku: string | null;
  buy: number;
  was?: number;
  rent?: number;
  rentOnly: boolean;
  deposit: number;
  rating: string;
  reviews: number;
  avail: boolean;
  left: number;
  sold: number;
  free: boolean;
  shipsInDays?: number;
  warranty: string | null;
  specs: [string, string][];
  inTheBox: string[];
  plans: { days: number; price: number }[];
  addOns: { key: string; label: string; note?: string; perDay: number }[];
  variants: { key: string; label: string; extra: number }[];
};

export type CartLineDTO = {
  id: number;
  product: ProductDTO;
  variant: { key: string; label: string; extra: number } | null;
  mode: "buy" | "rent";
  qty: number;
  rentStart: string | null;
  rentEnd: string | null;
  rentDays: number | null;
  addOns: string[];
  unitPrice: number;
  lineTotal: number;
  deposit: number;
  savedForLater: boolean;
};

export type CartDTO = {
  id: string | null;
  lines: CartLineDTO[];
  saved: CartLineDTO[];
  promo: { code: string; percentOff: number } | null;
  totals: Record<string, number>;
  count: number;
};

export type StoreDTO = {
  name: string;
  city: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  hours: string;
  sameDayCutoffHour: number;
  pickupReadyHours: number;
  returnDays: number;
  depositRefundDays: number;
  warranty: string;
  damagePolicy: string;
  payOnDeliveryTerms: string;
};

export type AuthConfig = { google: boolean; otp: boolean; otpDevMode: boolean; passwordReset: boolean; appHandoff?: boolean };

export type UserDTO = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  hasPassword: boolean;
  google: boolean;
};

export type Shell = {
  user: UserDTO | null;
  cart: CartDTO;
  wishlist: string[];
  store: StoreDTO;
  auth: AuthConfig;
};

export type CategoryDTO = { slug: string; label: string; dept: string; kind: string; bg: string; count: number; tag: string };
export type BrandDTO = { slug: string; name: string; count: number };
export type BundleDTO = {
  id: string;
  name: string;
  desc: string;
  bg: string;
  k1: string;
  k2: string;
  count: number;
  items: { label: string; productId: string | null; qty: number }[];
  productIds: string[];
  price: number;
};

export type AddressDTO = {
  id: number;
  label: string;
  line1: string;
  area: string;
  city: string;
  phone: string;
  notes: string | null;
  isDefault: boolean;
  createdAt: string;
};

export type PaymentMethodDTO = {
  id: number;
  kind: "telebirr" | "card";
  label: string;
  phone: string | null;
  brand: string | null;
  last4: string | null;
  expiry: string | null;
  holder: string | null;
  isDefault: boolean;
};

// Orders carry many fields; screens read them by name (see simbatech-api/orders/dto).
export type OrderDTO = { id: string; number: string; [key: string]: any };
export type PageDTO = { slug: string; title: string; summary: string; body: string; updatedAt: string };
export type ReviewsDTO = {
  rating: string | number;
  count: number;
  distribution: { stars: number; count: number; percent: number }[];
  items: { id: number; rating: number; title: string; body: string; author: string; createdAt: string }[];
  mine: { rating: number; title: string; body: string } | null;
};
