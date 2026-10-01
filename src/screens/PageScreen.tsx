/*
 * /p/<slug> — an information page from the admin (Help centre, Delivery, Returns, About, …):
 * eyebrow, title, summary, the body and "Last updated". The contact page adds the contact form
 * (topic preselected from ?topic=) and the store's details.
 */
import React, { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { C, GUTTER } from "@/theme";
import { clearCatalogCache, getPage } from "@/lib/catalog";
import { bootstrap, sendContact, storeVals, useShop } from "@/lib/store";
import type { PageDTO } from "@/lib/types";
import { Screen } from "@/components/Screen";
import { openUrl, telHref, waHref } from "@/components/SiteFooter";
import { Radio, Sheet } from "@/components/controls";
import { fmtShortDate } from "@/components/pages/dates";
import { PageEyebrow, PageIntro } from "@/components/pages/PageIntro";
import { RichText } from "@/components/pages/RichText";
import { Btn, Field, H, Icon, ICON, LoadError, Loading, T, Tap, useLoad } from "@/components/ui";
import { NotFoundBody } from "./NotFoundScreen";

// Eyebrow above the title, by page (the footer's column names).
const GROUPS: Record<string, string[]> = {
  "Customer care": ["help", "delivery", "returns", "rental-terms"],
  Company: ["about", "careers", "sell-with-us", "contact"],
  Legal: ["privacy", "terms", "cookies"],
};
const TOPICS = [
  { id: "support", label: "Help with an order or rental" },
  { id: "sell", label: "Selling or listing with Simbatech" },
  { id: "careers", label: "Working at Simbatech" },
  { id: "other", label: "Something else" },
];

const eyebrowFor = (slug: string) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(slug)) || "Simbatech";
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

export default function PageScreen() {
  const params = useLocalSearchParams<{ slug?: string; topic?: string }>();
  const slug = one(params.slug);
  // a fresh page (and a fresh contact form) for every slug
  return <Page key={slug} slug={slug} topic={one(params.topic)} />;
}

function Page({ slug, topic }: { slug: string; topic: string }) {
  const { data: page, error, loading, reload } = useLoad<PageDTO | null>(() => getPage(slug), [slug]);
  return (
    <Screen
      onRefresh={async () => {
        clearCatalogCache();
        reload();
        await bootstrap();
      }}
    >
      {page ? <PageBody page={page} topic={topic} /> : loading ? <Loading /> : error ? <LoadError message={error} onRetry={reload} /> : <NotFoundBody />}
    </Screen>
  );
}

function PageBody({ page, topic }: { page: PageDTO; topic: string }) {
  const updated = fmtShortDate(page.updatedAt);
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: 48, gap: 32 }}>
      <PageIntro eyebrow={eyebrowFor(page.slug)} title={page.title} summary={page.summary} />
      <RichText html={page.body} />
      {page.slug === "contact" ? (
        <View style={{ gap: 24 }}>
          <ContactForm topic={topic} />
          <StoreCard />
        </View>
      ) : null}
      {updated ? (
        <T s={13} c={C.muted}>
          Last updated {updated}
        </T>
      ) : null}
    </View>
  );
}

// ── Contact form ──────────────────────────────────────────────────────────────

type FormState = { topic: string; name: string; contact: string; message: string };

