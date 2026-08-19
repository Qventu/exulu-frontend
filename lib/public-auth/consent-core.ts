/**
 * Cheap bot signals for the public registration route (spec §7.2).
 *
 * Both checks are deliberately weak and we say so plainly: `rendered_at` comes
 * from the client and is forgeable, and the honeypot field name is known to
 * off-the-shelf tooling. They stop opportunistic bots. Against a targeted
 * attacker only the rate limiter in otp-rate-limit.ts does any work.
 *
 * Every check fails OPEN. A false positive here is invisible to the user —
 * the route answers 200 either way, by design — so a real person would be
 * silently dropped with no error, no code and no lead. That is far worse than
 * letting a bot through to the rate limiter.
 */
export type BotVerdict = "human" | "bot";

/** Minimum plausible time between form render and submit. */
export const MIN_FILL_MS = 2_000;

/** Beyond this the form is stale — a page left open for half an hour. */
export const MAX_FORM_AGE_MS = 30 * 60_000;

export function checkHoneypot(body: unknown): BotVerdict {
  const website = (body as { website?: unknown } | null)?.website;
  if (typeof website !== "string") return "human";
  return website.trim().length > 0 ? "bot" : "human";
}

export function checkTiming(
  renderedAt: unknown,
  now: number = Date.now(),
): BotVerdict {
  if (typeof renderedAt !== "number" || !Number.isFinite(renderedAt)) {
    return "human";
  }
  const age = now - renderedAt;
  // Negative age means the client clock runs ahead of ours. Common, and not
  // evidence of anything.
  if (age < 0) return "human";
  if (age < MIN_FILL_MS) return "bot";
  if (age > MAX_FORM_AGE_MS) return "bot";
  return "human";
}
