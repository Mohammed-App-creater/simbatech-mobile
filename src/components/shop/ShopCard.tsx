/*
 * The shop grid's product card. It looks like the shared ProductCard, but the shop decides what it
 * shows: the Buy / Rent side (so the price filter and sorting follow it), the rental price for the
 * chosen period and the line under the price. "Rent" opens the product page to pick dates; "Add"
 * puts one in the cart.
 */
import React, { useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { C } from "@/theme";
import { cart, formatETB, navigate } from "@/lib/store";
import { useAction } from "@/lib/hooks";
import type { ProductDTO } from "@/lib/types";
import { ProductArt } from "@/components/ProductArt";
import { productHref, Rating, WishButton } from "@/components/ProductCard";
import { T, Tap } from "@/components/ui";

export type ShopCardProps = {
  product: ProductDTO;
  /** show the rental side (price per period, green "Rent" button) */
  showRent: boolean;
  /** the price to show: the buy price, or the rental price for the chosen period */
  price: number;
  /** "/ day", "/ week", "/ month" next to a rental price */
  unit: string;
  /** the line under the price ("or rent ETB 800/day", "was ETB 3,600", …) */
  sub: string;
  onPick: (mode: "buy" | "rent") => void;
  style?: StyleProp<ViewStyle>;
};

export function ShopCard({ product: p, showRent, price, unit, sub, onPick, style }: ShopCardProps) {
  const action = useAction();
  const [wishErr, setWishErr] = useState("");
  const href = productHref(p);
  const canToggle = !!p.rent && !p.rentOnly;
  const tag = p.rent ? (p.rentOnly ? "For rent" : "Buy or rent") : p.was ? "Sale" : "Buy";
  const tagBg = tag === "Sale" ? C.red : p.rent ? C.green : C.white;
  const tagFg = tag === "Sale" || p.rent ? C.white : C.ink;
  const err = action.err || wishErr;
  const add = () => {
    setWishErr("");
    if (showRent) navigate(href);
    else action.run(() => cart.add({ productId: p.id, mode: "buy", qty: 1 }));
  };

  return (
    <View style={[{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 20, paddingTop: 8, paddingHorizontal: 8, paddingBottom: 12, gap: 10 }, style]}>
      <Tap href={href} label={p.name} hitSlop={0} style={{ height: 136, borderRadius: 14, backgroundColor: p.bg, alignItems: "center", justifyContent: "center" }}>
        <ProductArt kind={p.kind} size={116} />
        <View style={{ position: "absolute", top: 8, left: 8, height: 22, paddingHorizontal: 8, borderRadius: 999, backgroundColor: tagBg, justifyContent: "center" }}>
          <T s={11} w={700} c={tagFg} lh={14}>
            {tag}
          </T>
        </View>
      </Tap>
      <WishButton
        product={p}
        onError={(message) => {
          if (action.err) action.clear();
          setWishErr(message);
        }}
        style={{ position: "absolute", top: 8 + 136 - 8 - 34, right: 16 }}
      />

      <View style={{ paddingHorizontal: 4, marginTop: -6, gap: 6, flexGrow: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <T s={12} c={C.muted} numberOfLines={2} style={{ flexShrink: 1 }}>
            {p.brand ? p.brand + " · " + p.cat : p.cat}
          </T>
          <Rating value={p.rating} />
        </View>
        <Tap href={href} hitSlop={0}>
          <T s={14} w={700} lh={18.2} ls={-0.21} numberOfLines={2}>
            {p.name}
          </T>
        </Tap>
        {canToggle ? (
          <View style={{ alignSelf: "flex-start", marginTop: 2, padding: 3, borderRadius: 10, backgroundColor: C.sand, flexDirection: "row", gap: 2 }} accessibilityLabel={"Buy or rent " + p.name}>
            <Tap onPress={() => onPick("buy")} hitSlop={2} accessibilityState={{ selected: !showRent }} style={{ height: 28, paddingHorizontal: 12, borderRadius: 8, backgroundColor: showRent ? "transparent" : C.white, justifyContent: "center" }}>
              <T s={12} w={700} c={showRent ? C.muted : C.navy}>
                Buy
              </T>
            </Tap>
            <Tap onPress={() => onPick("rent")} hitSlop={2} accessibilityState={{ selected: showRent }} style={{ height: 28, paddingHorizontal: 12, borderRadius: 8, backgroundColor: showRent ? C.green : "transparent", justifyContent: "center" }}>
              <T s={12} w={700} c={showRent ? C.white : C.muted}>
                Rent
              </T>
            </Tap>
          </View>
        ) : null}
        <View style={{ paddingTop: 6, gap: 8, flexGrow: 1, justifyContent: "space-between" }}>
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 4 }}>
              <T s={16} w={700}>
                {formatETB(price)}
              </T>
              {showRent ? (
                <T s={13} c={C.muted}>
                  {unit}
                </T>
              ) : null}
            </View>
            <T s={12} c={err ? C.red : C.muted} accessibilityLiveRegion={err ? "polite" : "none"}>
              {err || sub}
            </T>
          </View>
          <Tap
            onPress={add}
            disabled={action.busy}
            label={(showRent ? "Rent " : "Add to cart: ") + p.name}
            hitSlop={0}
            style={{ height: 40, borderRadius: 12, backgroundColor: showRent ? C.green : C.navy, alignItems: "center", justifyContent: "center", opacity: action.busy ? 0.7 : 1 }}
          >
            <T s={13} w={700} c={C.white}>
              {showRent ? "Rent" : action.busy ? "Adding…" : action.done ? "Added" : "Add"}
            </T>
          </Tap>
        </View>
      </View>
    </View>
  );
}
