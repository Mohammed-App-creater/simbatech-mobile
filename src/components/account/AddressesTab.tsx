/*
 * Account › Addresses: saved delivery addresses with add, edit, delete and "set as default".
 * The add / edit form opens inside the card, like on the website.
 */
import React, { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { C, GUTTER } from "@/theme";
import { api } from "@/lib/store";
import { isCompletePhone } from "@/lib/phone";
import type { AddressDTO } from "@/lib/types";
import { T, Tap } from "@/components/ui";
import { Checkbox } from "@/components/controls";
import { AddTile, AField, APhone, errText, FormActions, FormError, MiniBtn, PHONE_HINT, TabTitle, type Account } from "./shared";

const EMPTY = { label: "", line1: "", area: "", city: "", phone: "", notes: "", isDefault: false };
type Form = typeof EMPTY;
const GAP = 20;

export function AddressesTab({ a }: { a: Account }) {
  const { width } = useWindowDimensions();
  const fullW = width - GUTTER * 2;
  const colW = (fullW - GAP) / 2;
  const [edit, setEdit] = useState<number | "new" | null>(null); // address id being edited, or "new"
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const open = (target: number | "new", values: Form) => {
    setEdit(target);
    setForm(values);
    setError("");
  };
  const cancel = () => {
    setEdit(null);
    setForm(EMPTY);
    setError("");
  };
  const change = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setError("");
  };
  const done = (res: { addresses: AddressDTO[] }) => {
    a.setAddresses(res.addresses);
    setBusy(false);
    setEdit(null);
    setForm(EMPTY);
  };
  const fail = (err: unknown) => {
    setBusy(false);
    setError(errText(err));
  };

  const save = () => {
    if (busy) return;
    if (!isCompletePhone(form.phone)) {
      setError(PHONE_HINT);
      return;
    }
    const body = { label: form.label, line1: form.line1, area: form.area, city: form.city, phone: form.phone, notes: form.notes || undefined, isDefault: !!form.isDefault };
    setBusy(true);
    setError("");
    (edit === "new" ? api("POST", "/api/addresses", body) : api("PATCH", "/api/addresses/" + edit, body)).then(done, fail);
  };
  // "Set as default" and "Delete" on a card
  const act = (method: "PATCH" | "DELETE", id: number, body?: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    api(method, "/api/addresses/" + id, body).then(done, fail);
  };

  const formEl = <AddressForm form={form} onChange={change} error={error} busy={busy} onSave={save} onCancel={cancel} />;
  const defaultAddr = a.addresses.find((x) => x.isDefault);

  return (
    <>
      <TabTitle eyebrow="Delivery & pickup" title="Addresses" />
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
          {a.addresses.map((x) => {
            const editing = edit === x.id;
            return (
              <View key={x.id} style={{ width: editing ? fullW : colW, minHeight: 220, borderWidth: 1.5, borderColor: x.isDefault ? "#1679BE" : C.line, borderRadius: 24, padding: editing ? 24 : 16, gap: 10, backgroundColor: C.white }}>
                {editing ? (
                  formEl
                ) : (
                  <>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, paddingHorizontal: 4, paddingTop: 4 }}>
                      <T s={16} w={700} numberOfLines={1} style={{ flexShrink: 1 }}>
                        {x.label}
                      </T>
                      {x.isDefault ? (
                        <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: C.sky, justifyContent: "center" }}>
                          <T s={12} w={700} c={C.navy}>
                            Default
                          </T>
                        </View>
                      ) : null}
                    </View>
                    <T s={14} c={C.text} lh={22.4} style={{ paddingHorizontal: 4 }}>
                      {[a.user.name, x.line1, x.area + ", " + x.city, x.phone].concat(x.notes ? [x.notes] : []).join("\n")}
                    </T>
                    <View style={{ flexGrow: 1 }} />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 4, rowGap: 4 }}>
                      <MiniBtn title="Edit" tone="outline" px={14} onPress={() => open(x.id, { label: x.label, line1: x.line1, area: x.area, city: x.city, phone: x.phone, notes: x.notes || "", isDefault: !!x.isDefault })} />
                      <MiniBtn title="Delete" tone="plainRed" px={12} label={"Delete " + x.label + " address"} disabled={busy} onPress={() => act("DELETE", x.id)} />
                      {x.isDefault ? null : <MiniBtn title="Set as default" tone="plainNavy" px={12} disabled={busy} onPress={() => act("PATCH", x.id, { isDefault: true })} />}
                    </View>
                  </>
                )}
              </View>
            );
          })}
          {edit === "new" ? (
            <View style={{ width: fullW, borderWidth: 1.5, borderColor: "#1679BE", borderRadius: 24, padding: 24, gap: 10, backgroundColor: C.white }}>
              <T s={16} w={700}>
                New address
              </T>
              {formEl}
            </View>
          ) : (
            <AddTile title="Add a new address" width={colW} h={220} onPress={() => open("new", { ...EMPTY, phone: a.user.phone || "", city: defaultAddr ? defaultAddr.city : "" })} />
          )}
        </View>
        <FormError>{edit ? "" : error}</FormError>
      </View>
    </>
  );
}

function AddressForm({ form, onChange, error, busy, onSave, onCancel }: { form: Form; onChange: (patch: Partial<Form>) => void; error: string; busy: boolean; onSave: () => void; onCancel: () => void }) {
  return (
    <View style={{ gap: 10 }}>
      <AField label="Label" placeholder="Home, Work…" value={form.label} onChangeText={(v) => onChange({ label: v })} />
      <AField label="Street and house" value={form.line1} onChangeText={(v) => onChange({ line1: v })} autoComplete="street-address" />
      <AField label="Area / sub-city" value={form.area} onChangeText={(v) => onChange({ area: v })} />
      <AField label="City" value={form.city} onChangeText={(v) => onChange({ city: v })} />
      <APhone label="Phone" value={form.phone} onChangeText={(v) => onChange({ phone: v })} />
      <AField label="Notes for the driver" value={form.notes} onChangeText={(v) => onChange({ notes: v })} />
      <Tap onPress={() => onChange({ isDefault: !form.isDefault })} accessibilityRole="checkbox" accessibilityState={{ checked: form.isDefault }} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
        <Checkbox checked={form.isDefault} size={18} />
        <T s={14} c={C.text}>
          Use as my default address
        </T>
      </Tap>
      <FormError>{error}</FormError>
      <FormActions saveLabel={busy ? "Saving…" : "Save address"} busy={busy} onSave={onSave} onCancel={onCancel} />
    </View>
  );
}
