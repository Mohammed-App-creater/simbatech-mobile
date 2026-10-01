/*
 * The sub-city the visitor picked in the header's "Deliver to" panel. It is remembered on this
 * device, shown on the button and prefilled as the area of a new address at checkout.
 * (Same idea as simbatech-web/src/components/DeliverTo.jsx, which keeps it in localStorage.)
 */
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const SUB_CITIES = ["Addis Ketema", "Akaky Kaliti", "Arada", "Bole", "Gulele", "Kirkos", "Kolfe Keranio", "Lemi Kura", "Lideta", "Nifas Silk-Lafto", "Yeka"];

const AREA_KEY = "simbatech.deliverArea";

let area = "";
const listeners = new Set<() => void>();

/** Loads the saved area at start-up (called once by the root layout). */
export function loadDeliverArea() {
  AsyncStorage.getItem(AREA_KEY)
    .then((value) => {
      if (value && value !== area) {
        area = value;
        listeners.forEach((fn) => fn());
      }
    })
    .catch(() => {});
}

/** The sub-city the visitor picked ("" if none). */
export function readDeliverArea() {
  return area;
}

export function saveDeliverArea(next: string) {
  area = next;
  listeners.forEach((fn) => fn());
  AsyncStorage.setItem(AREA_KEY, next).catch(() => {});
}

export function useDeliverArea() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    readDeliverArea,
    readDeliverArea,
  );
}
