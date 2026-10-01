/*
 * Pieces shared by the Sign in and Reset password pages: the labelled fields, the Show / Hide
 * button, the password strength meter, the submit button and the small centred messages.
 */
import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { C } from "@/theme";
import { Btn, Field, Icon, ICON, PhoneField, T, Tap, type FieldProps, type PhoneFieldProps } from "@/components/ui";

export const AUTH_BG = "#F6F5F1";
export const ERROR_FG = "#B02418";
export const CARD_SHADOW = "0 30px 60px -40px rgba(10,20,35,0.35)";

// ── Password strength ─────────────────────────────────────────────────────────

const LEVELS = [
  { label: "Too short", fg: "#B02418", bar: "#C42A1C" },
  { label: "Weak", fg: "#B02418", bar: "#C42A1C" },
  { label: "Fair", fg: "#9A4A06", bar: "#F08A24" },
  { label: "Good", fg: "#7A5700", bar: "#F0AE00" },
  { label: "Strong", fg: "#2F7A3C", bar: "#418D4D" },
];

/** -1 empty, 0 too short, 1..4 = length ≥ 8 + length ≥ 12 + has a digit + has a symbol. */
export function score(pw: string) {
  if (!pw) return -1;
  if (pw.length < 8) return 0;
  let s = 1;
  if (pw.length >= 12) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

/** The four strength bars, the name of the level and the three rules under a new-password field. */
export function StrengthMeter({ pw }: { pw: string }) {
  const sc = score(pw);
  const lvl = sc < 0 ? { label: "", fg: C.muted, bar: C.lineStrong } : LEVELS[sc];
  const filled = sc < 0 ? 0 : Math.max(1, sc);
  const rules = [
    { label: "8+ characters", ok: pw.length >= 8 },
    { label: "A number", ok: /\d/.test(pw) },
    { label: "A symbol", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
  return (
    <View style={{ gap: 8, paddingTop: 4 }} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          {[0, 2].map((row) => (
            <View key={row} style={{ flexDirection: "row", gap: 4 }}>
              {[row, row + 1].map((i) => (
                <View key={i} style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: i < filled ? lvl.bar : C.lineStrong }} />
              ))}
            </View>
          ))}
        </View>
        <T s={13} w={700} c={lvl.fg} style={{ width: 84, textAlign: "right" }}>
          {lvl.label}
        </T>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6 }}>
        {rules.map((r) => (
          <View key={r.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }} accessibilityLabel={r.label + (r.ok ? " (met)" : " (not met)")}>
            <View style={{ width: 16, height: 16, borderRadius: 999, backgroundColor: r.ok ? "#418D4D" : "#C9C6BE", alignItems: "center", justifyContent: "center" }}>
              <Icon xml={ICON.check} size={10} color={C.white} sw={3.2} />
            </View>
            <T s={12} w={600} c={r.ok ? C.green : C.muted}>
              {r.label}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Fields ────────────────────────────────────────────────────────────────────

const Label = ({ children }: { children: string }) => (
  <T s={13} w={600}>
    {children}
  </T>
);

export type AuthFieldProps = Omit<FieldProps, "label" | "left"> & {
  label: string;
  /** icon markup shown before the input */
  icon?: string;
  /** small grey line under the box (the "Development mode" code of a test API) */
  below?: string;
};

/** The text box of the auth pages: 13px label, 1px border, 14px corners, optional leading icon. */
export function AuthField({ label, icon, below, h = 50, right, boxStyle, ...rest }: AuthFieldProps) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <Field
        accessibilityLabel={label}
        h={h}
        r={14}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor="#757575"
        {...rest}
        left={icon ? <Icon xml={icon} size={18} color={C.muted} sw={1.7} /> : undefined}
        right={right}
        boxStyle={[{ borderWidth: 1, paddingLeft: 16, paddingRight: right ? 4 : 16 }, boxStyle]}
      />
      {below ? (
        <T s={12} c={C.muted}>
          {below}
        </T>
      ) : null}
    </View>
  );
}

/** Phone box with the fixed +251 chip, sized like the other auth fields. */
export function AuthPhoneField({ label, h = 50, boxStyle, ...rest }: Omit<PhoneFieldProps, "label"> & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <PhoneField accessibilityLabel={label} h={h} r={14} placeholderTextColor="#757575" {...rest} boxStyle={[{ borderWidth: 1, paddingRight: 6, gap: 8 }, boxStyle]} />
    </View>
  );
}

