/**
 * Removes a knowledge-source citation marker that has started but not yet
 * closed at the end of streamed text.
 *
 * The renderer turns `{item_name: …, item_id: …}` into a chip only once the
 * closing brace has arrived (components/message-renderer.tsx, the
 * flexibleCitationRegex). Until then the raw marker rendered as prose — a
 * visitor watching chapter 5 saw `{item_name: FST Meldung, item_id: …` for a
 * few hundred milliseconds before it snapped into a chip.
 *
 * Conservative on purpose: only an unterminated brace whose body is a
 * NON-EMPTY prefix of `item_name` is cut. A lone trailing "{", a JSON block,
 * `{x}` in a sentence or a completed marker is left alone — the parser also
 * runs on finished text, where a cut brace would never come back.
 */
export function stripIncompleteCitation(text: string): string {
  const open = text.lastIndexOf("{");
  if (open === -1) return text;
  const tail = text.slice(open + 1);
  if (tail.includes("}")) return text;
  const body = tail.trimStart();
  const probe = body.slice(0, "item_name".length);
  if (body !== "" && "item_name".startsWith(probe)) return text.slice(0, open);
  return text;
}
