/*
 * Shop: the catalogue with search, the All / Buy / Rent switch, sorting, filters (in a bottom sheet),
 * the product grid with the rental-bundle banner, paging and "Recently viewed" — the website's shop
 * page in its phone layout. The address (/shop?q=…&mode=rent&dept=…&brand=…&deals=1) sets the
 * filters the screen starts with; a different address starts the screen afresh, as on the site.
 */
import React, { useCallback, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C, GUTTER } from "@/theme";
import { clearCatalogCache, listBrands, listCategories, listProducts } from "@/lib/catalog";
import { bootstrap, formatETB, navigate } from "@/lib/store";
import type { ProductDTO } from "@/lib/types";
import { Screen, useScreenScroll } from "@/components/Screen";
import { Radio, Sheet } from "@/components/controls";
import { ProductArt } from "@/components/ProductArt";
import { productHref } from "@/components/ProductCard";
import { H, Icon, ICON, LoadError, Loading, Serif, T, Tap, useLoad } from "@/components/ui";
import { FilterSheet, Segmented } from "@/components/shop/FilterSheet";
import { ShopCard } from "@/components/shop/ShopCard";
import {
  cardSub,
  deptList,
  initialFilters,
  normDepts,
  onKeys,
  PAGE_BUTTONS,
  PAGE_SIZE,
  periodOf,
  PMAX,
  priceOf,
  results,
  SHOP_MODES,
  shopHref,
  showRentFor,
  SORTS,
  type ShopData,
  type ShopFilters,
  type ShopQuery,
} from "@/components/shop/filters";

// Where the product page keeps the ids of recently viewed products (the website's localStorage key).
const RECENT_KEY = "st_recent";

const BLUE = { bg: C.sky, fg: C.navy };
const GREEN = { bg: C.greenBg, fg: C.green };
const RED = { bg: "#FBE9E6", fg: C.red };

type Param = string | string[] | undefined;
const values = (v: Param) => (v == null ? [] : Array.isArray(v) ? v : [v]).filter(Boolean);

export default function ShopScreen() {
  const params = useLocalSearchParams<{ q?: Param; mode?: Param; dept?: Param; brand?: Param; deals?: Param }>();
  const query: ShopQuery = {
    q: values(params.q)[0] ?? "",
    mode: values(params.mode)[0] ?? "",
    depts: values(params.dept),
    brands: values(params.brand),
    deals: ["1", "true"].includes(values(params.deals)[0] ?? ""),
  };
  const { data, error, loading, reload } = useLoad<ShopData>(async () => {
    const [products, categories, brands] = await Promise.all([listProducts(), listCategories(), listBrands()]);
    return { products, categories, brands };
  }, []);
  const dept = query.depts.length === 1 ? query.depts[0] : undefined;

  return (
    <Screen
      // a new address starts the page afresh: filters from the address, header showing the search
      key={JSON.stringify(query)}
      searchQuery={query.q}
      searchMode={query.mode === "rent" ? "rent" : "buy"}
      activeDept={dept && data ? normDepts(data, [dept])[0] : dept}
      onRefresh={async () => {
        clearCatalogCache();
        reload();
        await bootstrap();
      }}
    >
      {data ? <ShopBody data={data} query={query} /> : loading ? <Loading /> : <LoadError message={error} onRetry={reload} />}
    </Screen>
  );
}

