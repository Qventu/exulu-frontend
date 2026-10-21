import { describe, expect, it } from "vitest";

import { decideImportMode, serverImportAvailable } from "@/lib/import/mode";

describe("decideImportMode", () => {
  it("stays client when at the row and byte limits", () => {
    expect(
      decideImportMode({ rows: 200, bytes: 10, serverAvailable: true }),
    ).toBe("client");
  });

  it("switches to server when rows exceed the limit and server is available", () => {
    expect(
      decideImportMode({ rows: 201, bytes: 10, serverAvailable: true }),
    ).toBe("server");
  });

  it("switches to server when bytes exceed the limit and server is available", () => {
    expect(
      decideImportMode({
        rows: 10,
        bytes: 2 * 1024 * 1024 + 1,
        serverAvailable: true,
      }),
    ).toBe("server");
  });

  it("is unavailable when server would be needed but is not available", () => {
    expect(
      decideImportMode({ rows: 201, bytes: 10, serverAvailable: false }),
    ).toBe("unavailable");
  });
});

describe("serverImportAvailable", () => {
  it("is true when the queues entitlement and worker redis host are set", () => {
    expect(
      serverImportAvailable({
        entitlements: { queues: true },
        workers: { enabled: true, redisHost: "r" },
      }),
    ).toBe(true);
  });

  it("is false when the queues entitlement is missing", () => {
    expect(
      serverImportAvailable({
        entitlements: { queues: false },
        workers: { enabled: true, redisHost: "r" },
      }),
    ).toBe(false);
  });

  it("is false for a null config", () => {
    expect(serverImportAvailable(null)).toBe(false);
  });
});
