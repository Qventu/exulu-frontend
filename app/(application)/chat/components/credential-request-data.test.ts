import type { DynamicToolUIPart } from "ai";
import { describe, expect, it } from "vitest";

import {
  extractCredentialRequest,
  extractOauthRequest,
  isAllowedSubmitUrl,
  mapSubmitResponse,
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
