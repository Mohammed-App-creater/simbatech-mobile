/*
 * Pricing rules mirrored from the API (which is authoritative) for live previews in the UI.
 * Keep in step with simbatech-web/src/lib/pricing.ts and simbatech-api/core/pricing.py.
 * All amounts are whole birr.
 */

export const FREE_DELIVERY_THRESHOLD = 100_000; // purchases at or above this ship free
export const DELIVERY_FEE = 500;
export const SAME_DAY_FEE = 450;
export const DAY_MS = 86_400_000;
export const SHOP_TIME_ZONE = "Africa/Addis_Ababa";

/**
 * Today's date (yyyy-mm-dd) in the shop's time zone, whatever zone the phone is in.
 * Addis Ababa is UTC+3 all year, so this avoids relying on the JS engine's time-zone data.
 */
export function shopToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
}

export type Plan = { days: number; price: number };
export type AddOnPrice = { key: string; perDay: number };

export function formatETB(n: number): string {
  return "ETB " + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Price of renting for `days`: a matching plan if there is one, otherwise the day rate. */
export function rentalBasePrice(rate: number, plans: Plan[], days: number): number {
  const exact = plans.find((p) => p.days === days);
  return exact ? exact.price : rate * days;
}

export function rentalLinePrice(rate: number, plans: Plan[], addOns: AddOnPrice[], selected: string[], days: number): number {
  const addOnPerDay = addOns.filter((a) => selected.includes(a.key)).reduce((sum, a) => sum + a.perDay, 0);
  return rentalBasePrice(rate, plans, days) + addOnPerDay * days;
}

export type Totals = {
  purchases: number;
  discount: number;
  rentals: number;
  deliveryFee: number;
  sameDayFee: number;
  deposit: number;
  total: number; // charged now; the deposit is held separately
  freeDeliveryRemaining: number;
};

export function computeTotals(input: {
  purchases: number;
  rentals: number;
  deposit: number;
  percentOff?: number;
  pickup?: boolean;
  sameDay?: boolean;
}): Totals {
  const discount = input.percentOff && input.purchases > 0 ? Math.round((input.purchases * input.percentOff) / 100) : 0;
  const goods = input.purchases - discount;
  const unlocked = goods >= FREE_DELIVERY_THRESHOLD;
  const deliveryFee = input.pickup || input.purchases === 0 || unlocked ? 0 : DELIVERY_FEE;
  const sameDayFee = input.sameDay && input.purchases > 0 && !input.pickup ? SAME_DAY_FEE : 0;
  return {
    purchases: input.purchases,
    discount,
    rentals: input.rentals,
    deliveryFee,
    sameDayFee,
    deposit: input.deposit,
    total: goods + input.rentals + deliveryFee + sameDayFee,
    freeDeliveryRemaining: Math.max(0, FREE_DELIVERY_THRESHOLD - goods),
  };
}
