import { describe, expect, it } from "vitest";

import { extensionFor, pickMimeType } from "./mime";

describe("pickMimeType", () => {
  it("prefers webm/opus, then mp4, else the browser default (empty string)", () => {
    expect(pickMimeType((t) => t.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    expect(pickMimeType((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickMimeType(() => false)).toBe("");
  });
});

describe("extensionFor", () => {
  it("maps container types to file extensions", () => {
    expect(extensionFor("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionFor("audio/mp4")).toBe("m4a");
    expect(extensionFor("audio/ogg")).toBe("ogg");
    expect(extensionFor("")).toBe("webm");
  });
});
