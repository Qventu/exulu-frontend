/**
 * The default theme-token manifest for /configuration (settings-config.md §4
 * `lib/theme-defaults.ts`) — colocated under this route because the parallel
 * redesign protocol fences `lib/**`; the module is deliberately
 * dependency-free so a later move to `lib/` is a pure file move.
 *
 * Source of truth: the `:root` and `.dark` blocks of `app/globals.css`.
 * Values are the EFFECTIVE defaults per mode — tokens the `.dark` block does
 * not redeclare (e.g. `--tracking-normal`) cascade from `:root`, so they
 * carry the same value in both modes here.
 *
 * DRIFT GUARD (settings-config.md risk 3): keep this list in sync with
 * app/globals.css when tokens change. The CI assertion script proposed by the
 * page doc lives outside this route's mandate and is still to be added.
 */

export type ThemeMode = "light" | "dark";

export type ThemeTokenGroup =
  | "surfaces"
  | "text"
  | "brand"
  | "semantic"
  | "charts"
  | "sidebar"
  | "shape";

/** Grouping order on the editor surface (settings-config.md §3). */
export const THEME_TOKEN_GROUPS: readonly ThemeTokenGroup[] = [
  "surfaces",
  "text",
  "brand",
  "semantic",
  "charts",
  "sidebar",
  "shape",
];

export interface ThemeToken {
  /** CSS custom-property name, including the leading `--`. */
  name: string;
  group: ThemeTokenGroup;
  /** Effective default in light mode (globals.css `:root`). */
  light: string;
  /** Effective default in dark mode (globals.css `.dark`, cascading `:root`). */
  dark: string;
}

