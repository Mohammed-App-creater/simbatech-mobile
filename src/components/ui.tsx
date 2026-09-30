/*
 * Small building blocks every screen uses: text in the brand fonts, icons, pressables, buttons,
 * form fields and loading / error states. Sizes and colours default to the website's.
 */
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { parse, SvgAst, type JsxAST } from "react-native-svg";
import { C, F } from "@/theme";
import { navigate } from "@/lib/store";
import { groupDigits, toLocal } from "@/lib/phone";

// ── Text ──────────────────────────────────────────────────────────────────────

type Weight = 400 | 500 | 600 | 700 | 800;
const GEIST: Record<Weight, string> = { 400: F.g400, 500: F.g500, 600: F.g600, 700: F.g700, 800: F.g800 };
const BRICO: Record<Weight, string> = { 400: F.b500, 500: F.b500, 600: F.b600, 700: F.b700, 800: F.b800 };

export type TProps = TextProps & {
  /** font size */
  s?: number;
  /** weight: 400 | 500 | 600 | 700 | 800 */
  w?: Weight;
  /** colour */
  c?: string;
  /** line height in px */
  lh?: number;
  /** letter spacing in px */
  ls?: number;
  upper?: boolean;
  center?: boolean;
};

/** Body text (Geist). */
export function T({ s = 14, w = 400, c = C.ink, lh, ls, upper, center, style, ...rest }: TProps) {
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: GEIST[w], fontSize: s, color: c },
        lh != null && { lineHeight: lh },
        ls != null && { letterSpacing: ls },
        upper && { textTransform: "uppercase" },
        center && { textAlign: "center" },
        style,
      ]}
    />
  );
}

/** Headings (Bricolage Grotesque): tight tracking and leading like the site. */
export function H({ s = 24, w = 700, c = C.ink, lh, ls, upper, center, style, ...rest }: TProps) {
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: BRICO[w], fontSize: s, color: c, lineHeight: lh ?? Math.round(s * 1.05), letterSpacing: ls ?? -0.035 * s },
        upper && { textTransform: "uppercase" },
        center && { textAlign: "center" },
        style,
      ]}
    />
  );
}

/** The italic serif accent used inside headings ("Get it today."). Nest it in <H> to inherit the size. */
export function Serif({ s, c, ls, lh, style, ...rest }: TProps) {
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: F.serifItalic, letterSpacing: ls ?? (s ? -0.02 * s : -0.5) },
        s != null && { fontSize: s },
        c != null && { color: c },
        lh != null && { lineHeight: lh },
        style,
      ]}
    />
  );
}

/** Small uppercase label above a heading ("DEPARTMENTS"). */
export function Eyebrow({ c = C.navy, s = 12, style, ...rest }: TProps) {
  return <T s={s} w={700} c={c} ls={s * 0.1} upper {...rest} style={style} />;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

/** Inner SVG markup (24 × 24 grid) of the icons the site uses. Pass one as <Icon xml={ICON.cart} />. */
export const ICON = {
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronUp: '<path d="M6 15l6-6 6 6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  cart: '<path d="M5 8h14l-1.2 12H6.2L5 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  heart: '<path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.1 9.5l6.1-.9z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  play: '<path d="M6 3l13 9-13 9z"/>',
  call: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  whatsapp: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8.4 19L4 20z"/><path d="M9.5 9.5c0 3 2 5 5 5l1-1.5-2-1-1 1a4 4 0 0 1-1.5-1.5l1-1-1-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  eye: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  refresh: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  returns: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  filter: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
  squares: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
  userTab: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
} as const;

const astCache = new Map<string, JsxAST | null>();
function svgAst(xml: string) {
  let ast = astCache.get(xml);
  if (ast === undefined) {
    ast = parse(xml);
    astCache.set(xml, ast);
  }
  return ast;
}

export type IconProps = {
  /** inner SVG markup, e.g. ICON.cart or '<path d="…"/>' copied from the site */
  xml?: string;
  /** shortcut for a single path */
  d?: string;
  size?: number;
  color?: string;
  /** stroke width (the site uses 1.7 – 2.2) */
  sw?: number;
  /** draw as a filled shape instead of an outline (stars, social logos) */
  filled?: boolean;
  /** fill colour for outline icons that are also filled (e.g. a saved heart) */
  fill?: string;
  viewBox?: string;
  style?: StyleProp<ViewStyle>;
};

/** An icon drawn from SVG markup, in the site's outline style. */
export function Icon({ xml, d, size = 20, color = C.ink, sw = 2, filled, fill, viewBox = "0 0 24 24", style }: IconProps) {
  const inner = xml ?? (d ? '<path d="' + d + '"/>' : "");
  const doc =
    '<svg viewBox="' +
    viewBox +
    '" fill="' +
    (filled ? color : (fill ?? "none")) +
    '" stroke="' +
    (filled ? "none" : color) +
    '" stroke-width="' +
    sw +
    '" stroke-linecap="round" stroke-linejoin="round">' +
    inner +
    "</svg>";
  const ast = svgAst(doc);
  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      {ast ? <SvgAst ast={ast} override={{ width: size, height: size }} /> : null}
    </View>
  );
}

