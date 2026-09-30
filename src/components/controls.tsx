/*
 * Shared controls: breadcrumbs, checkbox, radio, quantity stepper, bottom sheet and the date
 * picker used for rental dates. Styled like the website's form controls.
 */
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, GUTTER } from "@/theme";
import { isoDate } from "@/lib/hooks";
import { Btn, H, Icon, ICON, T, Tap } from "./ui";

// ── Breadcrumbs ───────────────────────────────────────────────────────────────

export type Crumb = { label: string; href?: string };

/** "Home › Electronics › Lumen Z6 Camera": links in grey, the current page in bold. */
export function Breadcrumbs({ items, separator = "chevron", style }: { items: Crumb[]; separator?: "chevron" | "slash"; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityLabel="Breadcrumb" style={[{ paddingHorizontal: GUTTER, paddingTop: 22, flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 10, rowGap: 2 }, style]}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 ? (
              separator === "chevron" ? (
                <Icon xml={ICON.chevronRight} size={14} color={C.muted} />
              ) : (
                <T s={14} c={C.muted}>
                  /
                </T>
              )
            ) : null}
            {it.href && !last ? (
              <Tap href={it.href} style={{ height: 28, justifyContent: "center" }}>
                <T s={14} c={C.muted}>
                  {it.label}
                </T>
              </Tap>
            ) : (
              <T s={14} w={last ? 600 : 400} c={last ? C.ink : C.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
                {it.label}
              </T>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ── Checkbox / radio ──────────────────────────────────────────────────────────

/** Square tick box. Use inside a <Tap> row, or pass onChange to make the box itself pressable. */
export function Checkbox({ checked, onChange, size = 20, color = C.green, label }: { checked: boolean; onChange?: (next: boolean) => void; size?: number; color?: string; label?: string }) {
  const box = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 5,
        borderWidth: checked ? 0 : 1.5,
        borderColor: "#8A8F99",
        backgroundColor: checked ? color : C.white,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {checked ? <Icon xml={ICON.check} size={size - 6} color={C.white} sw={3} /> : null}
    </View>
  );
  if (!onChange) return box;
  return (
    <Pressable onPress={() => onChange(!checked)} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label}>
      {box}
    </Pressable>
  );
}

/** Round radio dot. Put it inside the pressable option row. */
export function Radio({ checked, size = 18, color = C.green }: { checked: boolean; size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 999, borderWidth: checked ? 2 : 1.5, borderColor: checked ? color : "#8A8F99", backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
      {checked ? <View style={{ width: size - 8, height: size - 8, borderRadius: 999, backgroundColor: color }} /> : null}
    </View>
  );
}

// ── Quantity stepper ──────────────────────────────────────────────────────────

export function QtyStepper({ value, onChange, min = 1, max = 99, disabled, h = 46 }: { value: number; onChange: (next: number) => void; min?: number; max?: number; disabled?: boolean; h?: number }) {
  const canDown = value > min && !disabled;
  const canUp = value < max && !disabled;
  return (
    <View style={{ height: h, paddingHorizontal: 4, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 14, flexDirection: "row", alignItems: "center", backgroundColor: C.white }}>
      <Tap onPress={() => canDown && onChange(value - 1)} disabled={!canDown} label="Decrease quantity" hitSlop={4} style={{ width: 38, height: h - 8, alignItems: "center", justifyContent: "center", opacity: canDown ? 1 : 0.35 }}>
        <Icon xml={ICON.minus} size={16} sw={2.2} />
      </Tap>
      <T s={15} w={700} center style={{ minWidth: 32 }}>
        {value}
      </T>
      <Tap onPress={() => canUp && onChange(value + 1)} disabled={!canUp} label="Increase quantity" hitSlop={4} style={{ width: 38, height: h - 8, alignItems: "center", justifyContent: "center", opacity: canUp ? 1 : 0.35 }}>
        <Icon xml={ICON.plus} size={16} sw={2.2} />
      </Tap>
    </View>
  );
}

// ── Bottom sheet ──────────────────────────────────────────────────────────────

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  /** fixed footer (e.g. a "Show results" button) */
  footer?: React.ReactNode;
  /** let the body scroll (default true) */
  scroll?: boolean;
};

/** A sheet that slides up from the bottom over a dimmed page (the site's mobile filter sheet). */
export function Sheet({ open, onClose, title, children, footer, scroll = true }: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable onPress={onClose} accessibilityLabel={"Close " + title} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(10,20,35,0.45)" }} />
        <View style={{ maxHeight: "86%", backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: "0 -20px 50px -20px rgba(10,20,35,0.4)" }}>
          <View style={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 999, backgroundColor: "#D9D6CF", marginBottom: 10 }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <T s={17} w={700}>
                {title}
              </T>
              <Tap onPress={onClose} label={"Close " + title} style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: C.sand, alignItems: "center", justifyContent: "center" }}>
                <Icon xml={ICON.close} size={18} />
              </Tap>
            </View>
          </View>
          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: footer ? 20 : 20 + insets.bottom }}>
              {children}
            </ScrollView>
          ) : (
            <View style={{ padding: 20, paddingBottom: footer ? 20 : 20 + insets.bottom }}>{children}</View>
          )}
          {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 + insets.bottom, borderTopWidth: 1, borderTopColor: C.line }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

