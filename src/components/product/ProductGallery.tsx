/*
 * The product page's gallery: the artwork on a tinted tile with the Buy / Rent tag, share and
 * wishlist buttons, a pager ("Front · 01 / 04") and four thumbnails.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, Share, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { C } from "@/theme";
import { SITE_URL } from "@/lib/api";
import { useShop, wishlist } from "@/lib/store";
import type { ProductDTO } from "@/lib/types";
import { ProductArt } from "@/components/ProductArt";
import { Icon, ICON, Note, T, Tap } from "@/components/ui";
import { errMsg } from "./shared";

// The product's own colour leads; the other angles keep the design's tints.
const SHOTS = [
  { label: "Front", bg: "#E0F1FF", rot: 0 },
  { label: "Angled left", bg: "#EEE8FF", rot: -14 },
  { label: "Angled right", bg: "#DDF5EA", rot: 12 },
  { label: "Close-up", bg: "#FFEADB", rot: -5 },
];

const round = { width: 44, height: 44, borderRadius: 999, backgroundColor: C.white, alignItems: "center", justifyContent: "center" } as const;
const lifted = { boxShadow: "0 4px 12px rgba(0,0,0,0.08)" } as const;

export function ProductGallery({ product: p }: { product: ProductDTO }) {
  const shop = useShop();
  const [index, setIndex] = useState(0);
  const [shared, setShared] = useState(false);
  const [wishErr, setWishErr] = useState("");
  const sharedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rot] = useState(() => new Animated.Value(0));
  const shots = SHOTS.map((s, i) => (i === 0 ? { ...s, bg: p.bg || s.bg } : s));
  const shot = shots[index];
  const saved = wishlist.has(shop, p.id);
  const badge = p.rentOnly ? "For rent" : p.rent ? "Buy or rent" : "Buy";

  useEffect(
    () => () => {
      if (sharedTimer.current) clearTimeout(sharedTimer.current);
    },
    [],
  );

  const go = (i: number) => {
    const next = (i + shots.length) % shots.length;
    setIndex(next);
    Animated.timing(rot, { toValue: shots[next].rot, duration: 350, useNativeDriver: Platform.OS !== "web" }).start();
  };

  // Opens the phone's share sheet; where there is none (browser preview) the link is copied instead.
  const share = async () => {
    const url = SITE_URL + "/product/" + p.id;
    try {
      await Share.share(Platform.OS === "ios" ? { url, message: p.name } : { message: p.name + " " + url, title: p.name });
    } catch (e) {
      if (e && (e as { name?: string }).name === "AbortError") return;
      await Clipboard.setStringAsync(url).catch(() => {});
      if (sharedTimer.current) clearTimeout(sharedTimer.current);
      setShared(true);
      sharedTimer.current = setTimeout(() => setShared(false), 2200);
    }
  };

  const toggleWish = () => {
    setWishErr("");
    wishlist.toggle(p.id).catch((e) => setWishErr(errMsg(e)));
  };

  return (
    <>
      <View accessibilityLabel="Product images" style={{ height: 340, borderRadius: 24, overflow: "hidden", backgroundColor: shot.bg, alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={{ transform: [{ rotate: rot.interpolate({ inputRange: [-20, 20], outputRange: ["-20deg", "20deg"] }) }] }}>
          <ProductArt kind={p.kind} size={240} />
        </Animated.View>

        <View style={{ position: "absolute", top: 20, left: 20, height: 32, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.green, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon xml={ICON.calendar} size={14} color={C.white} />
          <T s={13} w={700} c={C.white}>
            {badge}
          </T>
        </View>

        <View style={{ position: "absolute", top: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
          {shared ? (
            <View accessibilityLiveRegion="polite" style={{ height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.ink, justifyContent: "center" }}>
              <T s={12} w={600} c={C.white}>
                Link copied
              </T>
            </View>
          ) : null}
          <Tap onPress={share} label="Share this product" style={[round, lifted]}>
            <Icon xml={ICON.share} size={18} sw={1.8} />
          </Tap>
          <Tap onPress={toggleWish} label={saved ? "Remove " + p.name + " from wishlist" : "Save " + p.name + " to wishlist"} accessibilityState={{ selected: saved }} style={[round, lifted]}>
            <Icon xml={ICON.heart} size={18} sw={1.8} color={saved ? C.coral : C.ink} fill={saved ? C.coral : "none"} />
          </Tap>
        </View>

        <View style={{ position: "absolute", left: 24, right: 20, bottom: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.8)", justifyContent: "center" }}>
            <T s={13} w={600} style={{ fontVariant: ["tabular-nums"] }}>
              {shot.label + " · 0" + (index + 1) + " / 0" + shots.length}
            </T>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Tap onPress={() => go(index - 1)} label="Previous image" style={round}>
              <Icon xml={ICON.arrowLeft} size={16} />
            </Tap>
            <Tap onPress={() => go(index + 1)} label="Next image" style={[round, { backgroundColor: C.ink }]}>
              <Icon xml={ICON.arrowRight} size={16} color={C.white} />
            </Tap>
          </View>
        </View>
      </View>

      <View accessibilityLabel="Choose an image" style={{ flexDirection: "row", gap: 8, marginTop: -4 }}>
        {shots.map((s, i) => (
          <Tap
            key={s.label}
            onPress={() => go(i)}
            hitSlop={0}
            label={"Show " + s.label + " view"}
            accessibilityState={{ selected: i === index }}
            style={{ flex: 1, height: 72, borderRadius: 14, borderWidth: 2, borderColor: i === index ? C.navy : "transparent", backgroundColor: s.bg, overflow: "hidden", alignItems: "center", justifyContent: "center" }}
          >
            <ProductArt kind={p.kind} size={60} style={{ transform: [{ rotate: s.rot + "deg" }] }} />
          </Tap>
        ))}
      </View>
      <Note>{wishErr}</Note>
    </>
  );
}
