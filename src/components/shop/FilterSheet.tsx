/*
 * The shop's filters in a bottom sheet (the website's sidebar, which becomes a sheet on phones):
 * category, price range, rental period, brand, rating and the two availability switches.
 * Every control filters the grid straight away; "Show results" just closes the sheet.
 */
import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, TextInput, View, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, F } from "@/theme";
import { Checkbox, Radio, Sheet } from "@/components/controls";
import { Btn, H, Icon, ICON, T, Tap } from "@/components/ui";
import { brandOptions, categoryOptions, PERIODS, PMAX, PRICE_STEP, RATINGS, type FacetOption, type ShopData, type ShopFilters } from "./filters";

// ── Segmented control (All / Buy / Rent, Daily / Weekly / Monthly) ────────────

export function Segmented<Id extends string>({
  options,
  value,
  onChange,
  label,
  stretch,
  s = 14,
  onColor = () => C.navy,
}: {
  options: readonly { id: Id; label: string }[];
  value: Id;
  onChange: (id: Id) => void;
  label: string;
  /** share the width equally instead of hugging the labels */
  stretch?: boolean;
  s?: number;
  /** text colour of the selected option */
  onColor?: (id: Id) => string;
}) {
  return (
    <View accessibilityLabel={label} style={{ flexDirection: "row", gap: 4, padding: 4, backgroundColor: C.sand, borderRadius: 14 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Tap
            key={o.id}
            onPress={() => onChange(o.id)}
            hitSlop={2}
            accessibilityState={{ selected: on }}
            style={[{ height: 40, paddingHorizontal: stretch ? 6 : 18, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: on ? C.white : "transparent" }, stretch && { flex: 1 }, on && { boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }]}
          >
            <T s={s} w={600} c={on ? onColor(o.id) : C.muted}>
              {o.label}
            </T>
          </Tap>
        );
      })}
    </View>
  );
}

// ── Sheet sections ────────────────────────────────────────────────────────────

function Section({ title, children, first, gap = 2, pb = 18 }: { title: string; children: React.ReactNode; first?: boolean; gap?: number; pb?: number }) {
  return (
    <View style={{ paddingTop: first ? 0 : 18, paddingBottom: pb, borderBottomWidth: 1, borderBottomColor: C.line, gap }}>
      <H s={18} lh={22} ls={-0.36} accessibilityRole="header" style={{ paddingBottom: gap === 2 ? 10 : 0 }}>
        {title}
      </H>
      {children}
    </View>
  );
}

/** A tick-box row with the number of products it would show. */
function FacetRow({ option, onToggle }: { option: FacetOption; onToggle: () => void }) {
  return (
    <Tap onPress={onToggle} hitSlop={0} accessibilityRole="checkbox" accessibilityState={{ checked: option.checked }} label={option.label + ", " + option.count} style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Checkbox checked={option.checked} size={18} color={C.navy} />
      <T s={14} w={500} numberOfLines={1} style={{ flex: 1 }}>
        {option.label}
      </T>
      <T s={13} c={C.muted} style={{ fontVariant: ["tabular-nums"] }}>
        {option.count}
      </T>
    </Tap>
  );
}

function PriceBox({ label, value, onChange }: { label: string; value: number; onChange: (next: number) => void }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <T s={12} c={C.muted}>
        {label}
      </T>
      <TextInput
        value={String(value)}
        onChangeText={(text) => onChange(parseInt(text.replace(/[^0-9]/g, ""), 10) || 0)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        keyboardType="number-pad"
        returnKeyType="done"
        maxLength={7}
        selectTextOnFocus
        accessibilityLabel={label + " price in birr"}
        style={[
          { height: 44, paddingHorizontal: 12, paddingVertical: 0, borderWidth: 1, borderColor: focus ? C.navy : C.lineStrong, borderRadius: 12, backgroundColor: C.white, fontFamily: F.g600, fontSize: 14, color: C.ink },
          { outlineWidth: 0 } as TextStyle,
        ]}
      />
    </View>
  );
}

const clampPrice = (v: number) => Math.max(0, Math.min(PMAX, v));
const snapPrice = (v: number) => Math.round(v / PRICE_STEP) * PRICE_STEP;