export const THEME_TOKENS: readonly ThemeToken[] = [
  // — Surfaces —
  { name: "--background", group: "surfaces", light: "0 0% 99.2157%", dark: "225 7.1429% 10.9804%" },
  { name: "--card", group: "surfaces", light: "0 0% 99.2157%", dark: "228.0000 6.8493% 14.3137%" },
  { name: "--popover", group: "surfaces", light: "0 0% 98.8235%", dark: "228.0000 6.8493% 14.3137%" },
  { name: "--secondary", group: "surfaces", light: "214.2857 24.1379% 94.3137%", dark: "226.6667 9.6774% 18.2353%" },
  { name: "--muted", group: "surfaces", light: "0 0% 96.0784%", dark: "226.6667 9.6774% 18.2353%" },
  { name: "--accent", group: "surfaces", light: "221.3793 100% 94.3137%", dark: "217.2414 32.5843% 17.4510%" },
  { name: "--border", group: "surfaces", light: "240 17.0732% 91.9608%", dark: "222.8571 6.4220% 21.3725%" },
  { name: "--input", group: "surfaces", light: "0 0% 92.1569%", dark: "222.8571 6.4220% 21.3725%" },
  { name: "--code-surface", group: "surfaces", light: "231 15% 18%", dark: "231 15% 18%" },

  // — Text —
  { name: "--foreground", group: "text", light: "0 0% 0%", dark: "0 0% 94.1176%" },
  { name: "--card-foreground", group: "text", light: "0 0% 0%", dark: "0 0% 94.1176%" },
  { name: "--popover-foreground", group: "text", light: "0 0% 0%", dark: "0 0% 94.1176%" },
  { name: "--secondary-foreground", group: "text", light: "0 0% 3.1373%", dark: "0 0% 94.1176%" },
  { name: "--muted-foreground", group: "text", light: "0 0% 32.1569%", dark: "0 0% 62.7451%" },
  { name: "--accent-foreground", group: "text", light: "216.3158 76% 49.0196%", dark: "208.2090 100.0000% 73.7255%" },
  { name: "--code-surface-foreground", group: "text", light: "60 30% 96%", dark: "60 30% 96%" },

  // — Brand —
  { name: "--primary", group: "brand", light: "257.9412 100% 60%", dark: "257.6687 100% 68.0392%" },
  { name: "--primary-foreground", group: "brand", light: "0 0% 100%", dark: "0 0% 100%" },
  { name: "--ring", group: "brand", light: "0 0% 0%", dark: "257.6687 100% 68.0392%" },

  // — Semantic —
  { name: "--destructive", group: "semantic", light: "358.4416 74.7573% 59.6078%", dark: "0 90.6040% 70.7843%" },
  { name: "--destructive-foreground", group: "semantic", light: "0 0% 100%", dark: "0 0% 100%" },
  { name: "--success", group: "semantic", light: "142.1 76.2% 36.3%", dark: "142.1 70.6% 45.3%" },
  { name: "--success-foreground", group: "semantic", light: "0 0% 100%", dark: "0 0% 100%" },
  { name: "--warning", group: "semantic", light: "32.1 94.6% 43.7%", dark: "37.7 92.1% 50.2%" },
  { name: "--warning-foreground", group: "semantic", light: "0 0% 100%", dark: "25.7 90% 9.8%" },
  { name: "--info", group: "semantic", light: "221.2 83.2% 53.3%", dark: "217.2 91.2% 59.8%" },
  { name: "--info-foreground", group: "semantic", light: "0 0% 100%", dark: "0 0% 100%" },

  // — Charts —
  { name: "--chart-1", group: "charts", light: "148.0952 53.3898% 53.7255%", dark: "141.8919 69.1589% 58.0392%" },
  { name: "--chart-2", group: "charts", light: "257.9412 100% 60%", dark: "257.6687 100% 68.0392%" },
  { name: "--chart-3", group: "charts", light: "24.8571 98.1308% 58.0392%", dark: "24.8571 98.1308% 66%" },
  { name: "--chart-4", group: "charts", light: "217.0787 76.7241% 54.5098%", dark: "217.5484 87.5706% 65.2941%" },
  { name: "--chart-5", group: "charts", light: "0 0% 45.4902%", dark: "0 0% 62.7451%" },
  { name: "--chart-6", group: "charts", light: "173 80% 40%", dark: "172 66% 50%" },
  { name: "--chart-7", group: "charts", light: "330 81% 60%", dark: "329 86% 70%" },
  { name: "--chart-8", group: "charts", light: "45 93% 47%", dark: "48 96% 53%" },
  { name: "--chart-9", group: "charts", light: "292 84% 61%", dark: "292 91% 73%" },
  { name: "--chart-10", group: "charts", light: "84 81% 44%", dark: "83 78% 55%" },

  // — Sidebar —
  { name: "--sidebar", group: "sidebar", light: "210 42.8571% 97.2549%", dark: "240 4.3478% 9.0196%" },
  { name: "--sidebar-foreground", group: "sidebar", light: "240 5.3% 26.1%", dark: "240 4.8% 95.9%" },
  { name: "--sidebar-primary", group: "sidebar", light: "240 5.9% 10%", dark: "224.3 76.3% 48%" },
  { name: "--sidebar-primary-foreground", group: "sidebar", light: "0 0% 98%", dark: "0 0% 100%" },
  { name: "--sidebar-accent", group: "sidebar", light: "240 4.8% 95.9%", dark: "240 3.7% 15.9%" },
  { name: "--sidebar-accent-foreground", group: "sidebar", light: "240 5.9% 10%", dark: "240 4.8% 95.9%" },
  { name: "--sidebar-border", group: "sidebar", light: "220 13% 91%", dark: "240 3.7% 15.9%" },
  { name: "--sidebar-ring", group: "sidebar", light: "var(--ring)", dark: "var(--ring)" },

  // — Shape & typography —
  { name: "--radius", group: "shape", light: ".4rem", dark: ".4rem" },
  { name: "--font-sans", group: "shape", light: "'Inter', system-ui, sans-serif", dark: "'Inter', system-ui, sans-serif" },
  { name: "--font-serif", group: "shape", light: "'Merriweather', serif", dark: "'Merriweather', serif" },
  { name: "--font-mono", group: "shape", light: "'JetBrains Mono', monospace", dark: "'JetBrains Mono', monospace" },
  { name: "--tracking-normal", group: "shape", light: "-0.025em", dark: "-0.025em" },
  { name: "--shadow-2xs", group: "shape", light: "0px 2px 3px 0px hsl(0 0% 0% / 0.08)", dark: "0px 2px 3px 0px hsl(0 0% 0% / 0.08)" },
  { name: "--shadow-xs", group: "shape", light: "0px 2px 3px 0px hsl(0 0% 0% / 0.08)", dark: "0px 2px 3px 0px hsl(0 0% 0% / 0.08)" },
  { name: "--shadow-sm", group: "shape", light: "0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 1px 2px -1px hsl(0 0% 0% / 0.16)", dark: "0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 1px 2px -1px hsl(0 0% 0% / 0.16)" },
  { name: "--shadow", group: "shape", light: "0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 1px 2px -1px hsl(0 0% 0% / 0.16)", dark: "0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 1px 2px -1px hsl(0 0% 0% / 0.16)" },
  { name: "--shadow-md", group: "shape", light: "0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 2px 4px -1px hsl(0 0% 0% / 0.16)", dark: "0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 2px 4px -1px hsl(0 0% 0% / 0.16)" },
  { name: "--shadow-lg", group: "shape", light: "0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 4px 6px -1px hsl(0 0% 0% / 0.16)", dark: "0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 4px 6px -1px hsl(0 0% 0% / 0.16)" },
  { name: "--shadow-xl", group: "shape", light: "0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 8px 10px -1px hsl(0 0% 0% / 0.16)", dark: "0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 8px 10px -1px hsl(0 0% 0% / 0.16)" },
  { name: "--shadow-2xl", group: "shape", light: "0px 2px 3px 0px hsl(0 0% 0% / 0.40)", dark: "0px 2px 3px 0px hsl(0 0% 0% / 0.40)" },
];

