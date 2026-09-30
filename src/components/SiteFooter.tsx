/*
 * The site footer in its phone layout: newsletter sign-up, social links, the link columns,
 * "Get in touch", the big wordmark with "back to top", and the legal / payments row.
 * `compact` is the slim version used under checkout-style flows.
 * (The website's App Store / Google Play badges are left out — this is the app.)
 */
import React, { useState } from "react";
import { Linking, TextInput, useWindowDimensions, View } from "react-native";
import { C, F, GUTTER } from "@/theme";
import { storeVals, subscribeNewsletter, useShop } from "@/lib/store";
import { H, Icon, ICON, SvgDoc, T, Tap } from "./ui";
import { Logo, PayBadges } from "./ProductArt";
import { useScreenScroll } from "./scroll-context";

const YEAR = 2026;

const SOCIAL = [
  {
    label: "Instagram",
    path: "M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.3-3.1a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z",
  },
  {
    label: "Facebook",
    path: "M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8h3.3z",
  },
  {
    label: "X",
    path: "M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z",
  },
  {
    label: "WhatsApp",
    path: "M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.42.25-.69.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35M12.05 21.78h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 7c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41Z",
  },
];

/* Ethiopian numbers as dialable links: "0911 000 000" → tel:+251911000000 / https://wa.me/251911000000 */
function intlDigits(phone: string) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "251" + d.slice(1);
  else if (/^[79]\d{8}$/.test(d)) d = "251" + d;
  return d;
}
export const telHref = (phone: string) => "tel:+" + intlDigits(phone);
export const waHref = (phone: string) => "https://wa.me/" + intlDigits(phone);
export const openUrl = (url: string) => Linking.openURL(url).catch(() => {});

const GLOW =
  '<svg viewBox="0 0 640 640"><defs><radialGradient id="sfg" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#1A62A8" stop-opacity="0.95"/><stop offset="0.68" stop-color="#1A62A8" stop-opacity="0"/><stop offset="1" stop-color="#1A62A8" stop-opacity="0"/></radialGradient></defs><rect width="640" height="640" fill="url(#sfg)"/></svg>';

function Legal() {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 22, rowGap: 8 }} accessibilityLabel="Legal">
      {(
        [
          ["Privacy policy", "/p/privacy"],
          ["Terms of use", "/p/terms"],
          ["Cookies", "/p/cookies"],
        ] as const
      ).map(([label, href]) => (
        <Tap key={href} href={href}>
          <T s={13} c="#A9C7E3" lh={19.5}>
            {label}
          </T>
        </Tap>
      ))}
    </View>
  );
}

