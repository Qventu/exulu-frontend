import { type Locale, defaultLocale, locales } from "@/i18n/config";

/**
 * An agent's welcome message in more than one language.
 *
 * The message is agent content, not interface text, so the language switcher
 * never touched it: a visitor who chose English still read a German greeting.
 *
 * `welcomemessage` is the DEFAULT. It is written in the interface's default
 * language (English) and shown for that language and for every language that
 * has no version of its own. `welcomemessage_translations` holds the versions
 * for the other interface languages, keyed by locale: `{ "de": "Hallo …" }`.
 */

/** The interface languages a version can be written for: all but the default. */
export const TRANSLATION_LOCALES: readonly Locale[] = locales.filter(
  (locale) => locale !== defaultLocale,
);

export type WelcomeTranslations = Partial<Record<Locale, string>>;

const isLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

/**
 * The stored versions as an object. Accepts the object or its JSON string (json
 * columns arrive as either) and keeps only non-empty text for languages a
 * version can be written for.
 */
export function readWelcomeTranslations(raw: unknown): WelcomeTranslations {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: WelcomeTranslations = {};
  for (const locale of TRANSLATION_LOCALES) {
    const text = (value as Record<string, unknown>)[locale];
    if (typeof text === "string" && text.trim()) result[locale] = text;
  }
  return result;
}

/** What to store: trimmed, empty versions dropped, null when none is left. */
export function writeWelcomeTranslations(
  translations: WelcomeTranslations | null | undefined,
): WelcomeTranslations | null {
  const result: WelcomeTranslations = {};
  for (const locale of TRANSLATION_LOCALES) {
    const text = translations?.[locale]?.trim();
    if (text) result[locale] = text;
  }
  return Object.keys(result).length > 0 ? result : null;
}

/** The text to show a reader in `locale`. */
export function resolveWelcomeMessage(
  agent:
    | { welcomemessage?: string | null; welcomemessage_translations?: unknown }
    | null
    | undefined,
  locale: string | null | undefined,
): string {
  const fallback = agent?.welcomemessage ?? "";
  const wanted = (locale ?? "").toLowerCase();
  if (!isLocale(wanted) || wanted === defaultLocale) return fallback;
  return readWelcomeTranslations(agent?.welcomemessage_translations)[wanted] ?? fallback;
}