const EYE_OFF = '<path d="M3 3l18 18"/><path d="M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6M6.3 7.6C3.9 9.3 2.5 12 2.5 12S6 18 12 18a9 9 0 0 0 4-1"/>';

/** Show / Hide button inside a password box. */
export function PwToggle({ shown, onPress, h = 42, withIcon }: { shown: boolean; onPress: () => void; h?: number; withIcon?: boolean }) {
  return (
    <Tap
      onPress={onPress}
      label={shown ? "Hide password" : "Show password"}
      hitSlop={4}
      style={{ height: h, paddingHorizontal: 12, borderRadius: 10, backgroundColor: C.sand, flexDirection: "row", alignItems: "center", gap: 6 }}
    >
      {withIcon ? <Icon xml={shown ? EYE_OFF : ICON.eye} size={16} color={C.navy} sw={1.8} /> : null}
      <T s={13} w={700} c={C.navy}>
        {shown ? "Hide" : "Show"}
      </T>
    </Tap>
  );
}

// ── Buttons, links and messages ───────────────────────────────────────────────

/** The green call to action with the arrow; shows a spinner next to the busy label while working. */
export function SubmitBtn({ title, onPress, busy, disabled }: { title: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  return <Btn title={title} onPress={onPress} busy={busy} disabled={disabled} h={54} r={14} s={16} icon={ICON.arrowRight} full />;
}

/** Underlined navy text button ("Create an account", "Back to sign in"). */
export function LinkBtn({ title, onPress, href }: { title: string; onPress?: () => void; href?: string }) {
  return (
    <Tap onPress={onPress} href={href} hitSlop={0} style={{ height: 44, paddingHorizontal: 4, justifyContent: "center" }}>
      <T s={14} w={700} c={C.navy} style={{ textDecorationLine: "underline" }}>
        {title}
      </T>
    </Tap>
  );
}

/** Small centred line under a button: red for errors, grey for notes. */
export function FormLine({ children, tone = "error", style }: { children?: React.ReactNode; tone?: "error" | "note"; style?: StyleProp<ViewStyle> }) {
  if (!children) return null;
  return (
    <View style={[{ marginTop: -10 }, style]}>
      <T s={12} lh={17} c={tone === "error" ? ERROR_FG : C.muted} center accessibilityRole={tone === "error" ? "alert" : undefined} accessibilityLiveRegion="polite">
        {children}
      </T>
    </View>
  );
}

/** "Resend code" link, or the countdown until it is allowed again. */
export function Resend({ seconds, onPress, waitText, s = 14 }: { seconds: number; onPress: () => void; waitText?: string; s?: number }) {
  if (seconds > 0)
    return (
      <View style={{ height: 44, justifyContent: "center" }} accessibilityLiveRegion="polite">
        <T s={s} w={600} c={C.muted}>
          {waitText ?? "Resend in " + seconds + "s"}
        </T>
      </View>
    );
  return (
    <Tap onPress={onPress} style={{ height: 44, justifyContent: "center" }}>
      <T s={s} w={600} c={C.navy}>
        Resend code
      </T>
    </Tap>
  );
}

/** Counts `seconds` down to zero, one step a second. */
export function useCountdown(seconds: number, setSeconds: (next: number) => void) {
  React.useEffect(() => {
    if (seconds <= 0) return undefined;
    const t = setTimeout(() => setSeconds(Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);
}

/** A reset link from the API opens inside the app when it points at /reset-password. */
export function inAppPath(link: string): string | null {
  const m = /^(?:[a-z][a-z0-9+.-]*:)?\/\/[^/]+(\/reset-password(?:\?[^#]*)?)/i.exec(link);
  return m ? m[1] : link.startsWith("/reset-password") ? link : null;
}
