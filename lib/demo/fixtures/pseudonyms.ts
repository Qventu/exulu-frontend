/**
 * Product identifiers of the two reference customers, replaced by invented
 * ones of the same shape (spec, sub-project 7). The fixtures were real,
 * redacted exports (see scripts/build-algi-*-fixture.py); this table is the
 * second, product-level layer, applied once by scripts/pseudonymise-fixtures.mjs
 * and committed. Keep the table — it is the record of what was renamed.
 *
 * ORDER MATTERS: composite tokens before their parts. Boundaries are
 * "not adjacent to a letter" rather than \b, because file names put the
 * token after an underscore ("mia_fst2-2s") where \b never fires.
 */
const L = "(?<![A-Za-z])"; // not preceded by a letter
const R = "(?![A-Za-z])"; // not followed by a letter

const rule = (source: string, replacement: string, flags = "g") => ({
  pattern: new RegExp(source, flags),
  replacement,
});

export const PSEUDONYMS: readonly { pattern: RegExp; replacement: string }[] = [
  // --- NEW Lift: the FST controller family → KS ----------------------------
  rule(`${L}FSTBugFixes`, "KSBugFixes"),
  rule(`${L}FST-2XT`, "KS-2XT"),
  rule(`${L}FST2XT`, "KS2XT"),
  rule(`${L}fst2xt`, "ks2xt"),
  rule(`${L}FST-2${R}`, "KS-2"),
  rule(`${L}fst2`, "ks2"),
  rule(`${L}FST-3${R}`, "KS-3"),
  rule(`${L}FST3${R}`, "KS3"),
  rule(`${L}FST${R}`, "KS"),
  rule(`${L}FSM2${R}`, "SM2"),
  rule(`${L}EAZ-TFT`, "DP-TFT"),
  rule(`${L}EAZTFT`, "DPTFT"),
  // --- ALGI: cylinders and seal kits -----------------------------------------
  rule(`${L}AZKBZ${R}`, "HKB"),
  rule(`-SAZK-`, "-SHK-"),
  rule(`-HAZ-`, "-HHA-"),
  rule(`-AZR-`, "-HR-"),
  rule(`-AZM-`, "-HM-"),
  rule(`-AZ-`, "-HA-"),
  rule(`${L}AZK${R}`, "HK"),
  rule(`${L}DISA-`, "DS-"),
  // --- ALGI: article numbers (the twelve in the session), the commission ----
  ...["134466", "118112", "113139", "140700", "105070", "105068", "105177", "120629", "118126", "114446", "113645", "113089"].map(
    (n) => rule(`\\b${n}\\b`, `4${n.slice(1)}`),
  ),
  rule(`\\bG47490\\b`, "G58301"),
  // --- ALGI: the company, and the customer's name in fixture text -----------
  rule(`AHT Alfred Giehl GmbH & Co\\. KG`, "AHT Hydraulik GmbH"),
  rule(`\\bAlfred Giehl\\b`, "Hydraulik"),
  rule(`\\bGiehl\\b`, "Hydraulik"),
  rule(`\\bALGI\\b`, "AHT"),
];

export function pseudonymise(text: string): string {
  return PSEUDONYMS.reduce((s, { pattern, replacement }) => s.replace(pattern, replacement), text);
}

/** The originals, for the scan test and the walker's deny list. */
export const ORIGINAL_TOKENS: readonly RegExp[] = [
  new RegExp(`${L}FST-?2XT`),
  new RegExp(`${L}FST-?[23]${R}`),
  new RegExp(`${L}FST${R}`),
  new RegExp(`${L}FSTBug`),
  new RegExp(`${L}fst2`),
  new RegExp(`${L}FSM2${R}`),
  new RegExp(`${L}EAZ-?TFT`),
  new RegExp(`${L}AZKBZ${R}`),
  new RegExp(`${L}AZK${R}`),
  /DISA-/,
  /\bGiehl\b/,
  /\bG47490\b/,
  /\b(134466|118112|113139|140700|105070|105068|105177|120629|118126|114446|113645|113089)\b/,
];

/** The first original token in `text`, or null. */
export function originalIn(text: string): string | null {
  for (const pattern of ORIGINAL_TOKENS) {
    const m = pattern.exec(text);
    if (m) return m[0];
  }
  return null;
}