/** The price track with a handle for each end (the website draws the same track under its two number boxes). */
function PriceRange({ min, max, onChange }: { min: number; max: number; onChange: (patch: { minP?: number; maxP?: number }) => void }) {
  const [width, setWidth] = useState(0);
  // where the current drag started: the finger's x and both prices
  const drag = useRef({ x: 0, min: 0, max: PMAX });
  const dragTo = (handle: "min" | "max", pageX: number) => {
    if (!width) return;
    const start = drag.current;
    const dx = pageX - start.x;
    const delta = (dx / width) * PMAX;
    // handles on top of each other: the drag direction picks which one moves
    const together = start.min === start.max;
    const moving = together ? (dx < 0 ? "min" : "max") : handle;
    if (moving === "min") onChange({ minP: Math.max(0, Math.min(snapPrice(start.min + delta), start.max)), ...(together ? { maxP: start.max } : null) });
    else onChange({ maxP: Math.min(PMAX, Math.max(snapPrice(start.max + delta), start.min)), ...(together ? { minP: start.min } : null) });
  };

  const lo = clampPrice(Math.min(min, max));
  const hi = clampPrice(Math.max(min, max));
  const pct = (v: number) => `${(clampPrice(v) / PMAX) * 100}%` as const;
  const step = (key: "minP" | "maxP", value: number, dir: 1 | -1) => onChange({ [key]: clampPrice(snapPrice(value) + dir * PRICE_STEP) });

  return (
    <View style={{ height: 20, marginHorizontal: 9 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ position: "absolute", left: -9, right: -9, top: 8, height: 4, borderRadius: 999, backgroundColor: C.line }} />
      <View style={{ position: "absolute", left: pct(lo), width: `${((hi - lo) / PMAX) * 100}%`, top: 8, height: 4, borderRadius: 999, backgroundColor: C.navy }} />
      {(["min", "max"] as const).map((handle) => {
        const value = handle === "min" ? min : max;
        const key = handle === "min" ? "minP" : "maxP";
        return (
          <View
            key={handle}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onResponderGrant={(e) => {
              drag.current = { x: e.nativeEvent.pageX, min: clampPrice(min), max: clampPrice(max) };
            }}
            onResponderMove={(e) => dragTo(handle, e.nativeEvent.pageX)}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={(handle === "min" ? "Lowest" : "Highest") + " price"}
            accessibilityValue={{ min: 0, max: PMAX, now: clampPrice(value) }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={(e) => step(key, value, e.nativeEvent.actionName === "increment" ? 1 : -1)}
            style={{ position: "absolute", left: pct(value), top: -12, marginLeft: -22, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <View style={{ width: 18, height: 18, borderRadius: 999, backgroundColor: C.white, borderWidth: 3, borderColor: C.navy }} />
          </View>
        );
      })}
    </View>
  );
}

function SwitchRow({ label, sub, on, onToggle }: { label: string; sub: string; on: boolean; onToggle: () => void }) {
  return (
    <Tap onPress={onToggle} hitSlop={0} accessibilityRole="switch" accessibilityState={{ checked: on }} label={label + ". " + sub} style={{ height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <View style={{ gap: 1, flexShrink: 1 }}>
        <T s={15} w={700}>
          {label}
        </T>
        <T s={12} c={C.muted}>
          {sub}
        </T>
      </View>
      <View style={{ width: 44, height: 26, borderRadius: 999, backgroundColor: on ? C.green : "#C9C6BE" }}>
        <View style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 999, backgroundColor: C.white, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </View>
    </Tap>
  );
}

/** Height of the on-screen keyboard on iOS (Android resizes the window itself), so the sheet can stay above it. */
function useIosKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const show = Keyboard.addListener("keyboardWillShow", (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardWillHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

// ── The sheet ─────────────────────────────────────────────────────────────────

export type FilterSheetProps = {
  open: boolean;
  onClose: () => void;
  filters: ShopFilters;
  data: ShopData;
  /** change filters; the grid goes back to its first page */
  onChange: (patch: Partial<ShopFilters>) => void;
};

export function FilterSheet({ open, onClose, filters: f, data, onChange }: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const keyboard = useIosKeyboardHeight();
  const flip = (key: "cats" | "brands", name: string) => onChange({ [key]: { ...f[key], [name]: !f[key][name] } });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filters"
      footer={
        <View>
          <Btn title="Show results" full s={16} onPress={onClose} />
          {keyboard ? <View style={{ height: Math.max(0, keyboard - insets.bottom) }} /> : null}
        </View>
      }
    >
      <Section title="Category" first>
        {categoryOptions(f, data).map((o) => (
          <FacetRow key={o.label} option={o} onToggle={() => flip("cats", o.label)} />
        ))}
      </Section>

      <Section title="Price (ETB)" gap={14} pb={22}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <PriceBox label="Min" value={f.minP} onChange={(minP) => onChange({ minP })} />
          <T s={16} c={C.muted} style={{ paddingTop: 18 }}>
            –
          </T>
          <PriceBox label="Max" value={f.maxP} onChange={(maxP) => onChange({ maxP })} />
        </View>
        <PriceRange min={f.minP} max={f.maxP} onChange={onChange} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <T s={12} c={C.muted}>
            ETB 0
          </T>
          <T s={12} c={C.muted}>
            ETB 150,000+
          </T>
        </View>
      </Section>

      <Section title="Rental period" gap={10} pb={22}>
        <Segmented label="Rental period" options={PERIODS} value={f.period} onChange={(period) => onChange({ period })} stretch s={13} onColor={() => C.green} />
        <T s={12} lh={18} c={C.muted}>
          Changes how rental prices are shown. Each item shows its refundable deposit.
        </T>
      </Section>

      <Section title="Brand">
        {brandOptions(f, data).map((o) => (
          <FacetRow key={o.label} option={o} onToggle={() => flip("brands", o.label)} />
        ))}
      </Section>

      <Section title="Rating">
        {RATINGS.map((r) => {
          const on = f.rating === r.v;
          return (
            <Tap key={r.v} onPress={() => onChange({ rating: r.v })} hitSlop={0} accessibilityRole="radio" accessibilityState={{ checked: on }} label={r.label} style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Radio checked={on} color={C.navy} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon xml={ICON.star} size={14} color={C.star} filled />
                <T s={14} w={500}>
                  {r.label}
                </T>
              </View>
            </Tap>
          );
        })}
      </Section>

      <View style={{ paddingTop: 14, gap: 4 }}>
        <SwitchRow label="Available now" sub="Ready to deliver today" on={f.availNow} onToggle={() => onChange({ availNow: !f.availNow })} />
        <SwitchRow label="Free delivery" sub="No delivery fee" on={f.freeDel} onToggle={() => onChange({ freeDel: !f.freeDel })} />
      </View>
    </Sheet>
  );
}
