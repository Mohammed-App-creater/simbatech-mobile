/*
 * Root of the app: loads the brand fonts, fetches the visitor's session (user, cart, wishlist,
 * store details), and hosts the navigation stack with the bottom tab bar and the categories menu.
 *
 * Routes mirror the website's paths (/shop, /product/<slug>, /cart, /checkout, /account, /p/<slug>, …),
 * so links written for the site work here unchanged.
 */
import React, { useEffect } from "react";
import { View } from "react-native";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, Geist_800ExtraBold } from "@expo-google-fonts/geist";
import { BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif";
import { C } from "@/theme";
import { bootstrap, setCurrentPath, useShop } from "@/lib/store";
import { TabBar } from "@/components/TabBar";
import { CategoryMenu } from "@/components/CategoryMenu";
import { T, Tap } from "@/components/ui";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });
  const pathname = usePathname();

  useEffect(() => {
    bootstrap();
  }, []);
  useEffect(() => {
    setCurrentPath(pathname);
  }, [pathname]);
  // The API can take a while to wake up, so only the fonts hold the splash screen; screens show their own loading state.
  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: C.white }}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.white } }}>
          {/* the four tabs switch instantly; everything else slides in over them */}
          <Stack.Screen name="index" options={{ animation: "none" }} />
          <Stack.Screen name="shop" options={{ animation: "none" }} />
          <Stack.Screen name="cart" options={{ animation: "none" }} />
          <Stack.Screen name="account" options={{ animation: "none" }} />
        </Stack>
        <OfflineNotice />
        <TabBar />
        <CategoryMenu />
      </View>
    </SafeAreaProvider>
  );
}

/** Shown when the first request to the API failed (no connection, or the server is unreachable). */
function OfflineNotice() {
  const shop = useShop();
  const insets = useSafeAreaInsets();
  if (!shop.bootError) return null;
  return (
    <View style={{ position: "absolute", left: 12, right: 12, top: insets.top + 8, padding: 14, borderRadius: 14, backgroundColor: C.ink, flexDirection: "row", alignItems: "center", gap: 12, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.4)" }}>
      <T s={13} c={C.white} lh={18} style={{ flex: 1 }}>
        {shop.bootError}
      </T>
      <Tap onPress={() => bootstrap()} style={{ height: 34, paddingHorizontal: 14, borderRadius: 10, backgroundColor: C.white, justifyContent: "center" }}>
        <T s={13} w={700} c={C.ink}>
          Retry
        </T>
      </Tap>
    </View>
  );
}
