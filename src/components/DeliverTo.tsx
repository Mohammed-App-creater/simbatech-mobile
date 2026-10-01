/*
 * The utility bar's "Deliver to …" button and its sheet. Signed-in customers pick one of their saved
 * addresses (it becomes the default, so checkout preselects it); anyone can pick their sub-city,
 * which is remembered on this device, shown on the button and prefilled at checkout.
 */
import React, { useState } from "react";
import { View } from "react-native";
import { C } from "@/theme";
import { api, formatETB, navigate, storeVals, useShop } from "@/lib/store";
import { FREE_DELIVERY_THRESHOLD } from "@/lib/pricing";
import { saveDeliverArea, SUB_CITIES, useDeliverArea } from "@/lib/deliver-area";
import type { AddressDTO } from "@/lib/types";
import { Icon, ICON, Note, T, Tap } from "./ui";
import { Sheet } from "./controls";

function cutoffLabel(hour: number) {
  const h = hour % 12 || 12;
  return h + (hour < 12 ? "am" : "pm");
}

export function DeliverTo() {
  const shop = useShop();
  const store = storeVals(shop);
  const area = useDeliverArea();
  const [open, setOpen] = useState(false);
  const [addrs, setAddrs] = useState<AddressDTO[] | null>(null); // null = not loaded, [] = none / signed out
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const signedIn = !!shop.user;

  const show = () => {
    setError("");
    setOpen(true);
    if (!signedIn) return setAddrs([]);
    api<{ addresses: AddressDTO[] }>("GET", "/api/addresses")
      .then((res) => setAddrs(res.addresses || []))
      .catch(() => setAddrs([]));
  };
  const pickArea = (a: string) => {
    saveDeliverArea(a);
    setOpen(false);
  };
  const pickAddress = (a: AddressDTO) => {
    if (busy) return;
    setError("");
    const done = () => {
      if (a.area) saveDeliverArea(a.area);
      setBusy(null);
      setOpen(false);
    };
    if (a.isDefault) return done();
    setBusy(a.id);
    api<{ addresses: AddressDTO[] }>("PATCH", "/api/addresses/" + a.id, { isDefault: true })
      .then((res) => {
        setAddrs(res.addresses || addrs);
        done();
      })
      .catch((err) => {
        setBusy(null);
        setError(err.message || "Couldn't update your address. Try again.");
      });
  };
  const hasAddrs = signedIn && !!addrs && addrs.length > 0;
  const label = { fontSize: 12, letterSpacing: 0.96 } as const;

  return (
    <>
      <Tap
        onPress={show}
        label={"Deliver to " + (area || store.city) + ". Change"}
        hitSlop={8}
        style={{ height: 24, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 8, backgroundColor: open ? "rgba(255,255,255,0.12)" : "transparent" }}
      >
        <Icon xml={ICON.pin} size={14} color={C.mint} sw={2} />
        <T s={12} c={C.white}>
          Deliver to{" "}
          <T s={12} w={700} c={C.white}>
            {area || store.city}
          </T>
        </T>
        <Icon xml={ICON.chevronDown} size={12} color={C.white} sw={2.2} />
      </Tap>

      <Sheet open={open} onClose={() => setOpen(false)} title="Where should we deliver?">
        <View style={{ gap: 16 }}>
          <T s={13} c={C.muted} lh={19}>
            We deliver across {store.city}. Order before {cutoffLabel(store.sameDayCutoffHour)} for same-day delivery; free on purchases over {formatETB(FREE_DELIVERY_THRESHOLD)}.
          </T>

          {hasAddrs ? (
            <View style={{ gap: 8 }}>
              <T w={700} c={C.muted} upper style={label}>
                Your addresses
              </T>
              {addrs!.map((a) => (
                <Tap
                  key={a.id}
                  onPress={() => pickAddress(a)}
                  disabled={busy !== null}
                  hitSlop={0}
                  accessibilityState={{ selected: a.isDefault }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: a.isDefault ? C.navy : C.line, borderRadius: 14, backgroundColor: a.isDefault ? C.sky : C.white }}
                >
                  <View style={{ width: 16, height: 16, borderRadius: 999, borderWidth: 2, borderColor: a.isDefault ? C.navy : "#B4B8BF", alignItems: "center", justifyContent: "center" }}>
                    {a.isDefault ? <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: C.navy }} /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T s={14} w={700}>
                      {busy === a.id ? "Saving…" : a.label}
                    </T>
                    <T s={13} c={C.muted} numberOfLines={1}>
                      {[a.line1, a.area, a.city].filter(Boolean).join(", ")}
                    </T>
                  </View>
                </Tap>
              ))}
              <Note>{error}</Note>
              <Tap
                onPress={() => {
                  setOpen(false);
                  navigate("/account?tab=addresses");
                }}
                style={{ alignSelf: "flex-start" }}
              >
                <T s={13} w={600} c={C.blue}>
                  Manage addresses
                </T>
              </Tap>
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <T w={700} c={C.muted} upper style={label}>
              {hasAddrs ? "Or choose your area" : "Choose your area"}
            </T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {SUB_CITIES.map((a) => {
                const on = a === area;
                return (
                  <Tap
                    key={a}
                    onPress={() => pickArea(a)}
                    hitSlop={2}
                    accessibilityState={{ selected: on }}
                    style={{ height: 36, paddingHorizontal: 14, borderWidth: 1, borderColor: on ? C.navy : C.lineStrong, borderRadius: 999, backgroundColor: on ? C.navy : C.white, justifyContent: "center" }}
                  >
                    <T s={13} w={600} c={on ? C.white : C.ink}>
                      {a}
                    </T>
                  </Tap>
                );
              })}
            </View>
          </View>

          {!signedIn ? (
            <T s={13} c={C.muted}>
              <T
                s={13}
                w={600}
                c={C.blue}
                onPress={() => {
                  setOpen(false);
                  navigate("/signin");
                }}
              >
                Sign in
              </T>{" "}
              to use your saved addresses.
            </T>
          ) : null}
        </View>
      </Sheet>
    </>
  );
}
