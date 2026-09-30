/*
 * The frame every screen sits in: the navy status-bar strip, a scrolling page with the site
 * header on top and the site footer at the bottom, and room for the bottom tab bar.
 */
import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type ScrollViewProps, type StyleProp, type ViewStyle } from "react-native";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, TAB_BAR_HEIGHT } from "@/theme";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { ScrollCtx, useScreenScroll } from "./scroll-context";

export { useScreenScroll };

/** Flows with their own call to action at the bottom hide the tab bar (same list as the site). */
export const TAB_BAR_HIDDEN_ON = ["/checkout", "/signin", "/pay"];
export const tabBarHidden = (pathname: string) => TAB_BAR_HIDDEN_ON.some((p) => pathname.startsWith(p));

export type ScreenProps = {
  children?: React.ReactNode;
  /** show the site header (utility bar, logo, search, departments). Default true. */
  header?: boolean;
  /** department to highlight in the header's department row */
  activeDept?: string;
  /** what the header's search box starts with */
  searchQuery?: string;
  searchMode?: "buy" | "rent";
  /** show the site footer. Default true. */
  footer?: boolean;
  /** page background */
  bg?: string;
  /** colour behind the status bar (the header's utility bar is navy) */
  topColor?: string;
  /** pull-to-refresh handler; return a promise that settles when the data is back */
  onRefresh?: () => Promise<unknown> | void;
  /** fixed element under the scrolling page (e.g. a sticky "Place order" bar) */
  bottomBar?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: ScrollViewProps;
};

export function Screen({ children, header = true, activeDept, searchQuery, searchMode, footer = true, bg = C.white, topColor = C.navy, onRefresh, bottomBar, contentStyle, scrollProps }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const ref = useRef<ScrollView>(null);
  const [refreshing, setRefreshing] = useState(false);
  const bottomSpace = tabBarHidden(pathname) ? insets.bottom : TAB_BAR_HEIGHT + insets.bottom;
  const scroll = {
    toTop: () => ref.current?.scrollTo({ y: 0, animated: true }),
    scrollTo: (y: number) => ref.current?.scrollTo({ y, animated: true }),
  };

  return (
    <ScrollCtx.Provider value={scroll}>
      <View style={{ flex: 1, backgroundColor: bg }}>
        <View style={{ height: insets.top, backgroundColor: topColor }} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            ref={ref}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[{ paddingBottom: bottomBar ? 0 : bottomSpace, flexGrow: 1 }, contentStyle]}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  tintColor={C.navy}
                  colors={[C.navy]}
                  onRefresh={() => {
                    setRefreshing(true);
                    Promise.resolve(onRefresh()).finally(() => setRefreshing(false));
                  }}
                />
              ) : undefined
            }
            {...scrollProps}
          >
            {header ? <SiteHeader activeDept={activeDept} searchQuery={searchQuery} searchMode={searchMode} /> : null}
            {children}
            {footer ? <SiteFooter /> : null}
          </ScrollView>
          {bottomBar ? <View style={{ paddingBottom: bottomSpace }}>{bottomBar}</View> : null}
        </KeyboardAvoidingView>
      </View>
    </ScrollCtx.Provider>
  );
}
