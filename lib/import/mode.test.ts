import { describe, expect, it } from "vitest";

import {
  IMPORT_CLIENT_MAX_BYTES,
  IMPORT_CLIENT_MAX_ROWS,
  IMPORT_SAMPLE_ROWS,
  decideImportMode,
  formatImportBytes,
  serverImportAvailable,
} from "@/lib/import/mode";

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

describe("IMPORT_SAMPLE_ROWS", () => {
  it("samples more rows than a client-side import may hold", () => {
    // The wizard shows the sample as its review grid; because the sample is
    // larger than the client limit, a client-mode file is always sampled
    // whole and the client flow still sees every row.
    expect(IMPORT_SAMPLE_ROWS).toBe(500);
    expect(IMPORT_SAMPLE_ROWS).toBeGreaterThan(IMPORT_CLIENT_MAX_ROWS);
  });
});

describe("formatImportBytes", () => {
  it("reads in bytes, KB and MB with one decimal", () => {
    expect(formatImportBytes(0)).toBe("0 B");
    expect(formatImportBytes(999)).toBe("999 B");
    expect(formatImportBytes(1024)).toBe("1.0 KB");
    expect(formatImportBytes(1536)).toBe("1.5 KB");
    expect(formatImportBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatImportBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });

  it("renders the byte threshold itself as 2.0 MB", () => {
    // The refusal banner quotes this next to the row count, so both facts
    // are on screen whichever of the two limits the file tripped.
    expect(formatImportBytes(IMPORT_CLIENT_MAX_BYTES)).toBe("2.0 MB");
  });
});
