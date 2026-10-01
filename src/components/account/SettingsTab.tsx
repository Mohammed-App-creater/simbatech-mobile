/*
 * Account › Settings: profile (name, phone, email), notification preferences (saved on each
 * toggle) and changing — or, for Google / phone-code accounts, setting — the password.
 */
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { C } from "@/theme";
import { auth, notifications } from "@/lib/store";
import { isCompletePhone } from "@/lib/phone";
import { H, T, Tap } from "@/components/ui";
import { AField, APhone, errText, FormError, PHONE_HINT, TabTitle, type Account } from "./shared";

const NOTIF = [
  { id: "sms", label: "SMS updates", sub: "Delivery and pickup times" },
  { id: "email", label: "Email receipts", sub: "Orders, rentals and refunds" },
  { id: "remind", label: "Return reminders", sub: "A day before each rental ends" },
  { id: "deals", label: "Deals and offers", sub: "Members-only prices" },
];
const EMPTY_PW = { current: "", password: "", confirm: "" };
type FieldErr = { field: string; message: string } | null;

const PANEL = { borderWidth: 1, borderColor: C.line, borderRadius: 28, padding: 28 } as const;

export function SettingsTab({ a }: { a: Account }) {
  return (
    <>
      <TabTitle eyebrow="Your details" title="Settings" />
      <View style={{ gap: 20 }}>
        <ProfileForm a={a} />
        <Notifications a={a} />
        <PasswordForm a={a} />
      </View>
    </>
  );
}

function PanelTitle({ children, mb }: { children: string; mb: number }) {
  return (
    <H s={22} lh={26} ls={-0.66} style={{ marginBottom: mb }}>
      {children}
    </H>
  );
}

function SaveBtn({ title, done, busy, onPress }: { title: string; done: boolean; busy: boolean; onPress: () => void }) {
  return (
    <Tap onPress={onPress} disabled={busy} hitSlop={2} style={{ alignSelf: "flex-start", height: 48, paddingHorizontal: 22, borderRadius: 14, backgroundColor: done ? "#276833" : C.green, justifyContent: "center" }} pressedStyle={{ backgroundColor: "#276833" }}>
      <T s={14} w={700} c={C.white}>
        {title}
      </T>
    </Tap>
  );
}

/** Clears a "Saved" state after a moment; cancelled when the form unmounts. */
function useFlash(ms: number) {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return {
    on,
    off: () => setOn(false),
    show: () => {
      setOn(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setOn(false), ms);
    },
  };
}