// ── Dates ─────────────────────────────────────────────────────────────────────

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "yyyy-mm-dd" → local Date at midnight (null when empty / invalid). */
export function parseISO(iso: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
/** Adds days to a yyyy-mm-dd date. */
export function addDaysISO(iso: string, days: number): string {
  const d = parseISO(iso) || new Date();
  d.setDate(d.getDate() + days);
  return isoDate(d);
}
/** "Sun, 4 Oct" (add `year` for "Sun, 4 Oct 2026"). */
export function formatDay(iso: string | null | undefined, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = parseISO(iso);
  if (!d) return "";
  const { weekday = true, year = false } = opts;
  return (weekday ? DAYS_SHORT[d.getDay()] + ", " : "") + d.getDate() + " " + MONTHS_SHORT[d.getMonth()] + (year ? " " + d.getFullYear() : "");
}

export type DateFieldProps = {
  label?: string;
  /** yyyy-mm-dd */
  value: string;
  onChange: (iso: string) => void;
  /** earliest selectable day (yyyy-mm-dd) */
  min?: string;
  max?: string;
  error?: string | null;
  h?: number;
  style?: StyleProp<ViewStyle>;
};

/** A date box that opens a calendar sheet (the site uses the browser's date input here). */
export function DateField({ label, value, onChange, min, max, error, h = 52, style }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[{ gap: 8 }, style]}>
      {label ? (
        <T s={14} w={600}>
          {label}
        </T>
      ) : null}
      <Tap
        onPress={() => setOpen(true)}
        hitSlop={0}
        accessibilityRole="button"
        label={(label ? label + ": " : "") + (formatDay(value, { year: true }) || "choose a date")}
        style={{ height: h, paddingHorizontal: 14, borderWidth: 1, borderColor: error ? C.red : C.lineStrong, borderRadius: 14, backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}
      >
        <T s={15} c={value ? C.ink : C.faint}>
          {formatDay(value, { year: true }) || "Choose a date"}
        </T>
        <Icon xml={ICON.calendar} size={18} sw={1.8} />
      </Tap>
      {error ? (
        <T s={13} w={500} c={C.red}>
          {error}
        </T>
      ) : null}
      <CalendarSheet open={open} onClose={() => setOpen(false)} value={value} min={min} max={max} title={label || "Choose a date"} onPick={onChange} />
    </View>
  );
}

/** Month calendar in a bottom sheet. */
export function CalendarSheet({ open, onClose, value, onPick, min, max, title = "Choose a date" }: { open: boolean; onClose: () => void; value: string; onPick: (iso: string) => void; min?: string; max?: string; title?: string }) {
  const selected = parseISO(value);
  const start = selected || parseISO(min) || new Date();
  const [month, setMonth] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const [picked, setPicked] = useState(value);
  // re-sync when the sheet is reopened with a different value
  const [lastOpenValue, setLastOpenValue] = useState(value);
  if (open && lastOpenValue !== value) {
    setLastOpenValue(value);
    setPicked(value);
    if (selected) setMonth({ y: selected.getFullYear(), m: selected.getMonth() });
  }

  const first = new Date(month.y, month.m, 1);
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const move = (delta: number) => {
    const d = new Date(month.y, month.m + delta, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };
  const canPrev = !min || isoDate(new Date(month.y, month.m, 0)) >= min;
  const canNext = !max || isoDate(new Date(month.y, month.m + 1, 1)) <= max;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      scroll={false}
      footer={
        <Btn
          title={picked ? "Choose " + formatDay(picked) : "Choose a date"}
          full
          disabled={!picked}
          onPress={() => {
            onPick(picked);
            onClose();
          }}
        />
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <Tap onPress={() => canPrev && move(-1)} disabled={!canPrev} label="Previous month" style={{ width: 40, height: 40, borderRadius: 999, borderWidth: 1, borderColor: C.lineStrong, alignItems: "center", justifyContent: "center", opacity: canPrev ? 1 : 0.35 }}>
          <Icon xml={ICON.chevronLeft} size={16} />
        </Tap>
        <H s={20} lh={24}>
          {MONTHS[month.m]} {month.y}
        </H>
        <Tap onPress={() => canNext && move(1)} disabled={!canNext} label="Next month" style={{ width: 40, height: 40, borderRadius: 999, borderWidth: 1, borderColor: C.lineStrong, alignItems: "center", justifyContent: "center", opacity: canNext ? 1 : 0.35 }}>
          <Icon xml={ICON.chevronRight} size={16} />
        </Tap>
      </View>
      <View style={{ flexDirection: "row" }}>
        {DAYS_SHORT.map((d) => (
          <T key={d} s={12} w={600} c={C.muted} center style={{ flex: 1, paddingBottom: 6 }}>
            {d}
          </T>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={{ flexDirection: "row" }}>
          {cells.slice(row * 7, row * 7 + 7).map((day, i) => {
            if (!day) return <View key={i} style={{ flex: 1, height: 44 }} />;
            const iso = isoDate(new Date(month.y, month.m, day));
            const off = (!!min && iso < min) || (!!max && iso > max);
            const on = iso === picked;
            return (
              <Pressable key={i} disabled={off} onPress={() => setPicked(iso)} accessibilityRole="button" accessibilityLabel={formatDay(iso, { year: true })} accessibilityState={{ selected: on, disabled: off }} style={{ flex: 1, height: 44, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: on ? C.green : "transparent" }}>
                  <T s={15} w={on ? 700 : 500} c={on ? C.white : off ? "#C5C2BA" : C.ink}>
                    {day}
                  </T>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </Sheet>
  );
}
