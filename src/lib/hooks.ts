/*
 * Small helpers shared by screens.
 */
import { useEffect, useRef, useState } from "react";

/**
 * Runs a store action for one control: `busy` while pending, `done` for ~1.5s afterwards (or until
 * the next run when `keepDone` is set), and `err` holds the API's message if it failed.
 * (Same behaviour as `runAction` in the website's screens.)
 */
export function useAction() {
  const [state, setState] = useState<{ busy: boolean; done: boolean; err: string }>({ busy: false, done: false, err: "" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const run = (fn: () => Promise<unknown> | unknown, keepDone = false) => {
    if (state.busy) return;
    if (timer.current) clearTimeout(timer.current);
    setState({ busy: true, done: false, err: "" });
    Promise.resolve()
      .then(fn)
      .then(
        () => {
          if (!live.current) return;
          setState({ busy: false, done: true, err: "" });
          if (!keepDone) timer.current = setTimeout(() => live.current && setState((s) => ({ ...s, done: false })), 1500);
        },
        (e) => {
          if (!live.current) return;
          setState({ busy: false, done: false, err: (e && e.message) || "Something went wrong. Please try again." });
        },
      );
  };
  const clear = () => setState({ busy: false, done: false, err: "" });
  return { ...state, run, clear };
}

const pad = (n: number) => (n < 10 ? "0" : "") + n;

/** yyyy-mm-dd for a local Date. */
export function isoDate(d: Date) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

/** Tomorrow as yyyy-mm-dd (the default start for a quick "Rent" from a product card). */
export function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return isoDate(d);
}

/** A value that ticks every second (countdowns). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
