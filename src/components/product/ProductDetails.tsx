/*
 * "Everything about the <product>": the Overview / Specifications / Rental terms / Reviews tabs
 * of the product page, including the rating breakdown and the write / edit / delete review form.
 */
import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { C } from "@/theme";
import { formatETB, reviews as reviewsApi, storeVals, useShop } from "@/lib/store";
import type { ProductDTO, ReviewsDTO } from "@/lib/types";
import { Btn, Field, H, Icon, ICON, T, Tap } from "@/components/ui";
import { errMsg, ICON_CHAT, ICON_PENCIL, plural, SOFT, Stars, STAR_OFF, type MyReview } from "./shared";

export type DetailsTab = "overview" | "specs" | "terms" | "reviews";

const TABS: { id: DetailsTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "specs", label: "Specifications" },
  { id: "terms", label: "Rental terms" },
  { id: "reviews", label: "Reviews" },
];
const POPULAR_FOR = ["Weddings & events", "Travel", "Content creation", "Product shoots"];
const DELIVERY_WINDOW = "9am – 8pm";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "29 Sep 2026" (UTC, like the site).
function reviewDate(iso: string) {
  const d = new Date(iso || "");
  return isNaN(d.getTime()) ? "" : d.getUTCDate() + " " + MON[d.getUTCMonth()] + " " + d.getUTCFullYear();
}

export type ProductDetailsProps = {
  product: ProductDTO;
  reviews: ReviewsDTO;
  /** the API's refreshed reviews after the customer writes or deletes theirs */
  onReviews: (next: ReviewsDTO) => void;
  tab: DetailsTab;
  onTab: (tab: DetailsTab) => void;
};

