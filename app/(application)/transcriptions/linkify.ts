/**
 * Splits post-processing output into plain text and [mm:ss] / [h:mm:ss]
 * passage references, which the reading view renders as seek buttons.
 *
 * This is the whole of the spec's "passage references" feature: the
 * timestamped transcript (backend §3.1) lets a summary prompt cite a time,
 * and this turns the citation back into a seek. No stored reference model.
 */
const TIMESTAMP = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;

const toSeconds = (clock: string): number => {
  const parts = clock.split(":").map(Number);
  return parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1];
};

export function parseTimestampRefs(
  markdown: string,
): { text: string; seconds: number | null }[] {
  if (!markdown) return [];
  const parts: { text: string; seconds: number | null }[] = [];
  let cursor = 0;
  for (const match of markdown.matchAll(TIMESTAMP)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      parts.push({ text: markdown.slice(cursor, start), seconds: null });
    }
    parts.push({ text: match[1], seconds: toSeconds(match[1]) });
    cursor = start + match[0].length;
  }
  if (cursor < markdown.length) {
    parts.push({ text: markdown.slice(cursor), seconds: null });
  }
  return parts;
}

/**
 * Rewrites `[mm:ss]` / `[h:mm:ss]` passage references into markdown links with
 * a `#t=<seconds>` href, so the summary can be rendered as real markdown while
 * the references stay clickable — `SummaryMarkdown` intercepts that href and
 * seeks instead of navigating.
 *
 * Done as a pre-pass rather than a remark plugin because the reference syntax
 * is already markdown link-text shaped: `[12:34]` would otherwise be parsed as
 * a link with no destination and silently rendered as literal brackets.
 */
export const SEEK_HREF_PREFIX = "#t=";

export function timestampRefsToLinks(markdown: string): string {
  if (!markdown) return "";
  return parseTimestampRefs(markdown)
    .map((part) =>
      part.seconds === null
        ? part.text
        : `[${part.text}](${SEEK_HREF_PREFIX}${part.seconds})`,
    )
    .join("");
}

/** The seconds encoded in a `#t=` href, or null for any other href. */
export function secondsFromSeekHref(href: string | undefined): number | null {
  if (!href?.startsWith(SEEK_HREF_PREFIX)) return null;
  const seconds = Number(href.slice(SEEK_HREF_PREFIX.length));
  return Number.isFinite(seconds) ? seconds : null;
}
