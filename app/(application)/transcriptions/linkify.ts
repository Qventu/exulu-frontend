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