export function ProductDetails({ product: P, reviews: rv, onReviews, tab: wanted, onTab }: ProductDetailsProps) {
  const shop = useShop();
  const store = storeVals(shop);
  const canRent = !!P.rent;
  const tab = wanted === "terms" && !canRent ? "overview" : wanted;
  const mine = rv.mine as MyReview | null;

  // Review form (kept here so a half-written review survives switching tabs).
  const [form, setForm] = useState({ open: false, rating: 0, title: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  const openForm = () => {
    setForm({ open: true, rating: mine ? mine.rating : 0, title: (mine && mine.title) || "", body: (mine && mine.body) || "" });
    setErr("");
    setNotice("");
    onTab("reviews");
  };
  const closeForm = () => {
    setForm((f) => ({ ...f, open: false }));
    setErr("");
  };
  const patchForm = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErr("");
  };

  // Posts (or updates) the customer's review; the API answers with the refreshed reviews.
  const submit = () => {
    if (busy) return;
    if (!form.rating) return setErr("Choose a star rating");
    if (!form.body.trim()) return setErr("Write your review");
    const hadMine = !!mine;
    setBusy(true);
    setErr("");
    setNotice("");
    reviewsApi.write(P.id, { rating: form.rating, title: form.title.trim(), body: form.body.trim() }).then(
      (res) => {
        onReviews(res);
        setBusy(false);
        setForm((f) => ({ ...f, open: false }));
        setNotice(hadMine ? "Your review was updated. It will show again once we've approved it." : "Thanks — your review will show here once we've approved it.");
      },
      (e) => {
        setBusy(false);
        setErr(errMsg(e));
      },
    );
  };
  const remove = () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    setNotice("");
    reviewsApi.remove(P.id).then(
      (res) => {
        onReviews(res);
        setBusy(false);
        setForm({ open: false, rating: 0, title: "", body: "" });
        setNotice("Your review was deleted.");
      },
      (e) => {
        setBusy(false);
        setErr(errMsg(e));
      },
    );
  };

  return (
    <View style={{ gap: 28 }}>
      <View style={{ gap: 12 }}>
        <View style={{ gap: 8 }}>
          <T s={13} w={700} c={C.navy} ls={1.3} upper>
            Product details
          </T>
          <H s={29.25} lh={29.25} ls={-1.17}>
            Everything about the {P.name}
          </H>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderRadius: 14, backgroundColor: C.sand, flexGrow: 0 }} contentContainerStyle={{ padding: 4, gap: 4 }} accessibilityRole="tablist">
          {TABS.filter((t) => t.id !== "terms" || canRent).map((t) => {
            const on = t.id === tab;
            return (
              <Tap
                key={t.id}
                onPress={() => onTab(t.id)}
                hitSlop={0}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[{ height: 44, paddingHorizontal: 20, borderRadius: 11, justifyContent: "center", backgroundColor: on ? C.white : "transparent" }, on && { boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }]}
              >
                <T s={14} w={600} c={on ? C.ink : C.muted}>
                  {t.id === "reviews" ? "Reviews (" + (rv.count || 0) + ")" : t.label}
                </T>
              </Tap>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 28, padding: 40 }}>
        {tab === "overview" ? <Overview product={P} /> : null}
        {tab === "specs" ? <Specs product={P} warranty={P.warranty || store.warranty} /> : null}
        {tab === "terms" ? <Terms product={P} /> : null}
        {tab === "reviews" ? (
          <Reviews
            product={P}
            reviews={rv}
            signedIn={!!shop.user}
            form={form}
            busy={busy}
            err={err}
            notice={
              notice ||
              (mine && mine.status === "pending"
                ? "Your review is waiting for approval. It will show here once we've checked it."
                : mine && mine.status === "rejected"
                  ? "Your review wasn't published. You can edit it and send it again."
                  : "")
            }
            onOpen={openForm}
            onClose={closeForm}
            onChange={patchForm}
            onSubmit={submit}
            onDelete={remove}
          />
        ) : null}
      </View>
    </View>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <H s={28} lh={32} ls={-0.98}>
      {children}
    </H>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function Overview({ product: P }: { product: ProductDTO }) {
  const canRent = !!P.rent;
  const canBuy = !P.rentOnly;
  const inBox = P.inTheBox && P.inTheBox.length ? P.inTheBox : [P.name];
  const note =
    P.kind === "camera"
      ? "Renting? Your " + P.name + " arrives with a charged battery and a formatted memory card slot, ready to shoot. Buying? It ships sealed, with the manufacturer's warranty."
      : canRent && canBuy
        ? "Renting? Your " + P.name + " arrives checked, cleaned and ready to use. Buying? It ships sealed, with the manufacturer's warranty."
        : canRent
          ? "Your " + P.name + " arrives checked, cleaned and ready to use, and we collect it on the return date."
          : "Your " + P.name + " ships sealed, with the manufacturer's warranty.";
  return (
    <View style={{ gap: 40 }}>
      <View style={{ gap: 18 }}>
        <PanelTitle>About the {P.name}</PanelTitle>
        <T s={16} lh={26.4} c={C.text}>
          {P.description}
        </T>
        <T s={16} lh={26.4} c={C.text}>
          {note}
        </T>
        <View style={{ gap: 10, paddingTop: 6 }}>
          <T s={14} w={600}>
            Popular for
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {POPULAR_FOR.map((label) => (
              <View key={label} style={{ height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.sand, justifyContent: "center" }}>
                <T s={13} w={600} c={C.text}>
                  {label}
                </T>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={{ backgroundColor: SOFT, borderRadius: 24, padding: 28, gap: 16 }}>
        <H s={22} lh={26} ls={-0.66}>
          In the box
        </H>
        <View style={{ gap: 12 }}>
          {inBox.map((label, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: C.greenBg, alignItems: "center", justifyContent: "center" }}>
                <Icon xml={ICON.check} size={14} color={C.green} sw={2.4} />
              </View>
              <T s={15} style={{ flex: 1 }}>
                {label}
              </T>
            </View>
          ))}
        </View>
        <T s={13} c={C.muted} lh={17}>
          Rentals ship with the same contents, checked before every booking.
        </T>
      </View>
    </View>
  );
}

// ── Specifications ────────────────────────────────────────────────────────────

function Specs({ product: P, warranty }: { product: ProductDTO; warranty: string }) {
  // The spec sheet comes from the product; one without specs gets the generic rows.
  const hasSpecs = !!(P.specs && P.specs.length);
  let rows: [string, string][] = hasSpecs
    ? P.specs.slice()
    : [
        ["Category", P.cat],
        ["Brand", P.brand],
      ];
  if (!rows.some((r) => /^warranty$/i.test(r[0]))) rows = rows.concat([["Warranty", warranty]]);
  return (
    <View style={{ gap: 20 }}>
      <PanelTitle>Specifications</PanelTitle>
      <View>
        {rows.map(([k, v], i) => (
          <View key={i} style={{ minHeight: 53, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <T s={15} c={C.muted}>
              {k}
            </T>
            <T s={15} w={600} style={{ flex: 1, textAlign: "right" }}>
              {v}
            </T>
          </View>
        ))}
      </View>
      {hasSpecs ? null : (
        <T s={13} c={C.muted}>
          Specifications to be confirmed with the supplier before launch.
        </T>
      )}
    </View>
  );
}

// ── Rental terms ──────────────────────────────────────────────────────────────

function Terms({ product: P }: { product: ProductDTO }) {
  const store = storeVals(useShop());
  // The damage-cover add-on (when the product offers one) names the lower excess in its note.
  const cover = (P.addOns || []).find((a) => /cover|damage/i.test(a.key + " " + a.label));
  const excess = cover ? /ETB [\d,]+/.exec(cover.note || "") : null;
  const terms = [
    { title: "Deposit", body: "A refundable deposit of " + formatETB(P.deposit || 0) + " is held when you book and released within " + plural(store.depositRefundDays, "day") + " of collection." },
    { title: "Extending", body: "Need it longer? Extend from your account before the return date, at the same daily rate." },
    { title: "Damage", body: (store.damagePolicy || "").replace(/[.\s]+$/, "") + "." + (cover ? " Add damage cover to lower your excess" + (excess ? " to " + excess[0] : "") + "." : "") },
    { title: "Delivery & collection", body: "We deliver on your start date and collect on the return date, " + DELIVERY_WINDOW + "." },
  ];
  return (
    <View style={{ gap: 22 }}>
      <View style={{ gap: 4, alignItems: "flex-start" }}>
        <PanelTitle>Rental terms</PanelTitle>
        <Tap href="/p/rental-terms" style={{ height: 44, justifyContent: "center" }}>
          <T s={15} w={600} c={C.green}>
            Read the full rental terms
          </T>
        </Tap>
      </View>
      <View style={{ gap: 16 }}>
        {terms.map((t, i) => (
          <View key={t.title} style={{ backgroundColor: SOFT, borderRadius: 22, padding: 24, flexDirection: "row", gap: 16 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.greenBg, alignItems: "center", justifyContent: "center" }}>
              <H s={18} lh={22} ls={0} c={C.green}>
                {"0" + (i + 1)}
              </H>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <T s={17} w={700} lh={22}>
                {t.title}
              </T>
              <T s={15} lh={23.25} c={C.text}>
                {t.body}
              </T>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Reviews ───────────────────────────────────────────────────────────────────

type ReviewForm = { open: boolean; rating: number; title: string; body: string };

function Reviews(props: {
  product: ProductDTO;
  reviews: ReviewsDTO;
  signedIn: boolean;
  form: ReviewForm;
  busy: boolean;
  err: string;
  notice: string;
  onOpen: () => void;
  onClose: () => void;
  onChange: (patch: Partial<ReviewForm>) => void;
  onSubmit: () => void;
  onDelete: () => void;
}) {
  const { product: P, reviews: rv, signedIn, form, busy, err, notice } = props;
  const mine = rv.mine as MyReview | null;
  const count = rv.count || 0;
  const items = rv.items || [];
  const writeLabel = mine ? "Update your review" : "Write a review";
  // Guests are sent to sign in and come back to this product.
  const signInHref = "/signin?next=" + encodeURIComponent("/product/" + P.id);
  const writeButton = (title: string) =>
    signedIn ? <Btn title={title} variant="navy" h={48} px={22} iconLeft={ICON_PENCIL} iconSize={16} onPress={props.onOpen} /> : <Btn title="Write a review" variant="navy" h={48} px={22} iconLeft={ICON_PENCIL} iconSize={16} href={signInHref} />;

  return (
    <View style={{ gap: 40 }}>
      <View style={{ gap: 16 }}>
        <PanelTitle>Customer reviews</PanelTitle>
        <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 10 }}>
          <H s={56} lh={56} ls={-2.24}>
            {rv.rating || "0.0"}
          </H>
          <T s={15} c={C.muted}>
            out of 5 · {plural(count, "review")}
          </T>
        </View>
        <View accessibilityLabel="Rating distribution" style={{ gap: 10 }}>
          {(rv.distribution || []).map((d) => (
            <View key={d.stars} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 44, flexDirection: "row", alignItems: "center", gap: 4 }}>
                <T s={13} w={600} c={C.text}>
                  {d.stars}
                </T>
                <Icon xml={ICON.star} size={12} color={C.star} filled />
              </View>
              <View style={{ flex: 1, height: 10, borderRadius: 999, backgroundColor: "#F1EEE8", overflow: "hidden" }}>
                <View style={{ height: 10, width: `${d.percent}%`, borderRadius: 999, backgroundColor: d.percent > 0 ? C.star : "transparent" }} />
              </View>
              <T s={13} c={C.muted} style={{ width: 36, textAlign: "right" }}>
                {d.percent}%
              </T>
            </View>
          ))}
        </View>
      </View>

      {items.length > 0 || form.open ? (
        <View style={{ gap: 18 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <T s={15} c={C.muted}>
              {plural(count, "review")}
            </T>
            {writeButton(writeLabel)}
          </View>

          {form.open ? (
            <View style={{ backgroundColor: SOFT, borderRadius: 22, padding: 24, gap: 14 }}>
              <T s={17} w={700}>
                {writeLabel}
              </T>
              <View style={{ gap: 4 }}>
                <View accessibilityLabel="Your rating" style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Tap key={n} onPress={() => props.onChange({ rating: n })} hitSlop={0} label={plural(n, "star")} accessibilityState={{ selected: n <= form.rating }} style={{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" }}>
                      <Icon xml={ICON.star} size={24} color={n <= form.rating ? C.star : STAR_OFF} filled />
                    </Tap>
                  ))}
                </View>
                <T s={13} c={C.muted}>
                  {form.rating ? "Your rating: " + plural(form.rating, "star") : "Choose a rating"}
                </T>
              </View>
              <Field accessibilityLabel="Review title" value={form.title} onChangeText={(title) => props.onChange({ title })} maxLength={80} placeholder="Title (optional)" r={14} />
              <Field accessibilityLabel="Your review" value={form.body} onChangeText={(body) => props.onChange({ body })} maxLength={2000} multiline h={112} r={14} placeholder={"How did the " + P.name + " work out for you?"} style={{ lineHeight: 22 }} />
              {err ? (
                <T s={13} w={600} c={C.red} accessibilityLiveRegion="polite">
                  {err}
                </T>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                <Btn title={busy ? "Saving…" : mine ? "Update your review" : "Post review"} variant="navy" h={48} px={22} disabled={busy} onPress={props.onSubmit} />
                <Tap onPress={props.onClose} style={{ height: 48, paddingHorizontal: 18, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 14, backgroundColor: C.white, justifyContent: "center" }}>
                  <T s={15} w={600}>
                    Cancel
                  </T>
                </Tap>
                {mine ? (
                  <Tap onPress={props.onDelete} disabled={busy} style={{ height: 48, paddingHorizontal: 6, justifyContent: "center" }}>
                    <T s={14} w={600} c={C.red}>
                      Delete your review
                    </T>
                  </Tap>
                ) : null}
              </View>
            </View>
          ) : null}

          {notice ? <Notice text={notice} /> : null}

          <View style={{ gap: 14 }}>
            {items.map((r) => (
              <View key={r.id} style={{ backgroundColor: SOFT, borderRadius: 22, padding: 24, gap: 8 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 12, rowGap: 4 }}>
                  <Stars value={r.rating} size={14} />
                  <T s={13} c={C.muted}>
                    {r.author + (mine && mine.id === r.id ? " (you)" : "") + " · " + reviewDate(r.createdAt)}
                  </T>
                </View>
                {r.title ? (
                  <T s={17} w={700} lh={22}>
                    {r.title}
                  </T>
                ) : null}
                <T s={15} lh={23.25} c={C.text}>
                  {r.body}
                </T>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ borderWidth: 1.5, borderStyle: "dashed", borderColor: "#D9D6CE", borderRadius: 24, paddingVertical: 32, paddingHorizontal: 20, alignItems: "center", gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.sky, alignItems: "center", justifyContent: "center" }}>
            <Icon xml={ICON_CHAT} size={28} color={C.navy} sw={1.7} />
          </View>
          <H s={24} lh={28} ls={-0.72} center>
            Reviews will appear here
          </H>
          <T s={15} lh={23.25} c={C.muted} center>
            Customers who bought or rented the {P.name} can share how it went after their order.
          </T>
          {writeButton("Write a review")}
          {notice ? <Notice text={notice} /> : null}
        </View>
      )}
    </View>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <T s={13} w={600} c={C.green} lh={18} accessibilityLiveRegion="polite">
      {text}
    </T>
  );
}