function ProfileForm({ a }: { a: Account }) {
  const [p, setP] = useState({ name: a.user.name || "", phone: a.user.phone || "", email: a.user.email || "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FieldErr>(null);
  const saved = useFlash(2000);
  const change = (patch: Partial<typeof p>) => {
    setP((v) => ({ ...v, ...patch }));
    setError(null);
    saved.off();
  };
  const save = () => {
    if (busy) return;
    if (!p.name.trim()) return setError({ field: "name", message: "Enter your name." });
    if (p.phone.trim() && !isCompletePhone(p.phone)) return setError({ field: "phone", message: PHONE_HINT });
    setBusy(true);
    setError(null);
    saved.off();
    auth.updateProfile({ name: p.name.trim(), email: p.email.trim(), phone: p.phone.trim() }).then(
      (user) => {
        setBusy(false);
        setP({ name: user.name || "", phone: user.phone || "", email: user.email || "" });
        saved.show();
      },
      (err) => {
        setBusy(false);
        setError({ field: (err && err.field) || "", message: errText(err) });
      },
    );
  };
  const errorFor = (k: string) => (error && error.field === k ? error.message : null);

  return (
    <View style={[PANEL, { gap: 16 }]}>
      <PanelTitle mb={4}>Profile</PanelTitle>
      <AField label="Full name" placeholder="Full name" value={p.name} onChangeText={(v) => change({ name: v })} autoComplete="name" error={errorFor("name")} />
      <APhone label="Phone" value={p.phone} onChangeText={(v) => change({ phone: v })} error={errorFor("phone")} />
      <AField label="Email" placeholder="you@example.com" value={p.email} onChangeText={(v) => change({ email: v })} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" error={errorFor("email")} />
      <SaveBtn title={busy ? "Saving…" : saved.on ? "Saved" : "Save changes"} done={saved.on} busy={busy} onPress={save} />
      <FormError>{error && !["name", "phone", "email"].includes(error.field) ? error.message : ""}</FormError>
    </View>
  );
}

function Notifications({ a }: { a: Account }) {
  const [error, setError] = useState("");

  const toggle = (id: string) => {
    const before = !!a.notif[id];
    a.setNotif((cur) => ({ ...cur, [id]: !before })); // optimistic
    setError("");
    notifications.update({ [id]: !before }).then(
      (res) => a.setNotif((cur) => ({ ...cur, ...(res || {}) })),
      (err) => {
        a.setNotif((cur) => ({ ...cur, [id]: before }));
        setError(errText(err));
      },
    );
  };

  return (
    <View style={[PANEL, { gap: 8 }]}>
      <PanelTitle mb={8}>Notifications</PanelTitle>
      {NOTIF.map((n) => {
        const on = !!a.notif[n.id];
        return (
          <View key={n.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T s={15} w={600}>
                {n.label}
              </T>
              <T s={13} c={C.muted}>
                {n.sub}
              </T>
            </View>
            <Tap onPress={() => toggle(n.id)} accessibilityRole="switch" accessibilityState={{ checked: on }} label={n.label} hitSlop={4} pressedStyle={{ opacity: 0.85 }} style={{ width: 52, height: 44, justifyContent: "center" }}>
              <View style={{ width: 52, height: 30, borderRadius: 999, backgroundColor: on ? C.green : "#C9C6BE" }}>
                <View style={{ position: "absolute", top: 3, left: on ? 25 : 3, width: 24, height: 24, borderRadius: 999, backgroundColor: C.white, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </View>
            </Tap>
          </View>
        );
      })}
      <FormError>{error}</FormError>
    </View>
  );
}

function PasswordForm({ a }: { a: Account }) {
  const hasPassword = !!a.user.hasPassword;
  const [f, setF] = useState(EMPTY_PW);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FieldErr>(null);
  const saved = useFlash(2500);
  const change = (patch: Partial<typeof f>) => {
    setF((v) => ({ ...v, ...patch }));
    setError(null);
    saved.off();
  };
  const save = () => {
    if (busy) return;
    if (hasPassword && !f.current) return setError({ field: "current", message: "Enter your current password." });
    if (f.password.length < 8) return setError({ field: "password", message: "Use at least 8 characters." });
    if (f.password !== f.confirm) return setError({ field: "confirm", message: "The passwords don't match." });
    setBusy(true);
    setError(null);
    saved.off();
    auth.changePassword(hasPassword ? f.current : "", f.password).then(
      () => {
        setBusy(false);
        setF(EMPTY_PW);
        saved.show();
      },
      (err) => {
        let field = (err && err.field) || "";
        if (field === "new" || field === "newPassword") field = "password";
        setBusy(false);
        setError({ field, message: errText(err) });
      },
    );
  };
  const errorFor = (k: string) => (error && error.field === k ? error.message : null);

  return (
    <View style={[PANEL, { gap: 16 }]}>
      <PanelTitle mb={4}>{hasPassword ? "Change password" : "Set a password"}</PanelTitle>
      <T s={13} c={C.muted}>
        {hasPassword ? "Use at least 8 characters." : (a.user.google ? "You sign in with Google" : "You sign in with a code sent to your phone") + ". Add a password to sign in with your email or phone too."}
      </T>
      {hasPassword ? <AField label="Current password" value={f.current} onChangeText={(v) => change({ current: v })} secureTextEntry autoCapitalize="none" autoComplete="current-password" error={errorFor("current")} /> : null}
      <AField label="New password" value={f.password} onChangeText={(v) => change({ password: v })} secureTextEntry autoCapitalize="none" autoComplete="new-password" error={errorFor("password")} />
      <AField label="Confirm new password" value={f.confirm} onChangeText={(v) => change({ confirm: v })} secureTextEntry autoCapitalize="none" autoComplete="new-password" error={errorFor("confirm")} />
      <SaveBtn title={busy ? "Saving…" : saved.on ? (hasPassword ? "Password updated" : "Password set") : hasPassword ? "Update password" : "Set password"} done={saved.on} busy={busy} onPress={save} />
      <FormError>{error && !["current", "password", "confirm"].includes(error.field) ? error.message : ""}</FormError>
    </View>
  );
}
