/**
 * What chapter 10 says about the meeting list, computed from the list.
 *
 * The chapter used to say "28 Besprechungen … siebzehn Stunden … drei
 * abgebrochen" as literals. Curating the fixture (test and untitled rows
 * out) broke every one of them, which is the problem with literals: the
 * sentence and the screen drift apart silently. Both now read from here.
 */
export function meetingTally(
  meetings: { status: string; duration_seconds: number | null }[],
) {
  const seconds = meetings.reduce((sum, m) => sum + (m.duration_seconds ?? 0), 0);
  const count = (status: string) => meetings.filter((m) => m.status === status).length;
  return {
    count: meetings.length,
    hours: Math.round(seconds / 3600),
    cancelled: count("cancelled"),
    failed: count("failed"),
    queued: count("queued"),
  };
}

const WORDS = [
  "keine", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn",
  "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn", "zwanzig",
];

/** "eine" / "zwei" / "dreizehn"; digits above twenty. `feminine` turns "ein" into "eine". */
export function germanCount(n: number, feminine = false): string {
  if (n === 1 && feminine) return "eine";
  return WORDS[n] ?? String(n);
}

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
