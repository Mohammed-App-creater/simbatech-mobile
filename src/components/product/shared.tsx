/*
 * Small pieces shared by the product page's sections: copy helpers, the star row and the
 * "recently viewed" list the shop page reads.
 */
import React from "react";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C } from "@/theme";
import type { ReviewsDTO } from "@/lib/types";
import { Icon, ICON } from "@/components/ui";

/** Card background used by the summary box, review cards and the "rent the set" panel. */
export const SOFT = "#F6F5F1";
export const STAR_OFF = "#E6E4DE";

export const ICON_PENCIL = '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>';
export const ICON_CHAT = '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>';

/** The API also sends the id and moderation status of the customer's own review. */
export type MyReview = NonNullable<ReviewsDTO["mine"]> & { id?: number; status?: string };

const DUR_LABELS: Record<number, string> = { 1: "1 day", 3: "3 days", 7: "1 week", 14: "2 weeks" };
export const durLabel = (days: number) => DUR_LABELS[days] || days + (days === 1 ? " day" : " days");
export const plural = (n: number, word: string) => n + " " + (n === 1 ? word : word + "s");
export function errMsg(e: unknown): string {
  const message = e && typeof e === "object" ? (e as { message?: unknown }).message : null;
  return typeof message === "string" && message ? message : "Something went wrong. Please try again.";
}

/** Five stars, filled up to the rating rounded to the nearest star. */
export function Stars({ value, size = 16, gap = 2 }: { value: string | number; size?: number; gap?: number }) {
  const filled = Math.round(parseFloat(String(value)) || 0);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap }} accessibilityLabel={"Rated " + value + " out of 5"}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} xml={ICON.star} size={size} color={n <= filled ? C.star : STAR_OFF} filled />
      ))}
    </View>
  );
}

// Recently viewed products: most recent first, no duplicates, at most 8 (same list and key as the site).
const RECENT_KEY = "st_recent";

export async function readRecentlyViewed(): Promise<string[]> {
  try {
    const value = JSON.parse((await AsyncStorage.getItem(RECENT_KEY)) || "[]");
    return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export async function rememberViewed(productId: string) {
  const prev = await readRecentlyViewed();
  const next = [productId, ...prev.filter((id) => id !== productId)].slice(0, 8);
  AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
}
