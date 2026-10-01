/*
 * Account › Wishlist: the saved products, two per row, each with a heart to remove it and an
 * "Add" button (rent-only products open their page to pick dates).
 */
import React, { useEffect, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { C, GUTTER } from "@/theme";
import { cart, formatETB, navigate, useShop, wishlist } from "@/lib/store";
import type { ProductDTO } from "@/lib/types";
import { Icon, ICON, T, Tap } from "@/components/ui";
import { ProductArt } from "@/components/ProductArt";
import { EmptyBox, errText, MiniBtn, RED, TabTitle, type Account } from "./shared";

export function WishlistTab({ a }: { a: Account }) {
  const shop = useShop();
  const { width } = useWindowDimensions();
  const cardW = (width - GUTTER * 2 - 12) / 2;
  const [adding, setAdding] = useState<Record<string, "pending" | "added" | undefined>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    const running = timers.current;
    return () => Object.values(running).forEach(clearTimeout);
  }, []);

  const saved = shop.wishlist.map((id) => a.products.find((p) => p.id === id)).filter((p): p is ProductDTO => !!p);
  const mark = (id: string, state: "pending" | "added" | undefined, error = "") => {
    setAdding((m) => ({ ...m, [id]: state }));
    setErrors((m) => ({ ...m, [id]: error }));
  };

  const addToCart = (p: ProductDTO) => {
    if (adding[p.id]) return;
    if (p.rentOnly) {
      navigate("/product/" + p.id);
      return;
    }
    mark(p.id, "pending");
    cart.add({ productId: p.id, mode: "buy", qty: 1 }).then(
      () => {
        mark(p.id, "added");
        clearTimeout(timers.current[p.id]);
        timers.current[p.id] = setTimeout(() => mark(p.id, undefined), 1500);
      },
      (err) => mark(p.id, undefined, errText(err)),
    );
  };
  const remove = (p: ProductDTO) => {
    setErrors((m) => ({ ...m, [p.id]: "" }));
    wishlist.toggle(p.id).catch((err) => setErrors((m) => ({ ...m, [p.id]: errText(err) })));
  };

  return (
    <>
      <TabTitle eyebrow="Saved for later" title="Wishlist" />
      {saved.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {saved.map((p) => {
            const state = adding[p.id];
            const err = errors[p.id];
            const href = "/product/" + p.id;
            return (
              <View key={p.id} style={{ width: cardW, borderWidth: 1, borderColor: C.line, borderRadius: 20, backgroundColor: C.white, paddingTop: 8, paddingHorizontal: 8, paddingBottom: 12, gap: 10 }}>
                <View>
                  <Tap href={href} label={p.name} hitSlop={0} style={{ height: 214, borderRadius: 20, backgroundColor: p.bg, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <ProductArt kind={p.kind} size={Math.min(150, cardW - 22)} />
                  </Tap>
                  {p.was ? (
                    <View style={{ position: "absolute", top: 12, left: 12, height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: C.red, justifyContent: "center" }}>
                      <T s={12} w={700} c={C.white}>
                        Sale
                      </T>
                    </View>
                  ) : null}
                  <Tap
                    onPress={() => remove(p)}
                    label={"Remove " + p.name + " from wishlist"}
                    hitSlop={4}
                    style={{ position: "absolute", top: 10, right: 10, width: 44, height: 44, borderRadius: 999, backgroundColor: C.white, alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                  >
                    <Icon xml={ICON.heart} size={18} sw={1.8} color={C.coral} fill={C.coral} />
                  </Tap>
                </View>
                <View style={{ paddingHorizontal: 4, gap: 6, flexGrow: 1 }}>
                  <T s={12} c={C.muted}>
                    {p.cat}
                  </T>
                  <Tap href={href} hitSlop={0}>
                    <T s={14} w={700} lh={18.2} ls={-0.21} numberOfLines={2}>
                      {p.name}
                    </T>
                  </Tap>
                  <View style={{ paddingTop: 6, gap: 8, flexGrow: 1, justifyContent: "space-between" }}>
                    <View style={{ gap: 2 }}>
                      <T s={16} w={700} c={p.was ? C.red : C.ink}>
                        {p.rentOnly && p.rent ? formatETB(p.rent) + "/day" : formatETB(p.buy)}
                      </T>
                      <T s={12} c={err ? RED : C.muted} accessibilityLiveRegion="polite">
                        {err ? err : p.was ? "was " + formatETB(p.was) : p.rent ? "or rent " + formatETB(p.rent) + "/day" : "Free delivery"}
                      </T>
                    </View>
                    <MiniBtn
                      title={state === "pending" ? "Adding…" : state === "added" ? "Added" : p.rentOnly ? "Rent" : "Add"}
                      onPress={() => addToCart(p)}
                      disabled={state === "pending"}
                      label={"Add to cart: " + p.name}
                      h={40}
                      px={14}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyBox title="Your wishlist is empty" h={220} style={{ gap: 12 }}>
          <MiniBtn title="Browse products" href="/shop" px={18} s={14} />
        </EmptyBox>
      )}
    </>
  );
}