function ContactForm({ topic }: { topic: string }) {
  const [form, setForm] = useState<FormState>({ topic: TOPICS.some((t) => t.id === topic) ? topic : "support", name: "", contact: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState({ field: "", message: "" });
  const [sent, setSent] = useState(false);
  const [picking, setPicking] = useState(false);

  const change = (name: keyof FormState) => (value: string) => {
    setForm((f) => ({ ...f, [name]: value }));
    setError({ field: "", message: "" });
  };
  const submit = async () => {
    if (busy) return;
    if (form.name.trim().length < 2) return setError({ field: "name", message: "Enter your name" });
    if (form.contact.trim().length < 3) return setError({ field: "contact", message: "Enter your phone or email" });
    if (form.message.trim().length < 10) return setError({ field: "message", message: "Tell us a little more (at least 10 characters)" });
    setBusy(true);
    setError({ field: "", message: "" });
    try {
      await sendContact({ topic: form.topic, name: form.name.trim(), contact: form.contact.trim(), message: form.message.trim() });
      setSent(true);
      setForm((f) => ({ ...f, message: "" }));
    } catch (err: any) {
      setError({ field: (err && err.field) || "", message: (err && err.message) || "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  };
  const errFor = (name: string) => (error.field === name ? error.message : "");
  const general = error.message && !["name", "contact", "message", "topic"].includes(error.field) ? error.message : "";
  const topicLabel = (TOPICS.find((t) => t.id === form.topic) || TOPICS[0]).label;

  return (
    <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 28, padding: 28, gap: 18, backgroundColor: C.white }}>
      <View style={{ gap: 4 }}>
        <PageEyebrow>Send a message</PageEyebrow>
        <H s={26} lh={31} ls={-0.91} accessibilityRole="header">
          How can we help?
        </H>
      </View>
      {sent ? (
        <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.greenBg }} accessibilityLiveRegion="polite">
          <T s={14} lh={21} c={C.greenDark}>
            Thanks, {form.name.trim().split(/\s+/)[0]} — your message is in. We reply the same working day, usually within a few hours.
          </T>
        </View>
      ) : null}

      {/* topic: the site's <select>, as a box that opens a sheet of options */}
      <View style={{ gap: 8 }}>
        <T s={14} w={600}>
          Topic
        </T>
        <Tap
          onPress={() => setPicking(true)}
          hitSlop={0}
          label={"Topic: " + topicLabel}
          style={{ height: 52, paddingHorizontal: 16, borderWidth: 1.5, borderColor: errFor("topic") ? C.red : C.lineStrong, borderRadius: 14, backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}
        >
          <T s={15} numberOfLines={1} style={{ flex: 1 }}>
            {topicLabel}
          </T>
          <Icon xml={ICON.chevronDown} size={16} sw={2.2} />
        </Tap>
        {errFor("topic") ? (
          <T s={13} w={500} c={C.red}>
            {errFor("topic")}
          </T>
        ) : null}
      </View>

      <View style={{ gap: 16 }}>
        <Field label="Your name" r={14} boxStyle={{ paddingHorizontal: 16 }} placeholder="First and last name" autoComplete="name" autoCapitalize="words" returnKeyType="next" value={form.name} onChangeText={change("name")} error={errFor("name")} />
        <Field
          label="Phone or email"
          r={14}
          boxStyle={{ paddingHorizontal: 16 }}
          placeholder="09XX XXX XXX or you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          value={form.contact}
          onChangeText={change("contact")}
          error={errFor("contact")}
        />
      </View>
      <Field
        label="Message"
        multiline
        h={140}
        r={14}
        boxStyle={{ paddingHorizontal: 16 }}
        style={{ lineHeight: 22.5, paddingVertical: 14 }}
        placeholder="Tell us what's going on. An order number helps if it's about an order."
        value={form.message}
        onChangeText={change("message")}
        error={errFor("message")}
      />
      <Btn title={busy ? "Sending…" : "Send message"} onPress={submit} busy={busy} h={54} s={16} full icon={ICON.arrowRight} />
      {general ? (
        <T s={13} w={600} c={C.red} center style={{ marginTop: -6 }} accessibilityLiveRegion="polite">
          {general}
        </T>
      ) : null}

      <Sheet open={picking} onClose={() => setPicking(false)} title="Topic">
        <View style={{ gap: 4 }}>
          {TOPICS.map((t) => {
            const on = t.id === form.topic;
            return (
              <Tap
                key={t.id}
                hitSlop={0}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  change("topic")(t.id);
                  setPicking(false);
                }}
                style={{ minHeight: 52, paddingHorizontal: 14, borderRadius: 14, backgroundColor: on ? C.sky : C.white, flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Radio checked={on} />
                <T s={15} w={on ? 600 : 400} style={{ flex: 1 }}>
                  {t.label}
                </T>
              </Tap>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}

// ── "Or reach us directly" ────────────────────────────────────────────────────

function StoreCard() {
  const store = storeVals(useShop());
  const rows = [
    { label: "Call us", value: store.phone, href: telHref(store.phone), icon: ICON.call },
    { label: "WhatsApp", value: store.whatsapp, href: waHref(store.whatsapp), icon: ICON.whatsapp },
    { label: "Email", value: store.email, href: "mailto:" + store.email, icon: ICON.mail },
    { label: "Visit the store", value: store.address, href: "", icon: ICON.pin },
    { label: "Opening hours", value: store.hours, href: "", icon: ICON.clock },
  ].filter((r) => r.value);
  return (
    <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 28, padding: 28, gap: 18, backgroundColor: "#F6F5F1" }}>
      <H s={22} lh={26} ls={-0.66} accessibilityRole="header">
        Or reach us directly
      </H>
      <View style={{ gap: 14 }}>
        {rows.map((r) => (
          <View key={r.label} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.sky, alignItems: "center", justifyContent: "center" }}>
              <Icon xml={r.icon} size={20} color={C.navy} sw={1.7} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T s={12} w={700} c={C.muted} ls={0.72} upper>
                {r.label}
              </T>
              {r.href ? (
                <Tap onPress={() => openUrl(r.href)} accessibilityRole="link" label={r.label + ": " + r.value} style={{ alignSelf: "flex-start" }}>
                  <T s={15} w={600} c={C.navy}>
                    {r.value}
                  </T>
                </Tap>
              ) : (
                <T s={15} w={600}>
                  {r.value}
                </T>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
