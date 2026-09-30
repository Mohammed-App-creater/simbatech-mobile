/*
 * The product card used in every grid (home "Top products", shop, cart and product recommendations,
 * wishlist): artwork with a tag, a wishlist heart, category and rating, name, an optional Buy / Rent
 * switch, the price and an add-to-cart button. Two cards fit side by side on a phone.
 */
import React, { useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { C } from "@/theme";
import { cart, formatETB, useShop, wishlist } from "@/lib/store";
import { tomorrowISO, useAction } from "@/lib/hooks";
import type { ProductDTO } from "@/lib/types";
import { Icon, ICON, Note, T, Tap } from "./ui";
import { ProductArt } from "./ProductArt";

export const productHref = (p: { id: string } | null | undefined) => (p ? "/product/" + p.id : "/shop");

/** Filled star + rating number. */
export function Rating({ value, size = 12 }: { value: string | number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon xml={ICON.star} size={size + 1} color={C.star} filled />
      <T s={size} w={600}>
        {value}
      </T>
    </View>
  );
}

/** Heart button that saves / removes a product from the wishlist (guests are sent to sign in). */
export function WishButton({ product, size = 34, onError, style }: { product: ProductDTO; size?: number; onError?: (message: string) => void; style?: StyleProp<ViewStyle> }) {
  const shop = useShop();
  const saved = wishlist.has(shop, product.id);
  return (
    <Tap
      onPress={() => {
        if (onError) onError("");
        wishlist.toggle(product.id).catch((err) => onError && onError((err && err.message) || "Could not update your wishlist."));
      }}
      label={(saved ? "Remove from" : "Save to") + " wishlist: " + product.name}
      accessibilityState={{ selected: saved }}
      style={[{ width: size, height: size, borderRadius: 999, backgroundColor: C.white, alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }, style]}
    >
      <Icon xml={ICON.heart} size={Math.round(size * 0.53)} sw={1.8} color={saved ? C.coral : C.ink} fill={saved ? C.coral : "none"} />
    </Tap>
  );
}

export type ProductCardProps = {
  product: ProductDTO;
  /** start on the rental price when the product can be rented (e.g. the "Most rented" tab, rent mode in the shop) */
  preferRent?: boolean;
  /** show "Brand · Category" instead of just the category (the shop grid) */
  showBrand?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ProductCard({ product: p, preferRent = false, showBrand = false, style }: ProductCardProps) {
  const [picked, setPicked] = useState<"buy" | "rent" | null>(null);
  const [wishErr, setWishErr] = useState("");
  const action = useAction();
  const showRent = !!p.rent && (p.rentOnly || (picked ? picked === "rent" : preferRent));
  const canToggle = !!p.rent && !p.rentOnly;
  const tag = p.rent ? (p.rentOnly ? "For rent" : "Buy or rent") : p.was ? "Sale" : "Buy";
  const tagBg = tag === "Sale" ? C.red : p.rent ? C.green : C.white;
  const tagFg = tag === "Sale" || p.rent ? C.white : C.ink;
  const sub = p.rent ? (showRent ? "or buy " + formatETB(p.buy) : "or rent " + formatETB(p.rent) + "/day") : p.was ? "was " + formatETB(p.was) : p.shipsInDays ? "Ships in " + p.shipsInDays + " days" : "Free delivery";
  const add = () =>
    action.run(() => (showRent ? cart.add({ productId: p.id, mode: "rent", qty: 1, rentStart: tomorrowISO(), rentDays: 1 }) : cart.add({ productId: p.id, mode: "buy", qty: 1 })));

  return (
    <View style={[{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 20, paddingTop: 8, paddingHorizontal: 8, paddingBottom: 12, gap: 10 }, style]}>
      <Tap href={productHref(p)} label={p.name} hitSlop={0} style={{ height: 136, borderRadius: 14, backgroundColor: p.bg, alignItems: "center", justifyContent: "center" }}>
        <ProductArt kind={p.kind} size={116} />
        <View style={{ position: "absolute", top: 8, left: 8, height: 22, paddingHorizontal: 8, borderRadius: 999, backgroundColor: tagBg, justifyContent: "center" }}>
          <T s={11} w={700} c={tagFg} lh={14}>
            {tag}
          </T>
        </View>
      </Tap>
      <WishButton product={p} onError={setWishErr} style={{ position: "absolute", top: 8 + 136 - 8 - 34, right: 16 }} />

      <View style={{ paddingHorizontal: 4, marginTop: -6, gap: 6, flexGrow: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <T s={12} c={C.muted} numberOfLines={2} style={{ flexShrink: 1 }}>
            {showBrand && p.brand ? p.brand + " · " + p.cat : p.cat}
          </T>
          <Rating value={p.rating} />
        </View>
        <Tap href={productHref(p)} hitSlop={0}>
          <T s={14} w={700} lh={18.2} ls={-0.21} numberOfLines={2}>
            {p.name}
          </T>
        </Tap>
        {canToggle ? (
          <View style={{ alignSelf: "flex-start", marginTop: 2, padding: 3, borderRadius: 10, backgroundColor: C.sand, flexDirection: "row", gap: 2 }} accessibilityLabel={"Buy or rent " + p.name}>
            <Tap onPress={() => setPicked("buy")} hitSlop={2} accessibilityState={{ selected: !showRent }} style={{ height: 28, paddingHorizontal: 12, borderRadius: 8, backgroundColor: showRent ? "transparent" : C.white, justifyContent: "center" }}>
              <T s={12} w={700} c={showRent ? C.muted : C.navy}>
                Buy
              </T>
            </Tap>
            <Tap onPress={() => setPicked("rent")} hitSlop={2} accessibilityState={{ selected: showRent }} style={{ height: 28, paddingHorizontal: 12, borderRadius: 8, backgroundColor: showRent ? C.green : "transparent", justifyContent: "center" }}>
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
                {showRent ? formatETB(p.rent || 0) : formatETB(p.buy)}
              </T>
              {showRent ? (
                <T s={13} w={500} c={C.muted}>
                  / day
                </T>
              ) : null}
            </View>
            <T s={12} c={C.muted}>
              {sub}
            </T>
          </View>
          <Tap
            onPress={add}
            disabled={action.busy}
            label={(showRent ? "Rent for 1 day from tomorrow: " : "Add to cart: ") + p.name}
            hitSlop={0}
            style={{ height: 40, borderRadius: 12, backgroundColor: C.navy, alignItems: "center", justifyContent: "center", opacity: action.busy ? 0.7 : 1 }}
          >
            <T s={13} w={700} c={C.white}>
              {action.busy ? "…" : action.done ? "Added" : showRent ? "Rent" : "Add"}
            </T>
          </Tap>
          <Note>{action.err || wishErr}</Note>
        </View>
      </View>
    </View>
  );
}
