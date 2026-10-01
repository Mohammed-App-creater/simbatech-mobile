/*
 * Account › Payment methods: saved Telebirr numbers and card reminders (brand, last four digits
 * and expiry only) with add, remove and "set as default", plus the note about what is stored.
 */
import React, { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { C, GUTTER } from "@/theme";
import { paymentMethods } from "@/lib/store";
import { isCompletePhone } from "@/lib/phone";
import type { PaymentMethodDTO } from "@/lib/types";
import { H, Icon, ICON, T, Tap } from "@/components/ui";
import { hasPayLogo, PayLogo } from "@/components/ProductArt";
import { AddTile, AField, APhone, EmptyBox, errText, FormActions, FormError, PHONE_HINT, Segment, TabTitle, type Account } from "./shared";

const EMPTY = { kind: "telebirr" as "telebirr" | "card", phone: "", brand: "Visa" as "Visa" | "Mastercard", last4: "", expiry: "", holder: "" };
type Form = typeof EMPTY;
const CARD_NOTE = "We only keep the card's brand, last four digits and expiry so you can pick it at checkout — the full number is never stored.";
const FIELDS = ["phone", "last4", "expiry", "holder", "brand"];
const GAP = 20;

/** "1226" → "12/26" while typing. */
const expiryText = (text: string) => {
  const d = text.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
};

export function PaymentTab({ a }: { a: Account }) {
  const { width } = useWindowDimensions();
  const fullW = width - GUTTER * 2;
  const colW = (fullW - GAP) / 2;
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); // list-level error
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null); // inside the add form

  const change = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setFieldError(null);
  };
  const saved = (methods: PaymentMethodDTO[]) => {
    a.setMethods(methods || []);
    setBusy(false);
    setAdding(false);
    setForm(EMPTY);
  };
  // "Set as default" and "Remove" on a saved method
  const act = (request: () => Promise<PaymentMethodDTO[]>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setFieldError(null);
    request().then(saved, (err) => {
      setBusy(false);
      setError(errText(err));
    });
  };
  const save = () => {
    if (busy) return;
    let body: Record<string, unknown>;
    if (form.kind === "telebirr") {
      if (!isCompletePhone(form.phone)) return setFieldError({ field: "phone", message: PHONE_HINT });
      body = { kind: "telebirr", phone: form.phone.trim() };
    } else {
      if (!/^\d{4}$/.test(form.last4.trim())) return setFieldError({ field: "last4", message: "Enter the last four digits of the card." });
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(form.expiry.trim())) return setFieldError({ field: "expiry", message: "Enter the expiry as MM/YY." });
      body = { kind: "card", brand: form.brand, last4: form.last4.trim(), expiry: form.expiry.trim(), holder: form.holder.trim() || undefined };
    }
    setBusy(true);
    setError("");
    setFieldError(null);
    paymentMethods.add(body).then(saved, (err) => {
      setBusy(false);
      setFieldError({ field: (err && err.field) || "", message: errText(err) });
    });
  };
  const errorFor = (k: string) => (fieldError && fieldError.field === k ? fieldError.message : null);

  return (
    <>
      <TabTitle eyebrow="Secure checkout" title="Payment methods" />
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
          {a.methods.map((m) => (
            <MethodCard key={m.id} m={m} width={fullW} busy={busy} onDefault={() => act(() => paymentMethods.update(m.id, { isDefault: true }))} onRemove={() => act(() => paymentMethods.remove(m.id))} />
          ))}
          {a.methods.length === 0 && !adding ? <EmptyBox title="No saved payment methods" text="Save a Telebirr number or a card reminder to pick it at checkout." style={{ width: colW, padding: 16 }} /> : null}
          {adding ? (
            <View style={{ width: fullW, borderWidth: 1, borderColor: "#BFD8EE", borderRadius: 24, padding: 24, gap: 12, backgroundColor: C.white }}>
              <T s={16} w={700}>
                Add card or Telebirr number
              </T>
              <View style={{ gap: 10 }}>
                <Segment
                  label="Payment method type"
                  value={form.kind}
                  onChange={(kind) => change({ kind })}
                  options={[
                    { id: "telebirr", label: "Telebirr" },
                    { id: "card", label: "Card" },
                  ]}
                />
                {form.kind === "telebirr" ? (
                  <APhone label="Telebirr phone number" value={form.phone} onChangeText={(v) => change({ phone: v })} error={errorFor("phone")} />
                ) : (
                  <>
                    <View style={{ gap: 6 }}>
                      <T s={13} w={600}>
                        Card brand
                      </T>
                      <Segment
                        label="Card brand"
                        value={form.brand}
                        onChange={(brand) => change({ brand })}
                        options={[
                          { id: "Visa", label: "Visa" },
                          { id: "Mastercard", label: "Mastercard" },
                        ]}
                      />
                      <FormError>{errorFor("brand")}</FormError>
                    </View>
                    <AField label="Last 4 digits" placeholder="1234" keyboardType="number-pad" maxLength={4} value={form.last4} onChangeText={(v) => change({ last4: v.replace(/\D/g, "") })} error={errorFor("last4")} />
                    <AField label="Expiry (MM/YY)" placeholder="MM/YY" keyboardType="number-pad" maxLength={5} value={form.expiry} onChangeText={(v) => change({ expiry: expiryText(v) })} error={errorFor("expiry")} />
                    <AField label="Name on card" value={form.holder} onChangeText={(v) => change({ holder: v })} autoComplete="name" error={errorFor("holder")} />
                    <T s={12} c={C.muted} lh={18}>
                      {CARD_NOTE}
                    </T>
                  </>
                )}
                <FormError>{fieldError && !FIELDS.includes(fieldError.field) ? fieldError.message : ""}</FormError>
                <FormActions
                  saveLabel={busy ? "Saving…" : form.kind === "telebirr" ? "Save Telebirr number" : "Save card"}
                  busy={busy}
                  onSave={save}
                  onCancel={() => {
                    setAdding(false);
                    setForm(EMPTY);
                    setFieldError(null);
                  }}
                />
              </View>
            </View>
          ) : null}
          <AddTile
            title="Add card or Telebirr number"
            width={colW}
            h={200}
            disabled={adding}
            onPress={() => {
              setAdding(true);
              setForm({ ...EMPTY, phone: a.user.phone || "" });
              setFieldError(null);
              setError("");
            }}
          />
        </View>
        <FormError>{error}</FormError>
      </View>

      <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 20, paddingVertical: 20, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Icon xml={ICON.lock} size={20} color={C.navy} sw={1.7} />
        <T s={14} c={C.text} style={{ flex: 1 }}>
          {CARD_NOTE}
        </T>
      </View>
    </>
  );
}

