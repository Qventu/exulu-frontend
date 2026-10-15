/**
 * The tour's register is du (spec, sub-project 6): du/dein for the visitor,
 * euer/eure for the company. This is the one place the Sie-form pattern is
 * written; chapters/index.test.ts runs it over every tour string and
 * scripts/walk-demo.mjs over the panel's and the scenes' on-screen text.
 *
 * Case-sensitive and deliberately strict: a sentence-initial "Sie" could mean
 * "they", so tour copy phrases around it rather than the check allowing it.
 * Lowercase "sie" (she/they), "Sieben", "sieht" do not match.
 */
export const SIE_FORM = /\b(Sie|Ihnen|Ihr|Ihre|Ihrem|Ihren|Ihrer)\b/;

/** The first Sie-form token in `text`, or null when the text is du-form. */
export function sieFormIn(text: string): string | null {
  const match = SIE_FORM.exec(text);
  return match ? match[1] : null;
}
