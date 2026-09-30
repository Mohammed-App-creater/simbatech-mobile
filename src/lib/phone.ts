/*
 * Ethiopian mobile numbers. Customers always type the 9 digits after +251, which start with 7 or 9
 * (e.g. 911 234 567). A leading 0 (09…, 07…) or a pasted +251 is trimmed. Screens keep the number
 * in the local form "0911234567" (what the API and saved accounts use), so an empty field stays "".
 * (Same rules as simbatech-web/src/lib/phone.js.)
 */

/** The up-to-9 local digits of whatever was typed or pasted: "0911 234 567" / "+251911234567" → "911234567". */
export function localDigits(raw: unknown): string {
  let d = String(raw == null ? "" : raw).replace(/\D/g, "");
  if (d.startsWith("251") && d.length > 9) d = d.slice(3); // pasted +251…
  d = d.replace(/^0+/, ""); // 09… / 07… → 9… / 7…
  d = d.replace(/^[^79]+/, ""); // only mobile numbers: the first digit must be 7 or 9
  return d.slice(0, 9);
}

/** Local storage form: "911234567" → "0911234567" ("" stays ""). */
export function toLocal(raw: unknown): string {
  const d = localDigits(raw);
  return d ? "0" + d : "";
}

/** A complete, valid mobile number (9 digits starting with 7 or 9)? */
export function isCompletePhone(raw: unknown): boolean {
  return /^[79]\d{8}$/.test(localDigits(raw));
}

/** "+251 911 234 567" for display. */
export function formatPhone(raw: unknown): string {
  const d = localDigits(raw);
  if (!d) return "";
  return "+251 " + [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(" ");
}

/** "911 234 567" — the digits as shown inside a phone field, after the +251 chip. */
export function groupDigits(raw: unknown): string {
  const d = localDigits(raw);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(" ");
}