function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ state: "idle" | "busy" | "done" | "error"; message: string }>({ state: "idle", message: "" });
  const submit = async () => {
    if (status.state === "busy") return;
    setStatus({ state: "busy", message: "" });
    try {
      await subscribeNewsletter(email.trim());
      setEmail("");
      setStatus({ state: "done", message: "You're subscribed. Watch your inbox for deals." });
    } catch (err: any) {
      setStatus({ state: "error", message: err.message });
    }
  };
  return (
    <View style={{ gap: 10 }}>
      <TextInput
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={submit}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        accessibilityLabel="Email address"
        placeholder="you@example.com"
        placeholderTextColor="#8FB3D4"
        style={[
          { height: 54, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, borderColor: "#2A6FA8", backgroundColor: C.navy, fontFamily: F.g400, fontSize: 15, color: C.white },
          { outlineWidth: 0 } as object,
        ]}
      />
      <Tap onPress={submit} disabled={status.state === "busy"} style={{ height: 54, borderRadius: 14, backgroundColor: C.green, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <T s={15} w={700} c={C.white}>
          {status.state === "busy" ? "Subscribing…" : "Subscribe"}
        </T>
        <Icon xml={ICON.arrowRight} size={16} color={C.white} />
      </Tap>
      {status.message ? (
        <T s={13} c={status.state === "error" ? "#FFB4A8" : C.mint} accessibilityLiveRegion="polite">
          {status.message}
        </T>
      ) : null}
    </View>
  );
}

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  const shop = useShop();
  const store = storeVals(shop);
  const { width } = useWindowDimensions();
  const { toTop } = useScreenScroll();
  const accountHref = (tab: string) => (shop.user ? "/account?tab=" + tab : "/signin?next=" + encodeURIComponent("/account?tab=" + tab));

  if (compact) {
    return (
      <View style={{ backgroundColor: C.navyDeep, paddingHorizontal: GUTTER, paddingVertical: 24, gap: 16 }}>
        <Tap href="/" label="Simbatech home" style={{ alignSelf: "flex-start" }}>
          <Logo height={30} white />
        </Tap>
        <T s={13} c="#A9C7E3">
          © {YEAR} Simbatech. All rights reserved.
        </T>
        <Legal />
        <PayBadges brands={["telebirr", "cbe", "visa", "mastercard"]} bordered={false} />
      </View>
    );
  }

  const columns: { title: string; links: [string, string][] }[] = [
    {
      title: "Shop",
      links: [
        ["All products", "/shop"],
        ["Rentals", "/shop?mode=rent"],
        ["Deals", "/shop?deals=1"],
        ["New arrivals", "/shop"],
        ["Rental bundles", "/shop?mode=rent"],
      ],
    },
    {
      title: "Customer care",
      links: [
        ["Delivery", "/p/delivery"],
        ["Returns", "/p/returns"],
        ["Rental terms", "/p/rental-terms"],
        ["Track order", "/track"],
        ["Help centre", "/p/help"],
      ],
    },
    {
      title: "My account",
      links: [
        ["My orders", accountHref("orders")],
        ["My rentals", accountHref("rentals")],
        ["Wishlist", accountHref("wishlist")],
        ["Wallet", accountHref("payment")],
        shop.user ? ["My account", "/account"] : ["Sign in", "/signin"],
      ],
    },
    {
      title: "Company",
      links: [
        ["About", "/p/about"],
        ["Careers", "/p/careers"],
        ["Sell with us", "/p/sell-with-us"],
        ["Contact", "/p/contact"],
      ],
    },
  ];
  const colWidth = (width - GUTTER * 2 - 20) / 2;
  const wordmarkWidth = width - GUTTER * 2 - 48 - 14;

  return (
    <View style={{ marginTop: 56, backgroundColor: C.navyDeep, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: GUTTER, paddingTop: 48, paddingBottom: 24, overflow: "hidden" }}>
      <SvgDoc xml={GLOW} width={640} height={640} style={{ position: "absolute", top: -260, left: (width - 640) / 2 }} />

      {/* newsletter */}
      <View>
        <T s={12} w={700} c={C.mint} ls={1.2} upper style={{ marginBottom: 14 }}>
          Newsletter
        </T>
        <H s={26} c={C.white} lh={27.3} style={{ marginBottom: 8 }}>
          Get deals before everyone else
        </H>
        <T s={15} c="#A9C7E3" lh={22.5} style={{ marginBottom: 20 }}>
          New arrivals, rentals and members-only offers. No spam, unsubscribe any time.
        </T>
        <Newsletter />
        <View style={{ marginTop: 28, flexDirection: "row", gap: 10 }}>
          {SOCIAL.map((s) => (
            <Tap
              key={s.label}
              label={"Simbatech on " + s.label}
              onPress={s.label === "WhatsApp" && store.whatsapp ? () => openUrl(waHref(store.whatsapp)) : undefined}
              style={{ width: 46, height: 46, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}
            >
              <Icon d={s.path} size={20} color={C.white} filled />
            </Tap>
          ))}
        </View>
      </View>

      {/* link columns */}
      <View style={{ marginTop: 48, flexDirection: "row", flexWrap: "wrap", columnGap: 20, rowGap: 28 }}>
        {columns.map((col) => (
          <View key={col.title} style={{ width: colWidth, gap: 12 }} accessibilityLabel={col.title}>
            <T s={13} w={700} c={C.mint} ls={1.3} upper lh={19.5} style={{ marginBottom: 18 }}>
              {col.title}
            </T>
            {col.links.map(([label, href]) => (
              <Tap key={label} href={href} style={{ alignSelf: "flex-start" }}>
                <T s={15} c="#E6F0F9" lh={22.5}>
                  {label}
                </T>
              </Tap>
            ))}
          </View>
        ))}
        <View style={{ width: colWidth, gap: 12 }}>
          <T s={13} w={700} c={C.mint} ls={1.3} upper lh={19.5} style={{ marginBottom: 18 }}>
            Get in touch
          </T>
          <T s={15} c="#E6F0F9" lh={22.5}>
            {store.address}
          </T>
          <Tap onPress={() => openUrl(telHref(store.phone))} style={{ alignSelf: "flex-start" }}>
            <T s={15} c="#E6F0F9" lh={22.5}>
              {store.phone}
            </T>
          </Tap>
          {store.whatsapp ? (
            <Tap onPress={() => openUrl(waHref(store.whatsapp))} style={{ alignSelf: "flex-start" }}>
              <T s={15} c="#E6F0F9" lh={22.5}>
                WhatsApp {store.whatsapp}
              </T>
            </Tap>
          ) : null}
          <Tap onPress={() => openUrl("mailto:" + store.email)} style={{ alignSelf: "flex-start" }}>
            <T s={15} c="#E6F0F9" lh={22.5}>
              {store.email}
            </T>
          </Tap>
          <T s={13} c="#A9C7E3" lh={19.5}>
            {store.hours}
          </T>
        </View>
      </View>

      {/* wordmark + back to top */}
      <View style={{ marginTop: 36, flexDirection: "row", alignItems: "flex-end", gap: 14 }}>
        <View style={{ width: wordmarkWidth }} accessibilityLabel="Simbatech">
          <H s={wordmarkWidth / 5.72} w={800} c={C.white} ls={-1.5} lh={(wordmarkWidth / 5.72) * 0.96} numberOfLines={1} adjustsFontSizeToFit>
            SIMBA<H w={800} s={wordmarkWidth / 5.72} c={C.mint} ls={-1.5}>TECH</H>
          </H>
        </View>
        <Tap
          onPress={toTop}
          label="Back to top"
          style={{ width: 48, height: 48, marginBottom: 8, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}
        >
          <Icon xml={ICON.arrowUp} size={22} color={C.white} />
        </Tap>
      </View>

      {/* legal + payments */}
      <View style={{ marginTop: 36, paddingTop: 24, borderTopWidth: 1, borderTopColor: "#1C5C94", gap: 16, alignItems: "flex-start" }}>
        <T s={13} c="#A9C7E3" lh={19.5}>
          © {YEAR} Simbatech. All rights reserved.
        </T>
        <Legal />
        <View style={{ height: 32, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: "#1C5C94", justifyContent: "center" }}>
          <T s={13} w={600} c="#E6F0F9">
            Ethiopia · English · ETB
          </T>
        </View>
        <PayBadges brands={["telebirr", "cbe", "visa", "mastercard"]} bordered={false} />
      </View>
    </View>
  );
}