/** Known token names for "custom variable" detection on imported themes. */
export const KNOWN_TOKEN_NAMES: ReadonlySet<string> = new Set(
  THEME_TOKENS.map((token) => token.name),
);

export type ThemeOverrides = Record<string, string>;

/** The default value of `name` in `mode`, or undefined for custom variables. */
export function defaultTokenValue(
  name: string,
  mode: ThemeMode,
): string | undefined {
  return THEME_TOKENS.find((token) => token.name === name)?.[mode];
}

/**
 * The full effective variable set for a mode: every manifest default merged
 * with the given overrides — including custom (non-manifest) override keys,
 * which must survive untouched (settings-config.md inventory #21/#22 merge
 * semantics).
 */
export function resolveTheme(
  mode: ThemeMode,
  overrides: ThemeOverrides,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const token of THEME_TOKENS) {
    resolved[token.name] = token[mode];
  }
  for (const [name, value] of Object.entries(overrides)) {
    if (typeof value === "string" && value.trim() !== "") {
      resolved[name] = value;
    }
  }
  return resolved;
}

/** Serializes light/dark variable records into a `:root` + `.dark` stylesheet. */
export function buildThemeCss(
  light: Record<string, string>,
  dark: Record<string, string>,
): string {
  const block = (vars: Record<string, string>) =>
    Object.entries(vars)
      .map(([name, value]) => `  ${name}: ${value};`)
      .join("\n");
  return `:root {\n${block(light)}\n}\n\n.dark {\n${block(dark)}\n}\n`;
}

/** Matches the bare HSL triplet notation globals.css uses ("258 100% 60%"). */
const HSL_TRIPLET = /^-?\d+(?:\.\d+)?(?:deg)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$/;

/**
 * A CSS color for the row swatch when the value is parseable, else null
 * (fonts, shadows, radius, `var()` references render no swatch).
 */
export function swatchColor(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (HSL_TRIPLET.test(trimmed)) return `hsl(${trimmed})`;
  if (/^(#|hsla?\(|rgba?\(|oklch\(|oklab\()/i.test(trimmed)) return trimmed;
  return null;
}

/**
 * True when `value` plausibly resolves to a color: parseable for the swatch,
 * or a `var()` reference (whose target may itself be a color). Drives the
 * per-row validation hint on color-typed tokens (settings-config.md ladder
 * row 25 / U16) — advisory only, never blocking: the regex is a heuristic,
 * not a CSS parser (risk 6).
 */
export function isPlausibleColorValue(value: string): boolean {
  if (swatchColor(value) !== null) return true;
  return /^var\(\s*--[\w-]+\s*(?:,[^)]*)?\)$/i.test(value.trim());
}

/**
 * Count of values in `overrides[mode]` that actually differ from the manifest
 * default (custom variables always count). THE single override-count semantic
 * — the editor's tab badges and the studio's publish/reset summaries must all
 * use this, so the numbers an admin confirms are the numbers they just saw.
 */
export function countModifiedTokens(
  mode: ThemeMode,
  overrides: { light: ThemeOverrides; dark: ThemeOverrides },
): number {
  return Object.entries(overrides[mode]).filter(([name, value]) => {
    const token = THEME_TOKENS.find((candidate) => candidate.name === name);
    return token === undefined || token[mode] !== value;
  }).length;
}
