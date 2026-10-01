/*
 * The shop's filter state and the rules that turn it into a list of products: search terms, the
 * All / Buy / Rent switch, deals, categories, brands, rating, price range, rental period and the
 * two availability switches. Ported from the website's ShopScreen so both filter the same way.
 */
import { formatETB, rentalBasePrice } from "@/lib/pricing";
import type { BrandDTO, CategoryDTO, ProductDTO } from "@/lib/types";

export const RATINGS = [
  { v: 4.8, label: "4.8 & up" },
  { v: 4.7, label: "4.7 & up" },
  { v: 4.5, label: "4.5 & up" },
  { v: 0, label: "Any rating" },
];
export const PERIODS = [
  { id: "day", label: "Daily", mult: 1, unit: "/ day", word: "Daily rental" },
  { id: "week", label: "Weekly", mult: 7, unit: "/ week", word: "Weekly rental" },
  { id: "month", label: "Monthly", mult: 30, unit: "/ month", word: "Monthly rental" },
] as const;
export const SHOP_MODES = [
  { id: "all", label: "All" },
  { id: "buy", label: "Buy" },
  { id: "rent", label: "Rent" },
] as const;
export const SORTS = [
  { id: "featured", label: "Featured" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "rating", label: "Top rated" },
] as const;
/** The price slider's top end ("ETB 150,000+"): a max at PMAX means no upper limit. */
export const PMAX = 150000;
export const PRICE_STEP = 500;
export const PAGE_SIZE = 24;
export const PAGE_BUTTONS = [1, 2, 3, 4];

export type ShopMode = (typeof SHOP_MODES)[number]["id"];
export type PeriodId = (typeof PERIODS)[number]["id"];
export type SortId = (typeof SORTS)[number]["id"];
export type Period = (typeof PERIODS)[number];
export type Flags = Record<string, boolean>;

/** What the shop's address carries: /shop?q=…&mode=rent&dept=…&brand=…&deals=1 */
export type ShopQuery = { q: string; mode: string; depts: string[]; brands: string[]; deals: boolean };
export type ShopData = { products: ProductDTO[]; categories: CategoryDTO[]; brands: BrandDTO[] };

export type ShopFilters = {
  q: string;
  shop: ShopMode;
  /** only products with a "was" price */
  deals: boolean;
  sort: SortId;
  cats: Flags;
  brands: Flags;
  rating: number;
  minP: number;
  maxP: number;
  period: PeriodId;
  availNow: boolean;
  freeDel: boolean;
  /** productId → the Buy / Rent side picked on that card */
  cardMode: Record<string, "buy" | "rent">;
  page: number;
  /** extra pages appended by "Load more" */
  more: number;
};

const uniq = (list: string[]) => list.filter((x, i) => !!x && list.indexOf(x) === i);
const toFlags = (list: string[]) => Object.fromEntries(list.map((k) => [k, true])) as Flags;
export const onKeys = (flags: Flags) => Object.keys(flags).filter((k) => flags[k]);

/** Department names from the catalogue's categories (fallback: the products themselves). */
export function deptList(data: ShopData) {
  const d = uniq(data.categories.map((c) => c.dept));
  return d.length ? d : uniq(data.products.map((p) => p.dept));
}
export function brandList(data: ShopData) {
  const b = data.brands.map((x) => x.name);
  return b.length ? b : uniq(data.products.map((p) => p.brand));
}

// Address values may be names or slugs; normalise to the names the UI shows.
export function normDepts(data: ShopData, list: string[]) {
  return list.map((v) => data.categories.find((c) => c.slug === v)?.label ?? v);
}
function normBrands(data: ShopData, list: string[]) {
  return list.map((v) => data.brands.find((b) => b.slug === v || b.name.toLowerCase() === v.toLowerCase())?.name ?? v);
}

/** The filters a shop address starts with. */
export function initialFilters(data: ShopData, query: ShopQuery): ShopFilters {
  return {
    q: query.q,
    shop: query.mode === "rent" || query.mode === "buy" ? query.mode : "all",
    deals: query.deals,
    sort: "featured",
    cats: toFlags(normDepts(data, query.depts)),
    brands: toFlags(normBrands(data, query.brands)),
    rating: 0,
    minP: 0,
    maxP: PMAX,
    period: "day",
    availNow: false,
    freeDel: false,
    cardMode: {},
    page: 1,
    more: 0,
  };
}