/** Any complete SVG document (used for logos and illustrations). */
export function SvgDoc({ xml, width, height, style }: { xml: string; width: number; height: number; style?: StyleProp<ViewStyle> }) {
  const ast = svgAst(xml);
  return (
    <View style={[{ width, height }, style]} pointerEvents="none">
      {ast ? <SvgAst ast={ast} override={{ width, height }} /> : null}
    </View>
  );
}

// ── Pressables ────────────────────────────────────────────────────────────────

export type TapProps = Omit<PressableProps, "style" | "children"> & {
  /** navigate to a site path (/shop?mode=rent, /product/<slug>, …) */
  href?: string;
  replace?: boolean;
  style?: StyleProp<ViewStyle>;
  /** extra style while pressed (default: slightly transparent) */
  pressedStyle?: StyleProp<ViewStyle>;
  label?: string;
  children?: React.ReactNode;
};

/** A pressable area: runs `onPress` and/or navigates to `href`. */
export function Tap({ href, replace, onPress, style, pressedStyle, label, children, disabled, hitSlop = 6, ...rest }: TapProps) {
  return (
    <Pressable
      accessibilityRole={href ? "link" : "button"}
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={hitSlop}
      {...rest}
      onPress={(e) => {
        if (onPress) onPress(e);
        if (href) navigate(href, { replace });
      }}
      style={({ pressed }) => [style, pressed && !disabled && (pressedStyle ?? { opacity: 0.75 })]}
    >
      {children}
    </Pressable>
  );
}

type BtnVariant = "green" | "navy" | "ink" | "white" | "outline" | "outlineGreen" | "outlineWhite" | "soft";
const BTN: Record<BtnVariant, { bg: string; fg: string; border?: string }> = {
  green: { bg: C.green, fg: C.white },
  navy: { bg: C.navy, fg: C.white },
  ink: { bg: C.ink, fg: C.white },
  white: { bg: C.white, fg: C.navy },
  outline: { bg: C.white, fg: C.navy, border: C.navy },
  outlineGreen: { bg: C.white, fg: C.green, border: C.green },
  outlineWhite: { bg: "transparent", fg: C.white, border: "rgba(255,255,255,0.5)" },
  soft: { bg: C.sand, fg: C.ink },
};

export type BtnProps = Omit<TapProps, "children"> & {
  title: string;
  variant?: BtnVariant;
  /** height (default 52) */
  h?: number;
  /** corner radius (default 14) */
  r?: number;
  /** font size (default 15) */
  s?: number;
  w?: Weight;
  /** horizontal padding (default 24) */
  px?: number;
  /** icon markup shown after the label */
  icon?: string;
  /** icon markup shown before the label */
  iconLeft?: string;
  iconSize?: number;
  busy?: boolean;
  /** stretch to the container's width */
  full?: boolean;
  textStyle?: StyleProp<TextStyle>;
};

