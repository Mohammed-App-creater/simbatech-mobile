/*
 * Read-only data loaders. Catalog answers are the same for every visitor, so they are cached in
 * memory for a minute (the website caches the same endpoints for the same time); visitor-specific
 * data (orders, addresses, …) is always fetched fresh.
 */
import { api, apiGetOrNull } from "./api";
import type { AddressDTO, BrandDTO, BundleDTO, CategoryDTO, OrderDTO, PageDTO, PaymentMethodDTO, ProductDTO, ReviewsDTO } from "./types";

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();

function cached<T>(path: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.value as T);
  const running = pending.get(path);
  if (running) return running as Promise<T>;
  const p = load()
    .then((value) => {
      cache.set(path, { at: Date.now(), value });
      return value;
    })
    .finally(() => pending.delete(path));
  pending.set(path, p);
  return p;
}

/** Forget cached catalog data (pull-to-refresh). */
export function clearCatalogCache() {
  cache.clear();
}

const items = <T>(path: string) => cached(path, async () => (await api<{ items: T[] }>("GET", "/api" + path)).items ?? []);

export const listProducts = () => items<ProductDTO>("/products");
export const listCategories = () => items<CategoryDTO>("/categories");
export const listBrands = () => items<BrandDTO>("/brands");
export const listBundles = () => items<BundleDTO>("/bundles");
export const getProduct = (slug: string) => cached("/products/" + slug, () => apiGetOrNull<ProductDTO>("/api/products/" + encodeURIComponent(slug)));
export const listPages = () => items<{ slug: string; title: string; summary: string }>("/pages");
export const getPage = (slug: string) => cached("/pages/" + slug, () => apiGetOrNull<PageDTO>("/api/pages/" + encodeURIComponent(slug)));

export const getReviews = (slug: string) => apiGetOrNull<ReviewsDTO>("/api/products/" + encodeURIComponent(slug) + "/reviews");
export const listOrders = async () => (await apiGetOrNull<{ orders: OrderDTO[] }>("/api/orders"))?.orders ?? [];
export const getOrder = (id: string) => apiGetOrNull<OrderDTO>("/api/orders/" + encodeURIComponent(id));
export const listAddresses = async () => (await apiGetOrNull<{ addresses: AddressDTO[] }>("/api/addresses"))?.addresses ?? [];
export const listPaymentMethods = async () => (await apiGetOrNull<{ methods: PaymentMethodDTO[] }>("/api/payment-methods"))?.methods ?? [];
export const getNotifications = () => apiGetOrNull<Record<string, boolean>>("/api/auth/notifications");
