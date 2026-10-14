import { describe, expect, it, vi, beforeEach } from "vitest";

const request = vi.fn();
vi.mock("@/lib/api/client", () => ({ request: (...args: unknown[]) => request(...args) }));

import { getSessionClaimChecks, postClaimCheck } from "./claim-check";

beforeEach(() => request.mockReset());

describe("postClaimCheck", () => {
  it("POSTs the body to /claims/check and returns the parsed result", async () => {
    const result = { status: "ok", score: { label: "ok" } };
    request.mockResolvedValue(result);
    const body = {
      question: "Womit arbeitet die FST-2XT?",
      answer: "Die FST-2XT arbeitet mit 230 Volt.",
      sources: [{ id: "i1", name: "handbuch.pdf", content: "Die FST-2XT arbeitet mit 230 Volt." }],
      session: "11111111-1111-4111-8111-111111111111",
      messageId: "msg_1",
    };
    await expect(postClaimCheck(body)).resolves.toBe(result);
    expect(request).toHaveBeenCalledWith("/claims/check", "POST", body);
  });

  it("propagates a rejection rather than swallowing it", async () => {
    request.mockRejectedValueOnce(new Error("429"));
    await expect(postClaimCheck({ question: "q", answer: "a", sources: [] })).rejects.toThrow("429");
  });
});

describe("getSessionClaimChecks", () => {
  it("GETs the session route and unwraps the checks map", async () => {
    request.mockResolvedValue({ checks: { msg_1: { status: "ok" } } });
    await expect(getSessionClaimChecks("11111111-1111-4111-8111-111111111111")).resolves.toEqual({
      msg_1: { status: "ok" },
    });
    expect(request).toHaveBeenCalledWith("/claims/check/11111111-1111-4111-8111-111111111111", "GET");
  });

  it("returns an empty map when the response carries no checks key", async () => {
    request.mockResolvedValue({});
    await expect(getSessionClaimChecks("s")).resolves.toEqual({});
  });

  it("returns an empty map instead of throwing when the route fails — a missing panel is not an error", async () => {
    request.mockRejectedValueOnce(new Error("500"));
    await expect(getSessionClaimChecks("s")).resolves.toEqual({});
  });
});
