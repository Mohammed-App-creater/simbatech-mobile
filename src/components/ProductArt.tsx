/*
 * The design's product illustrations (camera, headphones, sofa, …), drawn on a 200 × 200 canvas.
 * `size` scales the whole drawing; products name their illustration in `product.kind`.
 */
import React from "react";
import { Image, View, type StyleProp, type ViewStyle } from "react-native";
import { ART, ART_DEFS } from "./art";
import { SvgDoc } from "./ui";

const docs = new Map<string, string>();
function artDoc(kind: string) {
  const key = ART[kind] ? kind : "camera";
  let doc = docs.get(key);
  if (!doc) {
    doc = '<svg viewBox="0 0 200 200" fill="none">' + ART_DEFS + ART[key] + "</svg>";
    docs.set(key, doc);
  }
  return doc;
}

export function ProductArt({ kind, size = 200, style }: { kind: string; size?: number; style?: StyleProp<ViewStyle> }) {
  return <SvgDoc xml={artDoc(kind)} width={size} height={size} style={style} />;
}

// ── Brand and payment logos ──

const LOGO = require("@/assets/images/logo.png");
const LOGO_WHITE = require("@/assets/images/logo-white.png");
const LOGO_RATIO = 440 / 159;

/** The Simbatech logo at a given height (the artwork is 440 × 159). */
export function Logo({ height = 36, white = false }: { height?: number; white?: boolean }) {
  return <Image source={white ? LOGO_WHITE : LOGO} style={{ height, width: Math.round(height * LOGO_RATIO) }} resizeMode="contain" accessibilityLabel="Simbatech" />;
}

const VISA =
  '<svg viewBox="0 8.1 24 7.8"><path fill="#1A1F71" d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.020-3.278 2.479-.012 1.079.963 1.680 1.698 2.040.756.367 1.010.603 1.006.931-.005.504-.602.725-1.160.734-.975.015-1.540-.263-1.992-.473l-.351 1.642c.453.208 1.289.390 2.156.398 2.037 0 3.370-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.550l-2.909 6.946h2.036l.405-1.120h2.488zm-2.163-2.656l1.020-2.815.588 2.815zm-8.160-4.840l-1.603 7.496H8.340l1.605-7.496z"/></svg>';
const MASTERCARD =
  '<svg viewBox="0 0 100 61.8"><circle cx="30.9" cy="30.9" r="30.9" fill="#EB001B"/><circle cx="69.1" cy="30.9" r="30.9" fill="#F79E1B"/><path fill="#FF5F00" d="M50 6.6a30.9 30.9 0 0 1 0 48.6a30.9 30.9 0 0 1 0-48.6z"/></svg>';

const TELEBIRR = require("@/assets/images/pay/telebirr.png");
const CBE = require("@/assets/images/pay/cbe-birr.png");

export type PayBrand = "telebirr" | "cbe" | "visa" | "mastercard";
export const hasPayLogo = (brand?: string | null) => ["telebirr", "cbe", "visa", "mastercard"].includes(String(brand || "").toLowerCase());

/** A payment brand's logo; heights are tuned per logo so they read the same size (as on the site). */
export function PayLogo({ brand, scale = 1 }: { brand: string; scale?: number }) {
  const b = String(brand || "").toLowerCase();
  if (b === "telebirr") return <Image source={TELEBIRR} style={{ height: 24 * scale, width: (24 * scale * 271) / 106 }} resizeMode="contain" accessibilityLabel="telebirr" />;
  if (b === "cbe") return <Image source={CBE} style={{ height: 24 * scale, width: (24 * scale * 220) / 213 }} resizeMode="contain" accessibilityLabel="CBE Birr" />;
  if (b === "visa") return <SvgDoc xml={VISA} width={(12 * scale * 24) / 7.8} height={12 * scale} />;
  if (b === "mastercard") return <SvgDoc xml={MASTERCARD} width={(18 * scale * 100) / 61.8} height={18 * scale} />;
  return null;
}

/** The "We accept" row of white badges. */
export function PayBadges({ brands = ["telebirr", "visa", "mastercard"], bordered = true, style }: { brands?: PayBrand[]; bordered?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", gap: 8, flexWrap: "wrap" }, style]} accessibilityLabel="Accepted payment methods">
      {brands.map((b) => (
        <View
          key={b}
          style={[{ height: 30, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, bordered && { borderWidth: 1, borderColor: "#EFEDE8" }]}
        >
          <PayLogo brand={b} />
        </View>
      ))}
    </View>
  );
}
