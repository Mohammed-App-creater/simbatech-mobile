/*
 * "Page not found": what Expo Router shows for an unknown path, and what an information page
 * shows when its slug doesn't exist. (The website falls back to the framework's plain 404 here;
 * the app gets a page in the site's own style with the two ways back in.)
 */
import React from "react";
import { View } from "react-native";
import { C, GUTTER } from "@/theme";
import { Screen } from "@/components/Screen";
import { PageIntro } from "@/components/pages/PageIntro";
import { Btn, ICON, Serif } from "@/components/ui";

/** The message and the Home / Shop buttons, for use inside a <Screen>. */
export function NotFoundBody() {
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: 48, gap: 28 }}>
      <PageIntro
        eyebrow="Page not found"
        title={
          <>
            We can’t find <Serif c={C.green}>that page.</Serif>
          </>
        }
        summary="The link may be out of date, or the page may have moved. Everything else is right where you left it."
      />
      <View style={{ gap: 12 }}>
        <Btn title="Back to home" href="/" h={54} s={16} full icon={ICON.arrowRight} />
        <Btn title="Browse the shop" href="/shop" variant="outline" h={54} s={16} full />
      </View>
    </View>
  );
}

export default function NotFoundScreen() {
  return (
    <Screen>
      <NotFoundBody />
    </Screen>
  );
}
