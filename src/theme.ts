/*
 * Design tokens taken from the website (simbatech-web): the same colours, fonts and radii, so the
 * app and the site read as one product.
 */

export const C = {
  // brand
  navy: "#0D4F8B",
  navyDeep: "#0A3B66",
  navySoft: "#1A62A8",
  blue: "#1679BE",
  green: "#2F7A3C",
  greenDark: "#1F5E33",
  mint: "#8FD19A",
  // text
  ink: "#111318",
  text: "#3A3F4A",
  muted: "#5E6470",
  faint: "#8A8F99",
  // surfaces
  white: "#FFFFFF",
  sand: "#F3F2EE",
  paper: "#F5F4EF",
  sky: "#EAF3FA",
  skyDeep: "#E0F1FF",
  greenBg: "#E4F2E6",
  lilac: "#EEE8FF",
  butter: "#FFF4C7",
  peach: "#FFEADB",
  rose: "#FFE4EF",
  // lines
  line: "#EFEDE8",
  lineStrong: "#E6E4DE",
  // accents
  red: "#C42A1C",
  amber: "#F0AE00",
  star: "#F0AE00",
  purple: "#5B3FD0",
  coral: "#E0522B",
} as const;

/** Font family names as loaded in src/app/_layout.tsx. Pick the family for the weight; never combine with `fontWeight`. */
export const F = {
  g400: "Geist_400Regular",
  g500: "Geist_500Medium",
  g600: "Geist_600SemiBold",
  g700: "Geist_700Bold",
  g800: "Geist_800ExtraBold",
  b500: "BricolageGrotesque_500Medium",
  b600: "BricolageGrotesque_600SemiBold",
  b700: "BricolageGrotesque_700Bold",
  b800: "BricolageGrotesque_800ExtraBold",
  serif: "InstrumentSerif_400Regular",
  serifItalic: "InstrumentSerif_400Regular_Italic",
} as const;

/** Page gutter on phones (the site's --gutter at ≤ 480px). */
export const GUTTER = 16;

/** Height of the bottom tab bar, without the device's bottom inset. */
export const TAB_BAR_HEIGHT = 64;
