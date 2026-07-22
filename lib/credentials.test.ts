import { describe, expect, it } from "vitest";

import { parseCredentialsResponse } from "./credentials";

describe("parseCredentialsResponse", () => {
  it("extracts the credentials array", () => {
    const list = parseCredentialsResponse({
      ok: true,
      credentials: [
        {
          provider: "moco",
          authType: "user_credentials",
          createdAt: "2026-07-22T10:00:00.000Z",
          updatedAt: "2026-07-22T10:00:00.000Z",
        },
      ],
    });
    expect(list).toHaveLength(1);
    expect(list[0]?.provider).toBe("moco");
  });

  it("returns [] for null/malformed responses", () => {
    expect(parseCredentialsResponse(null)).toEqual([]);
    expect(parseCredentialsResponse({ ok: true })).toEqual([]);
    expect(parseCredentialsResponse({ ok: true, credentials: "nope" })).toEqual([]);
  });
});
