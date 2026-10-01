/*
 * App-style bottom navigation (the site's MobileTabBar): Home, Shop, Cart, Account.
 * Rendered once by the root layout, above every screen except the flows listed in TAB_BAR_HIDDEN_ON.
 */
import React, { useEffect, useState } from "react";
import { Keyboard, Platform, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/theme";
import { useShop } from "@/lib/store";
import { Icon, ICON, T, Tap } from "./ui";
import { tabBarHidden } from "./Screen";

const TABS = [
  { href: "/", label: "Home", icon: ICON.home },
  { href: "/shop", label: "Shop", icon: ICON.squares },
  { href: "/cart", label: "Cart", icon: ICON.cart },
  { href: "/account", label: "Account", icon: ICON.userTab },
];

const isActive = (href: string, pathname: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/shop" && pathname.startsWith("/product")));

/** Go to a tab: back to it if it is already open underneath, otherwise open it in place of the current detail screen. */
function goTab(href: string, pathname: string) {
  if (pathname === href) return;
  if (href === "/") {
    if (router.canDismiss()) router.dismissAll();
    else router.replace("/" as never);
    return;
  }
  if (router.canGoBack()) router.dismissTo(href as never);
  else router.push(href as never);
}

export function TabBar() {
  const pathname = usePathname() || "/";
  const insets = useSafeAreaInsets();
  const shop = useShop();
  const count = shop.cart?.count ?? 0;
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (tabBarHidden(pathname) || keyboard) return null;

  return (
    <View
      accessibilityRole="tablist"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: "row",
        paddingHorizontal: 8,
        paddingTop: 6,
        paddingBottom: 6 + insets.bottom,
        backgroundColor: C.white,
        borderTopWidth: 1,
        borderTopColor: C.line,
        boxShadow: "0 -8px 24px -16px rgba(10,20,35,0.35)",
      }}
    >
      {TABS.map((t) => {
        const active = isActive(t.href, pathname);
        const color = active ? C.navy : C.muted;
        return (
          <Tap
            key={t.href}
            onPress={() => goTab(t.href, pathname)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            label={t.label}
            hitSlop={0}
            pressedStyle={{ backgroundColor: C.sand }}
            style={{ flex: 1, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 3 }}
          >
            <View>
              <Icon xml={t.icon} size={22} color={color} sw={active ? 2.2 : 1.8} />
              {t.href === "/cart" && count > 0 ? (
                <View style={{ position: "absolute", top: -6, right: -10, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 999, backgroundColor: C.green, alignItems: "center", justifyContent: "center" }}>
                  <T s={10} w={700} c={C.white} lh={13}>
                    {count}
                  </T>
                </View>
              ) : null}
            </View>
            <T s={11} w={600} c={color} lh={14}>
              {t.label}
            </T>
            {active ? <View style={{ width: 18, height: 3, marginTop: 1, borderRadius: 999, backgroundColor: C.green }} /> : null}
          </Tap>
        );
      })}
    </View>
  );
}
