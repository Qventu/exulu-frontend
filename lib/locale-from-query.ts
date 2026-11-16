import { type Locale, locales } from "@/i18n/config";

/**
 * Decides what a `?lang=` parameter should do on load.
 *
 * The parameter exists so a link can hand someone the UI in their language —
 * useful for guests, who have no account to carry a preference on. It is a
 * one-shot preset, not a permanent mode: applying it writes the normal locale
 * cookie, after which the visitor is in exactly the state the switcher would
 * have put them in.
 *
 * It therefore has to be removed from the URL once read. `setLocale` reloads
 * the page, so a parameter left in place would be re-read on the way back and
 * silently undo the switcher: pick EN on a `?lang=de` URL and the reload flips
 * you to DE again, forever.
 */
export interface LocaleQueryDecision {
  /** Locale to apply, or null when the parameter asks for nothing new. */
  apply: Locale | null;
  /** Whether the parameter has to be taken out of the URL. */
  strip: boolean;
}

const isLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

export function localeFromQuery(
  param: string | null | undefined,
  current: Locale,
): LocaleQueryDecision {
  if (!param) return { apply: null, strip: false };

  const wanted = param.trim().toLowerCase();
  // An unknown language is ignored rather than defaulted: silently showing
  // English to someone who asked for "fr" is worse than leaving them where
  // they were, and it keeps a typo from looking like a product decision.
  if (!isLocale(wanted)) return { apply: null, strip: true };

  // Already in that language — nothing to apply, but the parameter still goes,
  // so a later switcher choice is not reverted by the reload.
  if (wanted === current) return { apply: null, strip: true };

  return { apply: wanted, strip: true };
}
