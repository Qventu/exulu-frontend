import type { DynamicToolUIPart } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extractCredentialRequest,
  extractOauthRequest,
  isAllowedSubmitUrl,
  mapSubmitResponse,
  markCredentialSubmitted,
  readCredentialSubmitted,
} from "./credential-request-data";

const toolPart = (overrides: Record<string, unknown>): DynamicToolUIPart =>
  ({
    type: "dynamic-tool",
    toolName: "moco_list_activities",
    toolCallId: "call-1",
    state: "output-available",
    input: {},
    ...overrides,
  }) as unknown as DynamicToolUIPart;

const payload = {
  provider: "moco",
  fields: [{ name: "apiKey", label: "API key", type: "password" }],
  submitUrl: "http://localhost:9001/credentials/submit",
  nonce: "n1",
};

describe("extractCredentialRequest", () => {
  it("extracts a well-formed payload from a final output", () => {
    const part = toolPart({ output: { credentialRequest: payload, result: null } });
    expect(extractCredentialRequest(part)).toEqual(payload);
  });

  it("returns null for non-final states, missing payloads, and malformed payloads", () => {
    expect(
      extractCredentialRequest(
        toolPart({ state: "input-available", output: undefined }),
      ),
    ).toBeNull();
    expect(extractCredentialRequest(toolPart({ output: { result: "[]" } }))).toBeNull();
    expect(
      extractCredentialRequest(
        toolPart({ output: { credentialRequest: { provider: "x" } } }),
      ),
    ).toBeNull();
  });
});

describe("extractOauthRequest", () => {
  it("extracts the authorizationUrl", () => {
    const part = toolPart({
      output: { result: "auth", oauth: { authorizationUrl: "https://x/auth" } },
    });
    expect(extractOauthRequest(part)).toEqual({ authorizationUrl: "https://x/auth" });
  });

  it("returns null when absent", () => {
    expect(extractOauthRequest(toolPart({ output: { result: "[]" } }))).toBeNull();
  });
});

describe("isAllowedSubmitUrl", () => {
  it("accepts only the configured backend origin", () => {
    expect(isAllowedSubmitUrl("http://localhost:9001/credentials/submit", "http://localhost:9001")).toBe(true);
    expect(isAllowedSubmitUrl("http://localhost:9001/credentials/submit", "http://localhost:9001/")).toBe(true);
    expect(isAllowedSubmitUrl("https://evil.example/credentials/submit", "http://localhost:9001")).toBe(false);
    expect(isAllowedSubmitUrl("http://localhost:9002/credentials/submit", "http://localhost:9001")).toBe(false);
    expect(isAllowedSubmitUrl("https://localhost:9001/credentials/submit", "http://localhost:9001")).toBe(false);
    expect(isAllowedSubmitUrl("not a url", "http://localhost:9001")).toBe(false);
    expect(isAllowedSubmitUrl("http://localhost:9001/x", undefined)).toBe(false);
  });
});

describe("mapSubmitResponse", () => {
  it("maps outcomes", () => {
    expect(mapSubmitResponse(200, { ok: true })).toEqual({ kind: "success" });
    expect(mapSubmitResponse(401, { ok: false, error: "nonce expired" })).toEqual({ kind: "expired" });
    expect(mapSubmitResponse(400, { ok: false, error: "validation failed: bad key" })).toEqual({
      kind: "error",
      message: "validation failed: bad key",
    });
    expect(mapSubmitResponse(500, null)).toEqual({ kind: "error", message: "HTTP 500" });
  });
});
describe("credential submitted persistence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is a safe no-op without a window (SSR / node)", () => {
    expect(readCredentialSubmitted("c1")).toBe(false);
    expect(() => markCredentialSubmitted("c1")).not.toThrow();
  });

  it("round-trips through localStorage when a window exists", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    });
    expect(readCredentialSubmitted("call-9")).toBe(false);
    markCredentialSubmitted("call-9");
    expect(readCredentialSubmitted("call-9")).toBe(true);
    expect(readCredentialSubmitted("call-other")).toBe(false);
  });

  it("swallows storage errors", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
      },
    });
    expect(readCredentialSubmitted("c1")).toBe(false);
    expect(() => markCredentialSubmitted("c1")).not.toThrow();
  });
});
