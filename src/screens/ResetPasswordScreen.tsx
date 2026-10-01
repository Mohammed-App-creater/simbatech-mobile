/*
 * Reset password (the website's /reset-password). With ?uid=&token= (the emailed link) it asks for
 * a new password. Without them it lets the customer ask for a reset: email accounts get a link,
 * phone accounts get an SMS code and choose the new password right here. Saving signs them in.
 */
import React, { useState } from "react";
import { Linking, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { C, F, GUTTER } from "@/theme";
import { auth, authConfig, navigate, useShop } from "@/lib/store";
import { Screen } from "@/components/Screen";
import { Btn, H, ICON, T, Tap } from "@/components/ui";
import { AUTH_BG, AuthField, CARD_SHADOW, FormLine, inAppPath, PwToggle, Resend, StrengthMeter, SubmitBtn, useCountdown } from "@/components/auth/parts";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

function passwordProblem(pw: string, confirm: string) {
  if (pw.length < 8) return "Choose a password of at least 8 characters.";
  if (pw !== confirm) return "The passwords don't match.";
  return "";
}

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ uid?: string; token?: string }>();
  const uid = one(params.uid);
  const token = one(params.token);
  const cfg = authConfig(useShop());
  const hasToken = !!(uid && token);

  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string }>({ text: "" });
  const [done, setDone] = useState(false);

  // asking for a reset
  const [identifier, setIdentifier] = useState("");
  const [via, setVia] = useState<"" | "email" | "sms">("");
  const [devLink, setDevLink] = useState("");
  const [devCode, setDevCode] = useState("");
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  useCountdown(resendIn, setResendIn);

  const clearError = () => setError({ text: "" });
  /** Shows an API error, under the field it names when that field is on screen. */
  const fail = (err: any, fields: string[] = []) =>
    setError({ text: (err && err.message) || "Something went wrong. Please try again.", field: err && fields.includes(err.field) ? err.field : undefined });
  const errFor = (field: string) => (error.field === field ? error.text : null);
  const formError = error.field ? "" : error.text;

  async function finish(payload: Record<string, string>, fields: string[]) {
    setBusy(true);
    clearError();
    try {
      await auth.resetPassword(payload);
      setDone(true);
      navigate("/account", { replace: true });
    } catch (err) {
      fail(err, fields);
      setBusy(false);
    }
  }

  function submitToken() {
    if (busy || done) return;
    const problem = passwordProblem(pw, confirm);
    if (problem) return setError({ text: problem });
    finish({ uid, token, password: pw }, ["password"]);
  }

  async function submitRequest() {
    if (busy) return;
    const id = identifier.trim();
    if (!id) return setError({ text: "Enter your phone number or email address.", field: via ? undefined : "identifier" });
    setBusy(true);
    clearError();
    try {
      const res = await auth.forgotPassword(id);
      setVia(res.via === "sms" ? "sms" : "email");
      setDevLink(res.devLink || "");
      setDevCode(res.devCode ? String(res.devCode) : "");
      setCode("");
      if (res.via === "sms") setResendIn(Math.round(Number(res.resendInSeconds) || 45));
    } catch (err) {
      fail(err, via ? [] : ["identifier"]);
    } finally {
      setBusy(false);
    }
  }

  function submitCode() {
    if (busy || done) return;
    if (code.trim().length < 4) return setError({ text: "Enter the code we sent you.", field: "code" });
    const problem = passwordProblem(pw, confirm);
    if (problem) return setError({ text: problem });
    finish({ phone: identifier.trim(), code: code.trim(), password: pw }, ["code", "password"]);
  }

  function startOver() {
    setVia("");
    clearError();
  }
  function openDevLink() {
    const path = inAppPath(devLink);
    if (path) navigate(path);
    else Linking.openURL(devLink).catch(() => {});
  }

  /* New password + confirmation with the strength meter of the sign-in page. */
  const pwFields = (onSubmit: () => void) => {
    const mismatch = !!confirm && confirm !== pw;
    return (
      <>
        <View style={{ gap: 6 }}>
          <AuthField
            label="New password"
            icon={ICON.lock}
            secureTextEntry={!shown}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={pw}
            onChangeText={(v) => {
              setPw(v);
              clearError();
            }}
            onSubmitEditing={onSubmit}
            error={errFor("password")}
            right={<PwToggle shown={shown} onPress={() => setShown((v) => !v)} />}
          />
          <StrengthMeter pw={pw} />
        </View>
        <AuthField
          label="Confirm new password"
          icon={ICON.lock}
          secureTextEntry={!shown}
          autoComplete="new-password"
          placeholder="Type it again"
          value={confirm}
          onChangeText={(v) => {
            setConfirm(v);
            clearError();
          }}
          onSubmitEditing={onSubmit}
          error={mismatch ? "The passwords don't match." : null}
        />
      </>
    );
  };
  const saveLabel = done ? "Password updated" : busy ? "Saving…" : "Save new password";

  let body: React.ReactNode;
  if (!cfg.passwordReset) {
    body = (
      <>
        <Heading title="Reset your password" sub="Password reset isn't available online yet." />
        <Notice>Please contact support and we&apos;ll reset it for you.</Notice>
        <Btn title="Contact support" href="/p/contact?topic=support" h={54} r={14} s={16} icon={ICON.arrowRight} full />
      </>
    );
  } else if (hasToken) {
    body = (
      <>
        <Heading title="Choose a new password" sub="Pick something you don't use anywhere else." />
        <View style={{ gap: 14 }}>{pwFields(submitToken)}</View>
        <SubmitBtn title={saveLabel} onPress={submitToken} busy={busy} disabled={done} />
        <FormLine>{formError}</FormLine>
        <T s={13} c={C.muted} center>
          {"Link expired? "}
          <T s={13} w={600} c={C.navy} onPress={() => navigate("/reset-password")} accessibilityRole="link">
            Ask for a new one
          </T>
        </T>
      </>
    );
  } else if (via === "email") {
    body = (
      <>
        <Heading title="Check your email" sub={"We've sent a reset link to " + identifier.trim() + ". It works for 3 days."} />
        <Notice>No email after a few minutes? Check your spam folder, or make sure you typed the address your account uses.</Notice>
        {devLink ? (
          <Notice dev>
            {"Development mode: no mail server is set up, so here's your link — "}
            <T s={13} lh={19.5} w={700} c="#7A5700" onPress={openDevLink} accessibilityRole="link" style={{ textDecorationLine: "underline" }}>
              {devLink}
            </T>
          </Notice>
        ) : null}
        <Tap onPress={startOver} style={{ height: 50, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, borderColor: C.lineStrong, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
          <T s={14} w={700} center numberOfLines={1}>
            Use a different phone or email
          </T>
        </Tap>
      </>
    );
  } else if (via === "sms") {
    body = (
      <>
        <Heading title="Enter your code" sub={"We've sent a 6-digit code by SMS to " + identifier.trim() + "."} />
        {devCode ? <Notice dev>{"Development mode: your code is " + devCode}</Notice> : null}
        <View style={{ gap: 14 }}>
          <AuthField
            label="Code"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/\D/g, "").slice(0, 6));
              clearError();
            }}
            onSubmitEditing={submitCode}
            error={errFor("code")}
            style={code ? { fontFamily: F.g700, letterSpacing: 3 } : undefined}
          />
          {pwFields(submitCode)}
        </View>
        <SubmitBtn title={saveLabel} onPress={submitCode} busy={busy} disabled={done} />
        <FormLine>{formError}</FormLine>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginVertical: -12 }}>
          <Resend seconds={resendIn} onPress={submitRequest} waitText={"Resend code in " + resendIn + "s"} s={13} />
          <Tap onPress={startOver} style={{ height: 44, justifyContent: "center" }}>
            <T s={13} w={600} c={C.navy}>
              Change number
            </T>
          </Tap>
        </View>
      </>
    );
  } else {
    body = (
      <>
        <Heading title="Reset your password" sub="Tell us the phone or email on your account. Email accounts get a link; phone accounts get an SMS code." />
        <AuthField
          label="Phone or email"
          icon={ICON.user}
          keyboardType="email-address"
          autoComplete="username"
          placeholder="09XX XXX XXX or you@example.com"
          value={identifier}
          onChangeText={(v) => {
            setIdentifier(v);
            clearError();
          }}
          onSubmitEditing={submitRequest}
          error={errFor("identifier")}
        />
        <SubmitBtn title={busy ? "Sending…" : "Send reset link or code"} onPress={submitRequest} busy={busy} />
        <FormLine>{formError}</FormLine>
        <T s={13} c={C.muted} center>
          {"Remembered it? "}
          <T s={13} w={600} c={C.navy} onPress={() => navigate("/signin")} accessibilityRole="link">
            Sign in
          </T>
        </T>
      </>
    );
  }

  return (
    <Screen>
      {/* the site's card is squeezed at phone width (clipped placeholders, wrapped rules), so the paddings here are tighter */}
      <View style={{ marginTop: 24, marginHorizontal: GUTTER, paddingVertical: 32, paddingHorizontal: 8, borderRadius: 32, backgroundColor: AUTH_BG }}>
        <View style={{ paddingVertical: 28, paddingHorizontal: 16, borderRadius: 28, backgroundColor: C.white, boxShadow: CARD_SHADOW, gap: 20 }}>{body}</View>
      </View>
    </Screen>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={{ gap: 6 }}>
      <H s={24} lh={24} ls={-0.96} accessibilityRole="header">
        {title}
      </H>
      <T s={15} c={C.muted}>
        {sub}
      </T>
    </View>
  );
}

/** Tinted information box: blue for advice, yellow for the hints of a test API. */
function Notice({ children, dev }: { children: React.ReactNode; dev?: boolean }) {
  return (
    <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: dev ? C.butter : C.sky }}>
      <T s={13} lh={19.5} c={dev ? "#7A5700" : C.navy}>
        {children}
      </T>
    </View>
  );
}