function ShopBody({ data, query }: { data: ShopData; query: ShopQuery }) {
  const P = data.products;
  const { width } = useWindowDimensions();
  const scroll = useScreenScroll();
  const [f, setF] = useState(() => initialFilters(data, query));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const bodyY = useRef(0);
  const resultsY = useRef(0);

  // recently viewed products, re-read whenever the visitor comes back to the shop
  useFocusEffect(
    useCallback(() => {
      let live = true;
      AsyncStorage.getItem(RECENT_KEY)
        .then((raw) => {
          const ids: unknown = JSON.parse(raw || "[]");
          if (live && Array.isArray(ids)) setRecentIds(ids.filter((x): x is string => typeof x === "string"));
        })
        .catch(() => {});
      return () => {
        live = false;
      };
    }, []),
  );

  /** Change filters; the grid goes back to its first page. */
  const patch = (p: Partial<ShopFilters>) => setF((cur) => ({ ...cur, page: 1, more: 0, ...p }));
  const flip = (key: "cats" | "brands", name: string) => patch({ [key]: { ...f[key], [name]: !f[key][name] } });
  /** Filters that live in the address: changing them reopens the shop at the new address. */
  const reopen = (next: ShopFilters) => {
    setF(next);
    const href = shopHref(next);
    if (href !== shopHref(initialFilters(data, query))) navigate(href, { replace: true });
  };

  const q = f.q.trim();
  const per = periodOf(f);
  const selCats = onKeys(f.cats);
  const selBrands = onKeys(f.brands);

  // results and paging: PAGE_SIZE per page; "Load more" appends the following pages
  const res = results(f, P);
  const count = res.length;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const page = Math.min(f.page, totalPages);
  const lastShown = Math.min(totalPages, page + f.more);
  const shown = res.slice((page - 1) * PAGE_SIZE, lastShown * PAGE_SIZE);
  const canLoad = lastShown < totalPages;
  const goPage = (n: number) => {
    patch({ page: n });
    scroll.scrollTo(bodyY.current + resultsY.current);
  };

  // "12 products across all departments, for rent"
  let scope = selCats.length === 1 ? "in " + selCats[0] : selCats.length > 1 ? "in " + selCats.length + " categories" : q ? "" : "across all departments";
  if (q) scope = "for “" + q + "”" + (scope ? " " + scope : "");
  if (f.deals) scope = "on sale" + (scope ? " " + scope : "");
  scope += f.shop === "rent" ? ", for rent" : f.shop === "buy" ? ", to buy" : "";
  const resultLabel = count + (q ? (count === 1 ? " result" : " results") : count === 1 ? " product" : " products");

  // active filter chips
  const active: { label: string; tone: { bg: string; fg: string }; remove: () => void }[] = [];
  if (q) active.push({ label: "“" + q + "”", tone: BLUE, remove: () => reopen({ ...f, q: "" }) });
  if (f.deals) active.push({ label: "Deals", tone: RED, remove: () => reopen({ ...f, deals: false, page: 1, more: 0 }) });
  if (f.shop !== "all") active.push({ label: f.shop === "rent" ? "For rent" : "To buy", tone: f.shop === "rent" ? GREEN : BLUE, remove: () => patch({ shop: "all", cardMode: {} }) });
  selCats.forEach((c) => active.push({ label: c, tone: BLUE, remove: () => flip("cats", c) }));
  selBrands.forEach((b) => active.push({ label: b, tone: BLUE, remove: () => flip("brands", b) }));
  if (f.minP > 0 || f.maxP < PMAX) active.push({ label: formatETB(f.minP) + " – " + (f.maxP < PMAX ? formatETB(f.maxP) : formatETB(PMAX) + "+"), tone: BLUE, remove: () => patch({ minP: 0, maxP: PMAX }) });
  if (per.id !== "day") active.push({ label: per.word, tone: GREEN, remove: () => patch({ period: "day" }) });
  if (f.rating > 0) active.push({ label: "Rated " + f.rating + "+", tone: BLUE, remove: () => patch({ rating: 0 }) });
  if (f.availNow) active.push({ label: "Available now", tone: BLUE, remove: () => patch({ availNow: false }) });
  if (f.freeDel) active.push({ label: "Free delivery", tone: BLUE, remove: () => patch({ freeDel: false }) });
  const clearAll = () => reopen({ ...initialFilters(data, { q: "", mode: "", depts: [], brands: [], deals: false }), sort: f.sort });

  // hero chips: tapping one shows just that department; tapping it again shows everything
  const chips = deptList(data).slice(0, 8);
  const pickChip = (c: string) => patch({ cats: selCats.length === 1 && selCats[0] === c ? {} : { [c]: true } });

  // recently viewed (the first five products until something has been viewed)
  let recent = recentIds.map((id) => P.find((p) => p.id === id)).filter((p): p is ProductDTO => !!p).slice(0, 5);
  if (!recent.length) recent = P.slice(0, 5);

  const cardW = (width - GUTTER * 2 - 12) / 2;
  const cardRows = (list: ProductDTO[]) =>
    Array.from({ length: Math.ceil(list.length / 2) }, (_, i) => (
      <View key={list[i * 2].id} style={{ flexDirection: "row", gap: 12 }}>
        {list.slice(i * 2, i * 2 + 2).map((p) => (
          <ShopCard
            key={p.id}
            product={p}
            showRent={showRentFor(f, p)}
            price={priceOf(f, p)}
            unit={per.unit}
            sub={cardSub(f, p)}
            onPick={(mode) => setF((cur) => ({ ...cur, cardMode: { ...cur.cardMode, [p.id]: mode } }))}
            style={{ width: cardW }}
          />
        ))}
      </View>
    ));
  const sortLabel = SORTS.find((s) => s.id === f.sort)?.label ?? SORTS[0].label;

  return (
    <View onLayout={(e) => (bodyY.current = e.nativeEvent.layout.y)}>
      {/* breadcrumb + hero with the department chips */}
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 20, gap: 16 }}>
        <View accessibilityLabel="Breadcrumb" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Tap href="/">
            <T s={13} c={C.muted}>
              Home
            </T>
          </Tap>
          <Icon xml={ICON.chevronRight} size={12} color={C.muted} />
          <T s={13} w={600}>
            {f.deals ? "Deals" : "Shop"}
          </T>
        </View>

        <View style={{ backgroundColor: C.sky, borderRadius: 32, paddingVertical: 22, paddingHorizontal: 18, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <View style={{ flex: 1, gap: 14 }}>
              <T s={13} w={700} c={C.navy} ls={1.3} upper>
                {f.deals ? "Sale prices" : "All departments"}
              </T>
              <H s={48} lh={48} ls={-2.16} accessibilityRole="header">
                {f.deals ? "Deals &" : "Shop &"}
                {"\n"}
                <Serif c={C.green} ls={-0.96}>
                  {f.deals ? "offers" : "rent"}
                </Serif>
              </H>
            </View>
            <ProductArt kind="camera" size={116} style={{ marginRight: -10 }} />
          </View>
          <T s={16} lh={24} c={C.text} style={{ marginTop: 14 }}>
            {f.deals
              ? "Reduced prices while stock lasts. Delivered to your door, and collected when you are done renting."
              : "Buy to keep, or rent by the day. Delivered to your door, and collected when you are done."}
          </T>
          <View accessibilityLabel="Quick category filter" style={{ marginTop: 20, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {chips.map((c) => {
              const on = !!f.cats[c];
              return (
                <Tap
                  key={c}
                  onPress={() => pickChip(c)}
                  hitSlop={2}
                  accessibilityState={{ selected: on }}
                  style={{ height: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: on ? C.navy : "#D6E8F7", backgroundColor: on ? C.navy : C.white, justifyContent: "center" }}
                >
                  <T s={14} w={600} c={on ? C.white : C.ink}>
                    {c}
                  </T>
                </Tap>
              );
            })}
          </View>
        </View>
      </View>

      {/* toolbar: result count, All / Buy / Rent, sort, active filters */}
      <View onLayout={(e) => (resultsY.current = e.nativeEvent.layout.y)} style={{ paddingHorizontal: GUTTER, paddingTop: 36, gap: 12 }}>
        <View style={{ gap: 24 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 12, rowGap: 2 }} accessibilityLiveRegion="polite">
            <H s={23.4} lh={28} ls={-0.819} accessibilityRole="header">
              {resultLabel}
            </H>
            <T s={14} c={C.muted} style={{ flexShrink: 1 }}>
              {scope}
            </T>
          </View>
          <View style={{ gap: 12, alignItems: "flex-start" }}>
            <Segmented
              label="Show items to buy, rent or both"
              options={SHOP_MODES}
              value={f.shop}
              onChange={(shop) => patch({ shop, cardMode: {} })}
              onColor={(id) => (id === "rent" ? C.green : C.navy)}
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <T s={14} c={C.muted}>
                Sort by
              </T>
              <Tap
                onPress={() => setSortOpen(true)}
                hitSlop={0}
                label={"Sort by: " + sortLabel}
                style={{ height: 48, minWidth: 166, paddingHorizontal: 14, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 14, backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}
              >
                <T s={14} w={600}>
                  {sortLabel}
                </T>
                <Icon xml={ICON.chevronDown} size={16} sw={2.2} />
              </Tap>
            </View>
          </View>
        </View>

        <View style={{ minHeight: 44, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {active.length ? (
            <>
              {active.map((a) => (
                <Tap
                  key={a.label}
                  onPress={a.remove}
                  hitSlop={4}
                  label={"Remove filter: " + a.label}
                  style={{ height: 36, maxWidth: "100%", paddingLeft: 14, paddingRight: 8, borderRadius: 999, backgroundColor: a.tone.bg, flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <T s={13} w={600} c={a.tone.fg} numberOfLines={1} style={{ flexShrink: 1 }}>
                    {a.label}
                  </T>
                  <Icon xml={ICON.close} size={14} color={a.tone.fg} sw={2.2} />
                </Tap>
              ))}
              <Tap onPress={clearAll} hitSlop={0} style={{ height: 44, paddingHorizontal: 10, justifyContent: "center" }}>
                <T s={14} w={600} c={C.navy} style={{ textDecorationLine: "underline" }}>
                  Clear all
                </T>
              </Tap>
            </>
          ) : (
            <T s={14} lh={18} c={C.muted}>
              No filters applied. Use the chips above or the Filters button to narrow things down.
            </T>
          )}
        </View>
      </View>

      {/* filters button, product grid, paging */}
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 16, gap: 20 }}>
        <Tap
          onPress={() => setFiltersOpen(true)}
          hitSlop={4}
          accessibilityState={{ expanded: filtersOpen }}
          style={{ alignSelf: "flex-start", height: 44, paddingHorizontal: 18, borderWidth: 1.5, borderColor: C.navy, borderRadius: 999, backgroundColor: C.white, flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Icon xml={ICON.filter} size={18} color={C.navy} />
          <T s={14} w={700} c={C.navy}>
            Filters
          </T>
        </Tap>

        <View style={{ gap: 36 }}>
          <View style={{ gap: 12 }}>
            {cardRows(shown.slice(0, 6))}
            {count > 0 ? <BundlePromo onSamePage={f.shop === "rent" && shopHref(initialFilters(data, query)) === "/shop?mode=rent" ? scroll.toTop : undefined} /> : null}
            {cardRows(shown.slice(6))}
            {count === 0 ? (
              <View style={{ minHeight: 320, paddingVertical: 32, paddingHorizontal: 20, borderRadius: 28, backgroundColor: "#F6F5F1", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <H s={28} lh={32} center>
                  Nothing matches those filters
                </H>
                <T s={15} lh={21} c={C.muted} center>
                  Try removing a filter or widening the price range.
                </T>
                <Tap onPress={clearAll} hitSlop={0} style={{ height: 48, paddingHorizontal: 22, borderRadius: 14, backgroundColor: C.navy, justifyContent: "center" }}>
                  <T s={14} w={700} c={C.white}>
                    Clear all filters
                  </T>
                </Tap>
              </View>
            ) : null}
          </View>

          <View style={{ paddingTop: 28, borderTopWidth: 1, borderTopColor: C.line, alignItems: "center", gap: 12 }}>
            <T s={14} c={C.muted}>
              Showing{" "}
              <T s={14} w={700}>
                {shown.length}
              </T>
              {" of " + count + " products"}
            </T>
            <Tap
              onPress={() => setF((cur) => ({ ...cur, more: cur.more + 1 }))}
              disabled={!canLoad}
              hitSlop={0}
              style={{ height: 52, paddingHorizontal: 28, borderWidth: 1.5, borderColor: C.navy, borderRadius: 14, backgroundColor: C.white, flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <T s={15} w={700} c={C.navy}>
                {canLoad ? "Load more" : "You have seen them all"}
              </T>
              <Icon xml={ICON.arrowDown} size={16} color={C.navy} />
            </Tap>
            <View accessibilityLabel="Pagination" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {PAGE_BUTTONS.map((n) => {
                const on = n === page;
                const off = n > totalPages;
                return (
                  <Tap
                    key={n}
                    onPress={() => goPage(n)}
                    disabled={off}
                    hitSlop={2}
                    label={"Page " + n}
                    accessibilityState={{ selected: on, disabled: off }}
                    style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: on ? C.navy : C.lineStrong, backgroundColor: on ? C.navy : C.white, alignItems: "center", justifyContent: "center", opacity: off ? 0.45 : 1 }}
                  >
                    <T s={14} w={700} c={on ? C.white : C.ink}>
                      {n}
                    </T>
                  </Tap>
                );
              })}
              <Tap
                onPress={() => goPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                hitSlop={2}
                label="Next page"
                style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.white, alignItems: "center", justifyContent: "center", opacity: page >= totalPages ? 0.45 : 1 }}
              >
                <Icon xml={ICON.chevronRight} size={16} />
              </Tap>
            </View>
          </View>
        </View>
      </View>

      {/* recently viewed */}
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 48, gap: 24 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", columnGap: 20, rowGap: 4 }}>
          <View style={{ gap: 8 }}>
            <T s={13} w={700} c={C.navy} ls={1.3} upper>
              Pick up where you left off
            </T>
            <H s={24} lh={24} accessibilityRole="header">
              Recently viewed
            </H>
          </View>
          <Tap href="/account" style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <T s={14} w={600} c={C.navy}>
              View history
            </T>
            <Icon xml={ICON.arrowRight} size={16} color={C.navy} />
          </Tap>
        </View>
        <View style={{ gap: 16 }}>
          {recent.map((p) => (
            <Tap key={p.id} href={productHref(p)} hitSlop={0} style={{ height: 104, paddingVertical: 10, paddingHorizontal: 8, borderWidth: 1, borderColor: C.line, borderRadius: 22, backgroundColor: C.white, flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 84, height: 84, borderRadius: 16, backgroundColor: p.bg, alignItems: "center", justifyContent: "center" }}>
                <ProductArt kind={p.kind} size={80} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <T s={14} w={700} lh={17.5} ls={-0.14} numberOfLines={2}>
                  {p.name}
                </T>
                <T s={13} w={600} c={p.rentOnly ? C.green : C.navy}>
                  {p.rentOnly && p.rent ? formatETB(p.rent) + " / day" : formatETB(p.buy)}
                </T>
              </View>
            </Tap>
          ))}
        </View>
      </View>

      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} filters={f} data={data} onChange={patch} />

      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        {SORTS.map((s) => {
          const on = s.id === f.sort;
          return (
            <Tap
              key={s.id}
              onPress={() => {
                setF((cur) => ({ ...cur, sort: s.id }));
                setSortOpen(false);
              }}
              hitSlop={0}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={{ height: 52, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Radio checked={on} color={C.navy} />
              <T s={15} w={on ? 700 : 500}>
                {s.label}
              </T>
            </Tap>
          );
        })}
      </Sheet>
    </View>
  );
}

/** The rental-bundle banner that sits in the grid after the first six products. */
function BundlePromo({ onSamePage }: { onSamePage?: () => void }) {
  return (
    <Tap
      onPress={onSamePage}
      href={onSamePage ? undefined : "/shop?mode=rent"}
      hitSlop={0}
      style={{ backgroundColor: C.greenDark, borderRadius: 28, paddingVertical: 22, paddingHorizontal: 18, flexDirection: "row", alignItems: "flex-end", gap: 8, overflow: "hidden" }}
    >
      <View style={{ flex: 1, gap: 14, alignItems: "flex-start" }}>
        <View style={{ gap: 10 }}>
          <T s={13} w={700} c={C.mint} ls={1.3} upper>
            Rental bundles
          </T>
          <H s={25.35} lh={25.35} ls={-1.014} c={C.white}>
            Garden party bundle from{" "}
            <Serif c={C.mint} ls={-0.507}>
              ETB 6,500 / day
            </Serif>
          </H>
          <T s={15} lh={19} c="#D5E9D8">
            Canopy tent, 20 chairs, speaker and string lights. Set up and collected.
          </T>
        </View>
        <View style={{ height: 44, paddingHorizontal: 18, borderRadius: 12, backgroundColor: C.white, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <T s={14} w={700} c={C.greenDark}>
            See the bundle
          </T>
          <Icon xml={ICON.arrowRight} size={16} color={C.greenDark} />
        </View>
      </View>
      <ProductArt kind="tent" size={116} style={{ marginRight: -10 }} />
    </Tap>
  );
}
