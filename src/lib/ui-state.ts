/*
 * Tiny store for interface state shared across screens: whether the "All categories" menu is open.
 * (The header on any screen opens it; the root layout renders it once.)
 */
import { useSyncExternalStore } from "react";

let menuOpen = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function openCategoryMenu() {
  menuOpen = true;
  emit();
}
export function closeCategoryMenu() {
  menuOpen = false;
  emit();
}
export function useCategoryMenuOpen() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => menuOpen,
    () => menuOpen,
  );
}
