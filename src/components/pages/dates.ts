/*
 * Dates on the information and tracking pages, always in Addis Ababa time (UTC+3, no daylight
 * saving) so the app shows the same text as the website whatever the phone's time zone is.
 */

const OFFSET_MS = 3 * 3600 * 1000;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// en-GB short months, as the website prints them ("30 Sept 2026")
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

/** The moment shifted to Addis time; read it with the getUTC* methods. */
function addis(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  // the API sends microseconds; keep milliseconds so every JS engine parses it
  const t = Date.parse(String(iso).replace(/(\.\d{3})\d+/, "$1"));
  return Number.isNaN(t) ? null : new Date(t + OFFSET_MS);
}

/** "6 Oct 2026" */
export function fmtShortDate(iso: string | null | undefined): string {
  const d = addis(iso);
  return d ? d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear() : "";
}

/** "Tue 6 Oct" */
export function fmtDay(iso: string | null | undefined): string {
  const d = addis(iso);
  return d ? DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] : "";
}

/** "Tue 6 Oct 2026" */
export function fmtDate(iso: string | null | undefined): string {
  const d = addis(iso);
  return d ? fmtDay(iso) + " " + d.getUTCFullYear() : "";
}

/** "10:42am" */
export function fmtTime(iso: string | null | undefined): string {
  const d = addis(iso);
  if (!d) return "";
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return (h % 12 || 12) + ":" + (m < 10 ? "0" : "") + m + (h < 12 ? "am" : "pm");
}

/** "Tue 6 Oct, 10:42am" */
export const fmtStamp = (iso: string | null | undefined) => fmtDay(iso) + ", " + fmtTime(iso);
