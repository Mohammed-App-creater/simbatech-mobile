/*
 * Sign in / Create account (the website's /signin in its phone layout): password sign-in, phone
 * sign-in with a one-time code, forgot password (email link or SMS code) and sign-up.
 * `?next=` is where to go afterwards, `?tab=signup` opens Create account, `?error=google` shows
 * the message of a failed Google sign-in.
 */
import React, { useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { C, GUTTER } from "@/theme";
import { auth, authConfig, navigate, useShop } from "@/lib/store";
import { isCompletePhone, toLocal } from "@/lib/phone";
import { Screen } from "@/components/Screen";
import { Logo } from "@/components/ProductArt";
import { Checkbox } from "@/components/controls";
import { H, Icon, ICON, Loading, Serif, T, Tap } from "@/components/ui";
import { AUTH_BG, AuthField, AuthPhoneField, CARD_SHADOW, FormLine, inAppPath, LinkBtn, PwToggle, Resend, score, StrengthMeter, SubmitBtn, useCountdown } from "@/components/auth/parts";

type Tab = "signin" | "create";
/** "password" (the normal form) | "otp" (phone sign-in) | "forgot" (password reset); sign-in tab only */
type Mode = "password" | "otp" | "forgot";
type FieldKey = "siId" | "siPw" | "caName" | "caPhone" | "caEmail" | "newPw" | "otpPhone" | "otpCode" | "otpName" | "fpId" | "fpCode" | "fpPw";

type State = {
  tab: Tab;
  mode: Mode;
  showPw: boolean;
  remember: boolean;
  terms: boolean;
  siId: string;
  siPw: string;
  caName: string;
  caPhone: string;
  caEmail: string;
  newPw: string;
  pending: boolean;
  error: string;
  /** the field the error belongs to ("" = shown under the button) */
  errorField: FieldKey | "";
  note: string;
  topError: string;
  // phone (OTP) sign-in
  otpStep: 1 | 2;
  otpPhone: string;
  otpSentTo: string;
  otpCode: string;
  otpName: string;
  otpNeedName: boolean;
  otpDevCode: string;
  // forgot password
  fpId: string;
  fpVia: "" | "email" | "sms";
  fpDevLink: string;
  fpDevCode: string;
  fpCode: string;
  fpPw: string;
  /** seconds until "Resend" is allowed again (shared by the OTP and SMS-reset steps) */
  resendIn: number;
};

const PHONE_HINT = "Enter the 9 digits after +251, starting with 9 or 7 (e.g. 911 234 567).";
const NO_SMS = "Development mode: no SMS is sent — the code is in the server log.";
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
/** Only paths inside the app are followed after signing in. */
const safeNext = (next: string) => (next.startsWith("/") && !next.startsWith("//") ? next : "/account");

export default function SignInScreen() {
  const params = useLocalSearchParams<{ next?: string; tab?: string; error?: string }>();
  const shop = useShop();
  const cfg = authConfig(shop);
  const next = safeNext(one(params.next));

  const [s, setS] = useState<State>(() => ({
    tab: one(params.tab) === "signup" ? "create" : "signin",
    mode: "password",
    showPw: false,
    remember: true,
    terms: false,
    siId: "",
    siPw: "",
    caName: "",
    caPhone: "",
    caEmail: "",
    newPw: "",
    pending: false,
    error: "",
    errorField: "",
    note: "",
    topError: one(params.error) === "google" ? "Google sign-in didn't complete. Try again or use your phone or email." : "",
    otpStep: 1,
    otpPhone: "",
    otpSentTo: "",
    otpCode: "",
    otpName: "",
    otpNeedName: false,
    otpDevCode: "",
    fpId: "",
    fpVia: "",
    fpDevLink: "",
    fpDevCode: "",
    fpCode: "",
    fpPw: "",
    resendIn: 0,
  }));
  const set = (patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch }));
  useCountdown(s.resendIn, (n) => set({ resendIn: n }));

  // Signed in (already, or a moment ago through one of the forms below): continue to `next`.
  const left = useRef(false);
  useEffect(() => {
    if (shop.user && !left.current) {
      left.current = true;
      navigate(next, { replace: true });
    }
  }, [shop.user, next]);

  const field = (name: FieldKey) => (value: string) => set({ [name]: value, error: "", errorField: "" } as Partial<State>);
  const invalid = (error: string, errorField: FieldKey | "" = "") => set({ error, errorField, note: "" });
  const errFor = (name: FieldKey) => (s.errorField === name ? s.error : null);
  const formError = s.errorField ? "" : s.error;
  /** Shows an API error, under the field it names when that field is on screen. */
  const fail = (err: any, fields: Record<string, FieldKey | ""> = {}) =>
    set({ pending: false, error: (err && err.message) || "Something went wrong. Please try again.", errorField: (err && err.field && fields[err.field]) || "" });

  function setMode(mode: Mode) {
    set({
      mode,
      error: "",
      errorField: "",
      note: "",
      topError: "",
      pending: false,
      otpStep: 1,
      otpCode: "",
      otpName: "",
      otpNeedName: false,
      otpDevCode: "",
      fpVia: "",
      fpDevLink: "",
      fpDevCode: "",
      fpCode: "",
      fpPw: "",
      resendIn: 0,
      // prefill the reset form / phone box from whatever was typed into the sign-in field
      fpId: mode === "forgot" ? s.siId || s.fpId : s.fpId,
      otpPhone: mode === "otp" && !s.otpPhone && /^[+\d\s]+$/.test(s.siId) ? toLocal(s.siId) : s.otpPhone,
    });
  }
  function pickTab(tab: Tab) {
    if (s.mode !== "password") setMode("password");
    set({ tab, error: "", errorField: "", note: "", topError: "" });
  }

  // ── Password sign-in ──
  function submitSignIn() {
    if (s.pending) return;
    if (!s.siId.trim() || !s.siPw) return invalid("Enter your phone or email and your password.", !s.siId.trim() ? "siId" : "siPw");
    set({ pending: true, error: "", errorField: "", note: "", topError: "" });
    auth.signIn(s.siId.trim(), s.siPw, s.remember).catch((err) => fail(err));
  }

  // ── Create account ──
  function submitCreate() {
    if (s.pending || score(s.newPw) < 2 || !s.terms) return;
    const identifier = s.caPhone.trim() || s.caEmail.trim();
    if (!s.caName.trim()) return invalid("Enter your full name.", "caName");
    if (!identifier) return invalid("Enter your phone or email.");
    if (s.caPhone.trim() && !isCompletePhone(s.caPhone)) return invalid(PHONE_HINT, "caPhone");
    set({ pending: true, error: "", errorField: "", note: "", topError: "" });
    const idField = s.caPhone.trim() ? "caPhone" : "caEmail";
    auth.signUp(s.caName.trim(), identifier, s.newPw).catch((err) => fail(err, { name: "caName", identifier: idField, phone: "caPhone", email: "caEmail", password: "newPw" }));
  }

  // ── Phone (OTP) sign-in ──
  function submitOtpSend() {
    if (s.pending) return;
    const resend = s.otpStep === 2;
    const phone = (resend ? s.otpSentTo : s.otpPhone).trim();
    if (!phone) return invalid("Enter your phone number.", "otpPhone");
    if (!isCompletePhone(phone)) return invalid(PHONE_HINT, "otpPhone");
    set({ pending: true, error: "", errorField: "", note: "", topError: "" });
    auth.otpSend(phone).then(
      (res) =>
        set({
          pending: false,
          otpStep: 2,
          otpSentTo: res.phone || phone,
          otpNeedName: !!res.newAccount,
          otpDevCode: res.devCode ? String(res.devCode) : "",
          otpCode: resend ? s.otpCode : "",
          note: resend ? "We sent you a new code." : "",
          resendIn: Math.max(0, Math.round(Number(res.resendInSeconds) || 0)),
        }),
      (err) => fail(err, { phone: resend ? "" : "otpPhone" }),
    );
  }
  function submitOtpVerify() {
    if (s.pending) return;
    const code = s.otpCode.replace(/\D/g, "");
    if (code.length !== 6) return invalid("Enter the 6-digit code we sent you.", "otpCode");
    if (s.otpNeedName && s.otpName.trim().length < 2) return invalid("Enter your name to create your account.", "otpName");
    set({ pending: true, error: "", errorField: "", note: "" });
    auth.otpVerify(s.otpSentTo, code, s.otpNeedName ? s.otpName.trim() : undefined, s.remember).catch((err) => {
      // the number has no account yet: ask for a name and create one
      if (err && err.status === 422 && err.field === "name") set({ pending: false, otpNeedName: true, error: err.message || "Enter your name to create your account.", errorField: "otpName" });
      else fail(err, { code: "otpCode" });
    });
  }
  const changeNumber = () => set({ otpStep: 1, otpCode: "", otpDevCode: "", otpNeedName: false, error: "", errorField: "", note: "", resendIn: 0 });

  // ── Forgot password ──
  function submitForgot() {
    if (s.pending) return;
    const resend = s.fpVia === "sms";
    const id = s.fpId.trim();
    if (!id) return invalid("Enter your phone or email.", "fpId");
    set({ pending: true, error: "", errorField: "", note: "", topError: "" });
    auth.forgotPassword(id).then(
      (res) =>
        set({
          pending: false,
          fpVia: res.via === "sms" ? "sms" : "email",
          fpDevLink: res.devLink || "",
          fpDevCode: res.devCode ? String(res.devCode) : "",
          fpCode: resend ? s.fpCode : "",
          note: resend ? "We sent you a new code." : "",
          resendIn: res.via === "sms" ? Math.max(0, Math.round(Number(res.resendInSeconds) || 0)) : 0,
        }),
      (err) => fail(err, { identifier: resend ? "" : "fpId" }),
    );
  }
  function submitReset() {
    if (s.pending) return;
    const code = s.fpCode.replace(/\D/g, "");
    if (code.length !== 6) return invalid("Enter the 6-digit code we sent you.", "fpCode");
    if (score(s.fpPw) < 2) return invalid("Choose a password with at least 8 characters, including a number or a symbol.", "fpPw");
    set({ pending: true, error: "", errorField: "", note: "" });
    auth.resetPassword({ phone: s.fpId.trim(), code, password: s.fpPw }).catch((err) => fail(err, { code: "fpCode", password: "fpPw" }));
  }
  function openDevLink() {
    const path = inAppPath(s.fpDevLink);
    if (path) navigate(path);
    else Linking.openURL(s.fpDevLink).catch(() => {});
  }

  const togglePw = () => set({ showPw: !s.showPw });
  const toggleRemember = () => set({ remember: !s.remember });
  const canCreate = score(s.newPw) >= 2 && s.terms;

  let form: React.ReactNode;
  if (s.tab === "create") {
    form = (
      <>
        <Heading title="Create your account" sub="Shop, rent and track, in one place." />
        <View style={{ gap: 12 }}>
          <AuthField label="Full name" h={48} autoComplete="name" autoCapitalize="words" placeholder="First and last name" value={s.caName} onChangeText={field("caName")} onSubmitEditing={submitCreate} error={errFor("caName")} />
          <AuthPhoneField label="Phone" h={48} value={s.caPhone} onChangeText={field("caPhone")} onSubmitEditing={submitCreate} error={errFor("caPhone")} />
          <AuthField
            label="Email"
            h={48}
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
            value={s.caEmail}
            onChangeText={field("caEmail")}
            onSubmitEditing={submitCreate}
            error={errFor("caEmail")}
            boxStyle={{ paddingLeft: 14, paddingRight: 14 }}
          />
          <View style={{ gap: 6 }}>
            <AuthField
              label="Password"
              h={48}
              secureTextEntry={!s.showPw}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={s.newPw}
              onChangeText={field("newPw")}
              onSubmitEditing={submitCreate}
              error={errFor("newPw")}
              right={<PwToggle shown={s.showPw} onPress={togglePw} h={40} />}
            />
            <StrengthMeter pw={s.newPw} />
          </View>
          <Tap onPress={() => set({ terms: !s.terms })} accessibilityRole="checkbox" accessibilityState={{ checked: s.terms }} style={{ paddingTop: 12, flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <View style={{ marginTop: 1 }}>
              <Checkbox checked={s.terms} size={18} />
            </View>
            <T s={13} lh={19.5} c={C.text} style={{ flex: 1 }}>
              I agree to the Terms of use, Rental terms and Privacy policy.
            </T>
          </Tap>
        </View>
        {canCreate ? (
          <>
            <SubmitBtn title={s.pending ? "Creating account…" : "Create account"} onPress={submitCreate} busy={s.pending} />
            <FormLine>{formError}</FormLine>
          </>
        ) : (
          <>
            <View accessibilityRole="button" accessibilityState={{ disabled: true }} style={{ height: 54, borderRadius: 14, backgroundColor: "#A9CDB0", alignItems: "center", justifyContent: "center" }}>
              <T s={16} w={700} c="#0F3A17">
                Create account
              </T>
            </View>
            <FormLine tone="note">{score(s.newPw) < 2 ? "Choose a password rated Fair or better." : "Tick the box to accept the terms."}</FormLine>
          </>
        )}
      </>
    );
  } else if (s.mode === "otp") {
    const step2 = s.otpStep === 2;
    form = (
      <>
        <Heading big title="Sign in with your phone" sub={step2 ? "We sent a code to " + s.otpSentTo : "We'll text you a one-time code."} />
        <View style={{ gap: 14 }}>
          {step2 ? (
            <>
              <AuthField
                label="6-digit code"
                icon={ICON.lock}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={s.otpCode}
                onChangeText={field("otpCode")}
                onSubmitEditing={submitOtpVerify}
                error={errFor("otpCode")}
                below={s.otpDevCode ? "Development mode: your code is " + s.otpDevCode : cfg.otpDevMode ? NO_SMS : undefined}
              />
              {s.otpNeedName ? (
                <AuthField
                  label="Your name"
                  icon={ICON.user}
                  autoComplete="name"
                  autoCapitalize="words"
                  placeholder="First and last name"
                  value={s.otpName}
                  onChangeText={field("otpName")}
                  onSubmitEditing={submitOtpVerify}
                  error={errFor("otpName")}
                />
              ) : null}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <RememberMe checked={s.remember} onToggle={toggleRemember} />
                <Resend seconds={s.resendIn} onPress={submitOtpSend} />
              </View>
            </>
          ) : (
            <AuthPhoneField label="Phone" value={s.otpPhone} onChangeText={field("otpPhone")} onSubmitEditing={submitOtpSend} error={errFor("otpPhone")} />
          )}
        </View>
        {step2 ? (
          <SubmitBtn title={s.pending ? "Signing in…" : s.otpNeedName ? "Create account" : "Sign in"} onPress={submitOtpVerify} busy={s.pending} />
        ) : (
          <SubmitBtn title={s.pending ? "Sending code…" : "Send code"} onPress={submitOtpSend} busy={s.pending} />
        )}
        <FormLine>{formError}</FormLine>
        <FormLine tone="note">{s.note}</FormLine>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
          {step2 ? (
            <>
              <LinkBtn title="Change number" onPress={changeNumber} />
              <T s={14} c={C.muted}>
                {" · "}
              </T>
            </>
          ) : null}
          <LinkBtn title="Use password instead" onPress={() => setMode("password")} />
        </View>
      </>
    );
  } else if (s.mode === "forgot") {
    const start = !s.fpVia;
    const sms = s.fpVia === "sms";
    form = (
      <>
        <Heading
          big
          title="Reset your password"
          sub={start ? "Enter your phone or email and we'll help you choose a new one." : sms ? "We sent a code to " + s.fpId.trim() : "We've emailed you a link to choose a new password."}
        />
        {s.fpVia === "email" && s.fpDevLink ? (
          <T s={12} lh={18} c={C.muted} center>
            {"Development mode: no email is sent — "}
            <T s={12} lh={18} w={600} c={C.navy} onPress={openDevLink} accessibilityRole="link" style={{ textDecorationLine: "underline" }}>
              open the reset link
            </T>
          </T>
        ) : null}
        {start ? (
          <AuthField
            label="Phone or email"
            icon={ICON.user}
            keyboardType="email-address"
            autoComplete="username"
            placeholder="09XX XXX XXX or you@example.com"
            value={s.fpId}
            onChangeText={field("fpId")}
            onSubmitEditing={submitForgot}
            error={errFor("fpId")}
          />
        ) : null}
        {sms ? (
          <View style={{ gap: 14 }}>
            <AuthField
              label="6-digit code"
              icon={ICON.phone}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={s.fpCode}
              onChangeText={field("fpCode")}
              onSubmitEditing={submitReset}
              error={errFor("fpCode")}
              below={s.fpDevCode ? "Development mode: your code is " + s.fpDevCode : cfg.otpDevMode ? NO_SMS : undefined}
            />
            <AuthField
              label="New password"
              icon={ICON.lock}
              secureTextEntry={!s.showPw}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={s.fpPw}
              onChangeText={field("fpPw")}
              onSubmitEditing={submitReset}
              error={errFor("fpPw")}
              right={<PwToggle shown={s.showPw} onPress={togglePw} />}
            />
            <View style={{ alignItems: "flex-end" }}>
              <Resend seconds={s.resendIn} onPress={submitForgot} />
            </View>
          </View>
        ) : null}
        {start ? <SubmitBtn title={s.pending ? "Sending…" : "Continue"} onPress={submitForgot} busy={s.pending} /> : null}
        {sms ? <SubmitBtn title={s.pending ? "Saving…" : "Set new password"} onPress={submitReset} busy={s.pending} /> : null}
        <FormLine>{formError}</FormLine>
        <FormLine tone="note">{s.note}</FormLine>
        <View style={{ alignItems: "center" }}>
          <LinkBtn title="Back to sign in" onPress={() => setMode("password")} />
        </View>
      </>
    );
  } else {
    form = (
      <>
        <Heading title="Welcome back" sub="Sign in to track orders and manage rentals." />
        <FormLine>{s.topError}</FormLine>
        <View style={{ gap: 14 }}>
          <AuthField
            label="Phone or email"
            icon={ICON.user}
            keyboardType="email-address"
            autoComplete="username"
            placeholder="09XX XXX XXX or you@example.com"
            value={s.siId}
            onChangeText={field("siId")}
            onSubmitEditing={submitSignIn}
            error={errFor("siId")}
          />
          <AuthField
            label="Password"
            icon={ICON.lock}
            secureTextEntry={!s.showPw}
            autoComplete="current-password"
            placeholder="Your password"
            value={s.siPw}
            onChangeText={field("siPw")}
            onSubmitEditing={submitSignIn}
            error={errFor("siPw")}
            right={<PwToggle shown={s.showPw} onPress={togglePw} withIcon />}
          />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <RememberMe checked={s.remember} onToggle={toggleRemember} />
            {/* where the store resets passwords by hand, the reset page says how to reach support */}
            <Tap onPress={cfg.passwordReset ? () => setMode("forgot") : undefined} href={cfg.passwordReset ? undefined : "/reset-password"} style={{ height: 44, justifyContent: "center" }}>
              <T s={14} w={600} c={C.navy}>
                Forgot password?
              </T>
            </Tap>
          </View>
        </View>
        <SubmitBtn title={s.pending ? "Signing in…" : "Sign in"} onPress={submitSignIn} busy={s.pending} />
        <FormLine>{formError}</FormLine>
        {/* No "Continue with Google" in the app: the site's Google flow ends in the browser's cookie jar, not the app's, until the API offers an app hand-off. */}
        {cfg.otp ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: C.lineStrong }} />
              <T s={13} c={C.muted}>
                or
              </T>
              <View style={{ flex: 1, height: 1, backgroundColor: C.lineStrong }} />
            </View>
            <Tap onPress={() => setMode("otp")} style={{ height: 50, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 14, backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <Icon xml={ICON.phone} size={18} color={C.green} sw={1.8} />
              <T s={14} w={600}>
                Continue with phone (OTP)
              </T>
            </Tap>
          </>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
          <T s={14} c={C.muted}>
            {"New to Simbatech? "}
          </T>
          <LinkBtn title="Create an account" onPress={() => pickTab("create")} />
        </View>
      </>
    );
  }

  return (
    <Screen header={false} footer={false} bg={AUTH_BG} topColor={C.navy}>
      <BrandPanel />
      {!shop.ready || shop.user ? (
        <Loading />
      ) : (
        <View style={{ paddingTop: 24, paddingHorizontal: GUTTER, paddingBottom: 48 }}>
          <Tap href="/shop" style={{ alignSelf: "flex-end", height: 44, paddingHorizontal: 16, marginBottom: 12, borderRadius: 12, backgroundColor: C.white, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon xml={ICON.arrowLeft} size={16} color={C.navy} />
            <T s={14} w={600} c={C.navy}>
              Back to shop
            </T>
          </Tap>
          <View style={{ paddingVertical: 24, paddingHorizontal: 20, borderRadius: 28, backgroundColor: C.white, boxShadow: CARD_SHADOW, gap: 20 }}>
            <View accessibilityRole="tablist" accessibilityLabel="Account access" style={{ padding: 4, gap: 4, borderRadius: 14, backgroundColor: C.sand }}>
              <TabBtn label="Sign in" on={s.tab === "signin"} onPress={() => pickTab("signin")} />
              <TabBtn label="Create account" on={s.tab === "create"} onPress={() => pickTab("create")} />
            </View>
            {form}
            <T s={12} lh={18} c={C.muted} center>
              {"By continuing you agree to our "}
              <LegalLink href="/p/terms">Terms</LegalLink>
              {" and "}
              <LegalLink href="/p/privacy">Privacy policy</LegalLink>
              {". Need help? "}
              <LegalLink href="/p/contact">Contact support</LegalLink>
            </T>
          </View>
        </View>
      )}
    </Screen>
  );
}

/** The blue brand header (the site's left panel, compact on phones). */
function BrandPanel() {
  return (
    <View style={{ backgroundColor: C.navy, paddingTop: 22, paddingHorizontal: GUTTER, paddingBottom: 26, gap: 16, alignItems: "flex-start" }}>
      <Tap href="/" label="Simbatech home" hitSlop={0}>
        <Logo height={58} white />
      </Tap>
      <View style={{ height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: C.mint }} />
        <T s={12} w={600} c="#CFEBD3" ls={0.72} upper>
          Buy or rent, one account
        </T>
      </View>
      <H s={64} lh={61.44} ls={-4.8} c={C.white} accessibilityRole="header" style={{ alignSelf: "stretch" }}>
        {"Own it. Rent it.\n"}
        <Serif c={C.mint} ls={-1.28}>
          Get it today.
        </Serif>
      </H>
    </View>
  );
}

function TabBtn({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Tap onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }} hitSlop={0} style={[{ height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" }, on && { backgroundColor: C.white, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }]}>
      <T s={14} w={700} c={on ? C.navy : C.muted}>
        {label}
      </T>
    </Tap>
  );
}

function Heading({ title, sub, big }: { title: string; sub: string; big?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <H s={big ? 32 : 24} lh={big ? 32 : 24} ls={big ? -1.28 : -0.96} accessibilityRole="header">
        {title}
      </H>
      <T s={15} c={C.muted} accessibilityLiveRegion="polite">
        {sub}
      </T>
    </View>
  );
}

function RememberMe({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <Tap onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }} style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Checkbox checked={checked} size={18} />
      <T s={14} c={C.text}>
        Remember me
      </T>
    </Tap>
  );
}

function LegalLink({ href, children }: { href: string; children: string }) {
  return (
    <T s={12} lh={18} w={600} c={C.navy} onPress={() => navigate(href)} accessibilityRole="link" style={{ textDecorationLine: "underline" }}>
      {children}
    </T>
  );
}
