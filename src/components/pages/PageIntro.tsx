/*
 * The heading block at the top of the information pages, Track order and "page not found":
 * a small uppercase eyebrow, the page title and a one-line summary.
 */
import React from "react";
import { useWindowDimensions, View } from "react-native";
import { C } from "@/theme";
import { H, T } from "@/components/ui";

/** The site's page-title size on phones: clamp(28px, 7.5vw, 44px). */
export function usePageTitleSize() {
  const { width } = useWindowDimensions();
  return Math.min(44, Math.max(28, width * 0.075));
}

export function PageEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <T s={13} w={700} c={C.navy} ls={1.3} upper>
      {children}
    </T>
  );
}

export function PageIntro({ eyebrow, title, summary }: { eyebrow: string; title: React.ReactNode; summary?: string }) {
  const size = usePageTitleSize();
  return (
    <View style={{ gap: 8 }}>
      <PageEyebrow>{eyebrow}</PageEyebrow>
      <H s={size} lh={size * 1.04} ls={-0.04 * size} accessibilityRole="header">
        {title}
      </H>
      {summary ? (
        <T s={17} c={C.muted} lh={25.5}>
          {summary}
        </T>
      ) : null}
    </View>
  );
}