/** A saved method drawn as a card: green for Telebirr, navy for bank cards. */
function MethodCard({ m, width, busy, onDefault, onRemove }: { m: PaymentMethodDTO; width: number; busy: boolean; onDefault: () => void; onRemove: () => void }) {
  const tele = m.kind === "telebirr";
  const brand = (m.brand || "Card").toUpperCase();
  const main = tele ? m.phone || "" : "•••• " + (m.last4 || "····");
  const soft = tele ? "#D5F0DE" : "#CFE2F3";
  return (
    <View style={{ width, minHeight: 200, borderRadius: 24, padding: 24, backgroundColor: tele ? "#1F7A45" : C.navy, justifyContent: "space-between", gap: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ height: 30, paddingHorizontal: 12, borderRadius: 8, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
          {tele ? (
            <PayLogo brand="telebirr" />
          ) : hasPayLogo(m.brand) ? (
            <PayLogo brand={m.brand || ""} />
          ) : (
            <T s={12} w={800} c={C.navy}>
              {brand}
            </T>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {m.isDefault ? (
            <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)", justifyContent: "center" }}>
              <T s={12} w={700} c={C.white}>
                Default
              </T>
            </View>
          ) : (
            <GhostBtn title="Set as default" onPress={onDefault} disabled={busy} />
          )}
          <GhostBtn title="Remove" onPress={onRemove} disabled={busy} label={"Remove " + (tele ? "Telebirr " + main : brand + " " + main)} />
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <T s={13} c={soft}>
          {tele ? "Mobile money" : "Expires " + (m.expiry || "—")}
        </T>
        <H s={24} lh={29} c={C.white} ls={tele ? -0.48 : 0.96}>
          {main}
        </H>
        {!tele && m.holder ? (
          <T s={13} c="#CFE2F3">
            {m.holder}
          </T>
        ) : null}
      </View>
    </View>
  );
}

function GhostBtn({ title, onPress, disabled, label }: { title: string; onPress: () => void; disabled: boolean; label?: string }) {
  return (
    <Tap onPress={onPress} disabled={disabled} label={label} hitSlop={2} style={{ height: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 12, justifyContent: "center", opacity: disabled ? 0.6 : 1 }}>
      <T s={13} w={700} c={C.white}>
        {title}
      </T>
    </Tap>
  );
}
