import { describe, expect, it } from "vitest";

import { classifyChunkFailure } from "./classify-chunk-failure";

describe("classifyChunkFailure", () => {
  it("retries network errors, 429 and every 5xx", () => {
    expect(classifyChunkFailure(null)).toEqual({ kind: "retry" });
    expect(classifyChunkFailure(429)).toEqual({ kind: "retry" });
    expect(classifyChunkFailure(502)).toEqual({ kind: "retry" });
    expect(classifyChunkFailure(503)).toEqual({ kind: "retry" });
  });
  it("retries 401/403 (token refresh) rather than skipping audio", () => {
    expect(classifyChunkFailure(401)).toEqual({ kind: "retry" });
  });
  it("skips deterministic rejections 400/413/415", () => {
    expect(classifyChunkFailure(400)).toEqual({ kind: "skip" });
    expect(classifyChunkFailure(413)).toEqual({ kind: "skip" });
    expect(classifyChunkFailure(415)).toEqual({ kind: "skip" });
  });
  it("aborts on 409 with the server's kind", () => {
    expect(classifyChunkFailure(409, { kind: "not_recording" })).toEqual({ kind: "abort", reason: "not_recording" });
    expect(classifyChunkFailure(409, { kind: "out_of_order" })).toEqual({ kind: "abort", reason: "out_of_order" });
  });
  it("treats an unknown 409 as retry (server may be mid-transition)", () => {
    expect(classifyChunkFailure(409, null)).toEqual({ kind: "retry" });
  });
});
