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
// Not preceded by a letter — unless that letter is the n/r/t of a JSON
// escape (\n, \r, \t): the exported chunk files keep line breaks as the two
// characters \ and n, and "FST-2XT" after one survived the script and the
// scan until the citation dialog opened in the tour (2026-10-19).
const L = "(?<!(?<!\\\\)[A-Za-z])";
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
  // Kept on purpose: FSM, FSM-2, FPM, EAZ (Etagenanzeige), ECO, CBM-2, PAM —
  // module abbreviations with descriptive expansions, not the brand.
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
  // The bare cylinder types and accessories the session's tool outputs carry
  // (review, 2026-10-15): "Typ AZ-110", "AZ/K 110", "TAZ 133", "AZFR Z",
  // "AZSTBII", "AZM 70", "AZR 50", "Algi-AZRS". Digits (or "/K") after the
  // token keep a plain capitalised "AZ" in prose out of it.
  rule(`${L}TAZ(?=[- ]\\d)`, "THA"),
  rule(`${L}AZFR${R}`, "HAFR"),
  rule(`${L}AZSTB`, "HASTB"),
  rule(`${L}AZRS${R}`, "HRS"),
  rule(`${L}AZM(?= \\d)`, "HM"),
  rule(`${L}AZR(?= \\d)`, "HR"),
  rule(`${L}AZ(?=[- ]\\d|/K)`, "HA"),
  // ALGI's product lines in the meetings list.
  rule(`\\bS-Line\\b`, "E-Line"),
  rule(`\\bComfort-Line\\b`, "C-Line"),
  // --- ALGI: article numbers (the twelve in the session), the commission ----
  ...["134466", "118112", "113139", "140700", "105070", "105068", "105177", "120629", "118126", "114446", "113645", "113089"].map(
    (n) => rule(`\\b${n}\\b`, `4${n.slice(1)}`),
  ),
  rule(`\\bG47490\\b`, "G58301"),
  rule(`Giehl Nummer: 07204739`, "AHT-Nummer: 08315840"),
  // --- ALGI: the company, and the customer's name in fixture text -----------
  rule(`AHT Alfred Giehl GmbH & Co\\. KG`, "AHT Hydraulik GmbH"),
  rule(`\\bAlfred Giehl\\b`, "Hydraulik"),
  rule(`\\bGiehl\\b`, "Hydraulik"),
  rule(`\\bALGI\\b`, "AHT"),
  rule(`\\bAlgi\\b`, "AHT"),
];

/**
 * Rules that apply to named files only. ALGI's own exports carry dozens of
 * six-digit article numbers (1xxxxx) in tool outputs; swapping the prefix
 * for every one of them is the only way to be complete, and only there —
 * elsewhere a six-digit number is a token limit or a count.
 */
export const FILE_PSEUDONYMS: readonly { files: readonly string[]; pattern: RegExp; replacement: string }[] = [
  { files: ["algi-session.json", "algi-runs.json"], pattern: /\b1(\d{5})\b/g, replacement: "4$1" },
];

export function pseudonymise(text: string, fileName?: string): string {
  const general = PSEUDONYMS.reduce((s, { pattern, replacement }) => s.replace(pattern, replacement), text);
  if (!fileName) return general;
  return FILE_PSEUDONYMS.filter((r) => r.files.includes(fileName)).reduce(
    (s, { pattern, replacement }) => s.replace(pattern, replacement),
    general,
  );
}

/** The originals, for the scan test and the walker's deny list. */
export const ORIGINAL_TOKENS: readonly RegExp[] = [
  new RegExp(`${L}FST-?2XT`),
  new RegExp(`${L}FST-?[23]${R}`),
  new RegExp(`${L}FST${R}`),
  new RegExp(`${L}FSTBug`),
  new RegExp(`${L}fst2`),
  new RegExp(`${L}EAZ-?TFT`),
  new RegExp(`${L}AZKBZ${R}`),
  new RegExp(`${L}AZK${R}`),
  /DISA-/,
  // Consumes the whole type so the report reads "AZ-110", not "AZ".
  new RegExp(`${L}T?AZ(?:/K)?[- ]\\d{2,3}`),
  new RegExp(`${L}(AZFR|AZSTB|AZRS)`),
  new RegExp(`${L}AZ[MR](?= \\d)`),
  /\bS-Line\b|\bComfort-Line\b/,
  /\b07204739\b/,
  /\bAlgi\b/,
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
