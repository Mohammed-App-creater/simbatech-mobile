/*
 * Pieces the checkout and order-confirmed pages share: the white section card, an order line
 * (artwork tile with a quantity badge), and the rows of the totals list.
 */
import React from "react";
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { C } from "@/theme";
import { ProductArt } from "@/components/ProductArt";
import { H, T } from "@/components/ui";

/** Page background of the checkout flow, also used for the soft panels inside cards. */
export const SOFT = "#F6F5F1";
export const SUMMARY_SHADOW = "0 24px 60px -32px rgba(13,79,139,0.35)";

export function Card({ children, gap = 20, pad = 28, style, onLayout }: { children?: React.ReactNode; gap?: number; pad?: number; style?: StyleProp<ViewStyle>; onLayout?: (e: LayoutChangeEvent) => void }) {
  return (
    <View onLayout={onLayout} style={[{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 28, padding: pad, gap }, style]}>
      {children}
    </View>
  );
}

export type OrderLineProps = { name: string; kind: string; bg: string; qty: number; variant?: string; meta: string; price: string; rent: boolean };

/** One item in "Your order" / "Order summary". */
export function OrderLine({ name, kind, bg, qty, variant, meta, price, rent }: OrderLineProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        <ProductArt kind={kind} size={54} />
        <View style={{ position: "absolute", top: -6, right: -6, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 999, backgroundColor: rent ? C.green : C.navy, alignItems: "center", justifyContent: "center" }}>
          <T s={11} w={700} c={C.white}>
            {qty}
          </T>
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T s={14} w={700}>
          {name}
        </T>
        {variant ? (
          <T s={12} w={600} c={C.muted}>
            {variant}
          </T>
        ) : null}
        <T s={12} w={600} c={rent ? C.green : C.muted}>
          {meta}
        </T>
      </View>
      <T s={14} w={700}>
        {price}
      </T>
    </View>
  );
}

/** "Purchases … ETB 18,900" */
export function SumRow({
  label,
  sub,
  value,
  labelColor = C.text,
  labelWeight = 400,
  valueColor = C.ink,
  valueWeight = 600,
}: {
  label: string;
  sub?: string;
  value: string;
  labelColor?: string;
  labelWeight?: 400 | 600;
  valueColor?: string;
  valueWeight?: 600 | 700;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flexShrink: 1 }}>
        <T s={15} w={labelWeight} c={labelColor}>
          {label}
        </T>
        {sub ? (
          <T s={12} c={C.muted}>
            {sub}
          </T>
        ) : null}
      </View>
      <T s={15} w={valueWeight} c={valueColor} style={{ textAlign: "right", flexShrink: 1 }}>
        {value}
      </T>
    </View>
  );
}

/** The "Total" line under the totals list. */
export function TotalRow({ note, total }: { note?: string; total: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T s={16} w={700}>
          Total
        </T>
        {note ? (
          <T s={12} c={C.muted}>
            {note}
          </T>
        ) : null}
      </View>
      <H s={24} lh={28} ls={-0.84} accessibilityLiveRegion="polite">
        {total}
      </H>
    </View>
  );
}