/** The site's buttons: green (primary), navy, outline … */
export function Btn({ title, variant = "green", h = 52, r = 14, s = 15, w = 700, px = 24, icon, iconLeft, iconSize = 17, busy, full, disabled, style, textStyle, ...rest }: BtnProps) {
  const v = BTN[variant];
  return (
    <Tap
      {...rest}
      disabled={disabled || busy}
      style={[
        {
          height: h,
          paddingHorizontal: px,
          borderRadius: r,
          backgroundColor: v.bg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          alignSelf: full ? "stretch" : "flex-start",
        },
        v.border ? { borderWidth: 1, borderColor: v.border } : null,
        (disabled || busy) && { opacity: 0.6 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={v.fg} /> : iconLeft ? <Icon xml={iconLeft} size={iconSize} color={v.fg} /> : null}
      <T s={s} w={w} c={v.fg} numberOfLines={1} style={textStyle}>
        {title}
      </T>
      {icon && !busy ? <Icon xml={icon} size={iconSize} color={v.fg} /> : null}
    </Tap>
  );
}

// ── Form fields ───────────────────────────────────────────────────────────────

export type FieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  /** height (default 52) */
  h?: number;
  r?: number;
  /** element shown inside the box before / after the input (icon, Show button) */
  left?: React.ReactNode;
  right?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  boxStyle?: StyleProp<ViewStyle>;
  inputRef?: React.Ref<TextInput>;
};

/** A labelled text input in the site's style: 1.5px border, blue focus ring, red when invalid. */
export function Field({ label, error, hint, h = 52, r = 12, left, right, containerStyle, boxStyle, style, inputRef, onFocus, onBlur, multiline, ...rest }: FieldProps) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 8 }, containerStyle]}>
      {label ? (
        <T s={14} w={600}>
          {label}
        </T>
      ) : null}
      <View
        style={[
          {
            minHeight: h,
            borderWidth: 1.5,
            borderColor: error ? C.red : focus ? C.navy : C.lineStrong,
            borderRadius: r,
            backgroundColor: C.white,
            flexDirection: "row",
            alignItems: multiline ? "flex-start" : "center",
            paddingHorizontal: 14,
            gap: 10,
          },
          focus && !error && { boxShadow: "0 0 0 3px rgba(13,79,139,0.14)" },
          boxStyle,
        ]}
      >
        {left}
        <TextInput
          ref={inputRef}
          placeholderTextColor={C.faint}
          multiline={multiline}
          {...rest}
          onFocus={(e) => {
            setFocus(true);
            if (onFocus) onFocus(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            if (onBlur) onBlur(e);
          }}
          style={[
            { flex: 1, minWidth: 0, alignSelf: "stretch", fontFamily: F.g400, fontSize: 15, color: C.ink, paddingVertical: multiline ? 12 : 0 },
            multiline && { minHeight: h, textAlignVertical: "top" },
            // react-native-web draws its own focus outline; the box shows focus instead
            { outlineWidth: 0 } as TextStyle,
            style,
          ]}
        />
        {right}
      </View>
      {error ? (
        <T s={13} w={500} c={C.red}>
          {error}
        </T>
      ) : hint ? (
        <T s={13} c={C.muted}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export type PhoneFieldProps = Omit<FieldProps, "value" | "onChangeText" | "left"> & {
  /** any form ("0911234567", "+251911234567", ""); */
  value: string;
  /** receives the local form "0911234567" (or "") */
  onChangeText: (local: string) => void;
};

/** Ethiopian mobile number: a fixed +251 chip and the 9 digits that start with 7 or 9. */
export function PhoneField({ value, onChangeText, h = 52, r = 12, placeholder = "9XX XXX XXX", boxStyle, ...rest }: PhoneFieldProps) {
  return (
    <Field
      {...rest}
      h={h}
      r={r}
      keyboardType="number-pad"
      autoComplete="tel-national"
      placeholder={placeholder}
      value={groupDigits(value)}
      onChangeText={(text) => onChangeText(toLocal(text))}
      boxStyle={[{ paddingLeft: 6 }, boxStyle]}
      left={
        <View style={{ height: Math.min(h - 12, 36), paddingHorizontal: 10, borderRadius: Math.max(r - 3, 8), backgroundColor: C.sand, alignItems: "center", justifyContent: "center" }}>
          <T s={13} w={700} c={C.text}>
            +251
          </T>
        </View>
      }
    />
  );
}

/** Inline error / success line under a control (API messages are shown inline, never in an alert). */
export function Note({ children, tone = "error", style }: { children?: React.ReactNode; tone?: "error" | "ok" | "muted"; style?: StyleProp<TextStyle> }) {
  if (!children) return null;
  return (
    <T s={13} w={500} c={tone === "error" ? C.red : tone === "ok" ? C.green : C.muted} style={style} accessibilityLiveRegion="polite">
      {children}
    </T>
  );
}

// ── Loading / error states ────────────────────────────────────────────────────

export function Loading({ style, label }: { style?: StyleProp<ViewStyle>; label?: string }) {
  return (
    <View style={[{ paddingVertical: 80, alignItems: "center", justifyContent: "center", gap: 12 }, style]}>
      <ActivityIndicator size="large" color={C.navy} />
      {label ? (
        <T s={14} c={C.muted}>
          {label}
        </T>
      ) : null}
    </View>
  );
}

export function LoadError({ message, onRetry, style }: { message?: string | null; onRetry?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ margin: 16, padding: 24, borderRadius: 24, backgroundColor: C.paper, gap: 14, alignItems: "flex-start" }, style]}>
      <Eyebrow c={C.red}>Something went wrong</Eyebrow>
      <H s={24}>We couldn’t load this.</H>
      <T s={15} c={C.text} lh={22}>
        {message || "Check your connection and try again."}
      </T>
      {onRetry ? <Btn title="Try again" variant="navy" h={46} onPress={onRetry} iconLeft={ICON.refresh} /> : null}
    </View>
  );
}

/** Runs an async loader when the deps change. `reload()` runs it again (pull to refresh, retry). */
export function useLoad<T>(load: () => Promise<T>, deps: React.DependencyList) {
  const [state, setState] = useState<{ data: T | undefined; error: string | null; loading: boolean }>({ data: undefined, error: null, loading: true });
  const [tick, setTick] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const key = useMemo(() => ({}), [...deps, tick]);
  React.useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    load().then(
      (data) => live && setState({ data, error: null, loading: false }),
      (e) => live && setState((s) => ({ data: s.data, error: (e && e.message) || "Something went wrong. Please try again.", loading: false })),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return {
    ...state,
    reload: () => setTick((n) => n + 1),
    setData: (data: T) => setState({ data, error: null, loading: false }),
  };
}
