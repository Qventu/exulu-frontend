import { describe, expect, it } from "vitest";

import { stripIncompleteCitation } from "./strip-incomplete-citation";

describe("stripIncompleteCitation", () => {
  it("drops an unterminated knowledge-source marker at the end of a stream", () => {
    expect(stripIncompleteCitation("Die Meldung bezieht sich auf {item_name: FST Meldung, item_id: 3")).toBe(
      "Die Meldung bezieht sich auf ",
    );
  });

  it("drops the first characters of one, including a lone brace", () => {
    expect(stripIncompleteCitation("Fahrkorbtableau) {")).toBe("Fahrkorbtableau) ");
    expect(stripIncompleteCitation("Fahrkorbtableau) { item_na")).toBe("Fahrkorbtableau) ");
  });

  it("leaves a completed marker for the renderer", () => {
    const s = "text {item_name: A, item_id: 1, context: c, chunk_id: x, chunk_index: 0} more";
    expect(stripIncompleteCitation(s)).toBe(s);
  });

  it("leaves braces that are not a citation", () => {
    expect(stripIncompleteCitation('```json\n{"a":')).toBe('```json\n{"a":');
    expect(stripIncompleteCitation("set {foo")).toBe("set {foo");
    expect(stripIncompleteCitation("no braces here")).toBe("no braces here");
  });
});
