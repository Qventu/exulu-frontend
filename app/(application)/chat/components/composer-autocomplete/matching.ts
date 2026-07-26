/**
 * Pure logic for the composer's inline "/" (tools & skills) and "@" (session
 * files) autocomplete. Zero imports, node-testable. UI/state wiring lives in
 * use-composer-autocomplete.ts; rendering in autocomplete-menu.tsx and
 * highlight-overlay.tsx.
 *
 * Spec: docs/superpowers/specs/2026-07-07-chat-input-autocomplete-design.md
 */

export interface ActiveTrigger {
  kind: "/" | "@";
  start: number; // index of the trigger character in the text
  query: string; // text between the trigger char and the caret
}

export interface TokenRange {
  start: number; // index of the trigger character
  end: number; // exclusive index after the last token character
  kind: "/" | "@";
}

export interface Suggestion {
  id: string; // unique row id, e.g. "tool:web_search" / "file:<s3key>" / "cmd:<name>"
  kind: "tool" | "skill" | "file" | "command";
  name: string; // exact machine name inserted after the trigger char
  displayName: string; // prettified for display
  description?: string;
  disabled?: boolean; // tool toggled off this session (greyed, still selectable)
}

const isWhitespace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch);

/** Word start = start of text or preceded by whitespace (incl. newline). */
const isWordStart = (text: string, i: number) => i === 0 || isWhitespace(text[i - 1]);

/**
 * Scan backwards from the caret for the nearest enabled trigger character at
 * a word start, without crossing a newline. Queries may contain spaces (file
 * names) — over-broad matches are handled by isAutoHidden, not here.
 */
export function detectTrigger(
  text: string,
  caret: number,
  enabled: { slash: boolean; at: boolean },
): ActiveTrigger | null {
  for (let i = caret - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "\n") return null;
    if ((ch === "/" && enabled.slash) || (ch === "@" && enabled.at)) {
      if (isWordStart(text, i)) {
        return { kind: ch, start: i, query: text.slice(i + 1, caret) };
      }
    }
  }
  return null;
}

/**
 * Boundary after a token: end of text or a char that can't continue a name.
 * Deliberately excludes '.' from the continuation class: "@report.pdf." must
 * still match "report.pdf" (trailing sentence period), and the '.' inside
 * file names is consumed by the exact name match itself. Widening the class
 * to [\w.-] would break token boundaries for file names.
 */
const isEndBoundary = (ch: string | undefined) => ch === undefined || !/[\w-]/.test(ch);

/**
 * Exact-case, longest-match token scan. A token is a trigger char at a word
 * start followed by a known name and an end boundary. Ranges never overlap.
 */
export function findTokenRanges(
  text: string,
  names: { slash: string[]; at: string[] },
): TokenRange[] {
  const byLength = (list: string[]) => [...list].sort((a, b) => b.length - a.length);
  const sorted: Record<"/" | "@", string[]> = {
    "/": byLength(names.slash),
    "@": byLength(names.at),
  };
  const ranges: TokenRange[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if ((ch === "/" || ch === "@") && isWordStart(text, i)) {
      const match = sorted[ch].find(
        (name) =>
          name.length > 0 &&
          text.startsWith(name, i + 1) &&
          isEndBoundary(text[i + 1 + name.length]),
      );
      if (match) {
        ranges.push({ start: i, end: i + 1 + match.length, kind: ch });
        i += 1 + match.length;
        continue;
      }
    }
    i++;
  }
  return ranges;
}

/**
 * Case-insensitive substring filter over name, display name, and description.
 * Prefix matches (on name or display name) rank first; order is otherwise
 * stable. An empty/whitespace-only query returns everything.
 *
 * Command-name prefix rule: a command whose name is a case-insensitive
 * prefix of the query followed by whitespace or end-of-string stays
 * visible even when the query includes args (e.g. "compact focus on X").
 * All commands rank before tools in the results.
 */
export function filterSuggestions(items: Suggestion[], query: string): Suggestion[] {
  const q = query.toLowerCase().trim();
  if (!q) return items;

  // Command-name prefix rule: a command whose name is a case-insensitive
  // prefix of the query followed by whitespace or end-of-string stays
  // visible even when the query includes args (e.g. "compact focus on X").
  // Args are ignored for suggestion display; the executor reads them from
  // the trigger's query. Commands surfaced by this rule always rank first.
  const commandNameMatches = (item: Suggestion) => {
    if (item.kind !== "command") return false;
    const name = item.name.toLowerCase();
    if (!q.startsWith(name)) return false;
    const nextChar = q.charAt(name.length);
    return nextChar === "" || /\s/.test(nextChar);
  };

  const commandHits = items.filter(commandNameMatches);
  const commandHitIds = new Set(commandHits.map((c) => c.id));

  const allMatches = items.filter(
    (item) =>
      !commandHitIds.has(item.id) &&
      (item.name.toLowerCase().includes(q) ||
        item.displayName.toLowerCase().includes(q) ||
        (item.description?.toLowerCase().includes(q) ?? false)),
  );

  // Separate commands and non-commands from all matches
  const commandMatches = allMatches.filter((item) => item.kind === "command");
  const nonCommandMatches = allMatches.filter((item) => item.kind !== "command");

  const isPrefix = (item: Suggestion) =>
    item.name.toLowerCase().startsWith(q) || item.displayName.toLowerCase().startsWith(q);

  return [
    ...commandHits,
    ...commandMatches.filter(isPrefix),
    ...commandMatches.filter((m) => !isPrefix(m)),
    ...nonCommandMatches.filter(isPrefix),
    ...nonCommandMatches.filter((m) => !isPrefix(m)),
  ];
}

/**
 * Replace trigger+query with the full token plus a terminating space and
 * return the new text and caret. Reuses an existing space right after the
 * caret instead of doubling it. Length limits are the caller's concern.
 */
export function insertToken(
  text: string,
  trigger: ActiveTrigger,
  caret: number,
  name: string,
): { text: string; caret: number } {
  const before = text.slice(0, trigger.start);
  const after = text.slice(caret);
  const space = after.startsWith(" ") ? "" : " ";
  const next = `${before}${trigger.kind}${name}${space}${after}`;
  // Caret lands after the terminating space in BOTH paths: when a space is
  // inserted it occupies start+1+name.length; when an existing space is
  // reused, that same index already holds it.
  return { text: next, caret: trigger.start + 1 + name.length + 1 };
}

/**
 * Derived visibility rule: once the query contains whitespace and nothing
 * matches, the user is writing prose past a token — hide the menu instead of
 * pinning a "No matches" row under a whole sentence. Single-word zero-match
 * queries keep the menu open as typo feedback.
 */
export function isAutoHidden(query: string, matchCount: number): boolean {
  return matchCount === 0 && /\s/.test(query);
}

/**
 * Regex-based parser for the `/compact` submit-time interception path.
 * Pure — mirrors the module's node-testable contract. Returns `steer`
 * trimmed to `undefined` when only whitespace, so callers can spread it
 * straight into the compact executor without a second guard.
 *
 * Not called by the menu-selection path, which has the trigger.query in
 * hand and doesn't need to re-scan the full input.
 */
export function parseCompactInput(
  input: string,
): { isCompact: true; steer?: string } | { isCompact: false } {
  const match = input.trim().match(/^\/compact(?:\s+([\s\S]*))?$/);
  if (!match) return { isCompact: false };
  const steer = match[1]?.trim();
  return { isCompact: true, steer: steer && steer.length > 0 ? steer : undefined };
}
