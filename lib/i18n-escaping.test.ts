import IntlMessageFormat from "intl-messageformat";
import { describe, expect, it } from "vitest";

import de from "@/messages/de.json";
import en from "@/messages/en.json";

/**
 * Some UI strings TEACH template syntax — the prompt editor's placeholder and
 * hints show the reader what `{syntax}` and `{{customer_name}}` look like. ICU
 * reads an unescaped brace as an argument, so those strings threw at render:
 * MALFORMED_ARGUMENT for the double braces, and FORMATTING_ERROR for `{syntax}`
 * with no value supplied. next-intl catches both and falls back to the key, so
 * nothing crashed — it just logged, on every render, in the hundreds.
 *
 * The braces are now ICU-escaped with single quotes. That is easy to get
 * subtly wrong in a way that renders the quotes literally, so this asserts the
 * FORMATTED output rather than the source string.
 */

const LITERALS: Record<string, string> = {
  "prompts.editor.contentPlaceholder": "{{customer_name}}",
  "prompts.editor.contentHint": "{syntax}",
  "prompts.emptyDescription": "{syntax}",
};

const read = (messages: Record<string, unknown>, dotted: string) =>
  dotted.split(".").reduce<unknown>((node, key) => {
    return (node as Record<string, unknown>)?.[key];
  }, messages) as string;

describe.each([
  ["en", en],
  ["de", de],
])("%s prompt-syntax strings", (locale, messages) => {
  it.each(Object.entries(LITERALS))(
    "renders %s with its braces intact and no stray quotes",
    (key, expected) => {
      const source = read(messages as Record<string, unknown>, key);
      expect(source, `${key} missing from ${locale}`).toBeTruthy();

      // Formats with NO values on purpose: that is how the product calls it,
      // and it is what made the unescaped version throw.
      const formatted = new IntlMessageFormat(source, locale).format() as string;

      expect(formatted).toContain(expected);
      // The escape character must not survive into the rendered text.
      expect(formatted).not.toContain("'");
    },
  );
});