/** The shop address for a set of filters (only what the address can carry). */
export function shopHref(f: Pick<ShopFilters, "q" | "shop" | "cats" | "brands" | "deals">) {
  const parts: string[] = [];
  const q = f.q.trim();
  if (q) parts.push("q=" + encodeURIComponent(q));
  if (f.shop !== "all") parts.push("mode=" + f.shop);
  if (f.deals) parts.push("deals=1");
  onKeys(f.cats).forEach((k) => parts.push("dept=" + encodeURIComponent(k)));
  onKeys(f.brands).forEach((k) => parts.push("brand=" + encodeURIComponent(k)));
  return "/shop" + (parts.length ? "?" + parts.join("&") : "");
}

export const periodOf = (f: ShopFilters): Period => PERIODS.find((x) => x.id === f.period) ?? PERIODS[0];

/** Whether a card shows its rental price: rent-only products always, otherwise the card's own switch, then the shop's. */
export function showRentFor(f: ShopFilters, p: ProductDTO) {
  const picked = f.cardMode[p.id];
  return !!p.rent && (p.rentOnly || (picked ? picked === "rent" : f.shop === "rent"));
}
/** The price a card shows (the price filter and sorting use it too). */
export function priceOf(f: ShopFilters, p: ProductDTO) {
  return showRentFor(f, p) ? rentalBasePrice(p.rent || 0, p.plans || [], periodOf(f).mult) : p.buy;
}

const searchText = (p: ProductDTO) => [p.name, p.brand, p.cat, p.dept, p.kind, p.description].join(" ").toLowerCase();

/** Does a product pass the filters? `skip` leaves one facet out, for that facet's own counts. */
export function matches(f: ShopFilters, p: ProductDTO, skip?: "cats" | "brands") {
  const terms = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length) {
    const text = searchText(p);
    if (terms.some((t) => !text.includes(t))) return false;
  }
  if (f.shop === "buy" && p.rentOnly) return false;
  if (f.shop === "rent" && !p.rent) return false;
  if (f.deals && !p.was) return false;
  if (skip !== "cats" && onKeys(f.cats).length && !f.cats[p.dept] && !f.cats[p.cat]) return false;
  if (skip !== "brands" && onKeys(f.brands).length && !f.brands[p.brand]) return false;
  if (f.rating > 0 && parseFloat(p.rating) < f.rating) return false;
  if (f.availNow && !p.avail) return false;
  if (f.freeDel && !p.free) return false;
  const price = priceOf(f, p);
  if (price < f.minP || (f.maxP < PMAX && price > f.maxP)) return false;
  return true;
}

/** Matching products in the chosen order. */
export function results(f: ShopFilters, products: ProductDTO[]) {
  const res = products.filter((p) => matches(f, p));
  if (f.sort === "price-asc") res.sort((a, b) => priceOf(f, a) - priceOf(f, b));
  else if (f.sort === "price-desc") res.sort((a, b) => priceOf(f, b) - priceOf(f, a));
  else if (f.sort === "rating") res.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
  return res;
}

/** The small line under a card's price. */
export function cardSub(f: ShopFilters, p: ProductDTO) {
  if (showRentFor(f, p)) {
    const per = periodOf(f);
    const rate = formatETB(p.rent || 0);
    if (per.id !== "day") return (p.plans || []).some((pl) => pl.days === per.mult) ? rate + "/day · " + per.mult + "-day rate" : rate + "/day × " + per.mult + " days";
    return p.rentOnly ? "Deposit " + formatETB(p.deposit || 0) : "or buy " + formatETB(p.buy);
  }
  if (p.rent) return "or rent " + formatETB(p.rent) + "/day";
  if (p.was) return "was " + formatETB(p.was);
  if (p.free) return "Free delivery";
  if (p.avail) return "In stock";
  return p.shipsInDays ? "Ships in " + p.shipsInDays + " days" : "Out of stock";
}

export type FacetOption = { label: string; checked: boolean; count: number };

/** Category options: the departments, plus any selected category that is not a department (e.g. "Phones" from the menu). */
export function categoryOptions(f: ShopFilters, data: ShopData): FacetOption[] {
  const depts = deptList(data);
  return [...depts, ...onKeys(f.cats).filter((c) => !depts.includes(c))].map((d) => ({
    label: d,
    checked: !!f.cats[d],
    count: data.products.filter((p) => (p.dept === d || p.cat === d) && matches(f, p, "cats")).length,
  }));
}
export function brandOptions(f: ShopFilters, data: ShopData): FacetOption[] {
  const brands = brandList(data);
  return [...brands, ...onKeys(f.brands).filter((b) => !brands.includes(b))].map((b) => ({
    label: b,
    checked: !!f.brands[b],
    count: data.products.filter((p) => p.brand === b && matches(f, p, "brands")).length,
  }));
}
