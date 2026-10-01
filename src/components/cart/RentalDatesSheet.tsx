/*
 * "Change dates" for a rental in the cart: pick a new rental length (the product's plans, as on the
 * product page) and start date, preview the price, and save it to the cart line.
 */
import React, { useState } from "react";
import { View } from "react-native";
import { C } from "@/theme";
import { rentalBasePrice, rentalLinePrice, shopToday } from "@/lib/pricing";
import { cart, formatETB } from "@/lib/store";
import type { CartLineDTO } from "@/lib/types";
import { addDaysISO, DateField, formatDay, QtyStepper, Sheet } from "@/components/controls";
import { Btn, Note, T, Tap } from "@/components/ui";

const MAX_RENT_DAYS = 90;
const DUR_LABELS: Record<number, string> = { 1: "1 day", 3: "3 days", 7: "1 week", 14: "2 weeks" };
export const daysLabel = (n: number) => n + (n === 1 ? " day" : " days");
const durLabel = (days: number) => DUR_LABELS[days] || daysLabel(days);

/** Mount it with a fresh `key` each time it opens so it starts from the line's current dates. */
export function RentalDatesSheet({ line, open, onClose }: { line: CartLineDTO; open: boolean; onClose: () => void }) {
  const p = line.product;
  const rate = p.rent || 0;
  const plans = p.plans || [];
  // rentals start from tomorrow, like on the product page (read once when the sheet mounts)
  const [minStart] = useState(() => addDaysISO(shopToday(), 1));
  const [days, setDays] = useState(line.rentDays || 1);
  const [start, setStart] = useState(line.rentStart || minStart);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // the product's plans, plus the line's current length when it isn't one of them
  const lengths = plans.map((pl) => pl.days);
  if (line.rentDays && plans.length && !lengths.includes(line.rentDays)) lengths.push(line.rentDays);
  lengths.sort((a, b) => a - b);

  const total = rentalLinePrice(rate, plans, p.addOns || [], line.addOns || [], days);
  const changed = days !== line.rentDays || start !== line.rentStart;
  const tooEarly = start < minStart;

  const save = () => {
    if (busy) return;
    if (tooEarly) {
      setErr("Choose a start date from " + formatDay(minStart) + " onwards.");
      return;
    }
    setBusy(true);
    setErr("");
    cart.update(line.id, { rentStart: start, rentDays: days }).then(onClose, (e) => {
      setBusy(false);
      setErr((e && e.message) || "Something went wrong. Please try again.");
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Change dates"
      footer={
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <T s={14} c={C.text} numberOfLines={1} style={{ flexShrink: 1 }}>
              {p.name} · {daysLabel(days)}
            </T>
            <T s={16} w={700}>
              {formatETB(total)}
            </T>
          </View>
          <Note>{err}</Note>
          <Btn title={busy ? "Saving…" : "Save dates"} full disabled={busy || !changed} onPress={save} />
        </View>
      }
    >
      <View style={{ gap: 22 }}>
        <View style={{ gap: 12 }}>
          <T s={13} w={700} c={C.green} ls={1.3} upper>
            How long do you need it?
          </T>
          {lengths.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }} accessibilityLabel="Rental length">
              {lengths.map((d) => {
                const on = d === days;
                const price = rentalBasePrice(rate, plans, d);
                const pct = d * rate > 0 ? Math.round((1 - price / (d * rate)) * 100) : 0;
                return (
                  <Tap
                    key={d}
                    onPress={() => {
                      setDays(d);
                      setErr("");
                    }}
                    hitSlop={0}
                    accessibilityState={{ selected: on }}
                    style={{ flexBasis: "45%", flexGrow: 1, height: 84, paddingHorizontal: 8, borderWidth: 2, borderColor: on ? C.green : C.lineStrong, borderRadius: 16, backgroundColor: on ? C.greenBg : C.white, alignItems: "center", justifyContent: "center", gap: 3 }}
                  >
                    <T s={15} w={700}>
                      {durLabel(d)}
                    </T>
                    <T s={13} c={C.text}>
                      {formatETB(price)}
                    </T>
                    {pct > 0 ? (
                      <T s={12} w={700} c={C.green}>
                        Save {pct}%
                      </T>
                    ) : null}
                  </Tap>
                );
              })}
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <QtyStepper value={days} min={1} max={MAX_RENT_DAYS} onChange={setDays} />
              <T s={15} c={C.text}>
                {days === 1 ? "day" : "days"} · {formatETB(rate)} / day
              </T>
            </View>
          )}
        </View>
        <DateField
          label="Start date"
          value={start}
          min={minStart}
          error={tooEarly ? "Rentals start from " + formatDay(minStart) + "." : null}
          onChange={(iso) => {
            setStart(iso);
            setErr("");
          }}
        />
        <View style={{ gap: 8 }}>
          <T s={14} w={600}>
            Return by
          </T>
          <View style={{ height: 52, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.greenBg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <T s={15} w={700}>
              {formatDay(addDaysISO(start, days))}
            </T>
            <T s={12} w={600} c={C.green}>
              We collect
            </T>
          </View>
        </View>
      </View>
    </Sheet>
  );
}
