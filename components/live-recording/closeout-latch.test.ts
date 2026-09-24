import { describe, expect, it } from "vitest";

import { CloseoutLatch } from "./closeout-latch";

describe("CloseoutLatch", () => {
  it("lets exactly one caller own a job's close-out", () => {
    const latch = new CloseoutLatch();
    expect(latch.begin("job-1")).toBe(true);
    // The second composer mount asking for the same job: not yours.
    expect(latch.begin("job-1")).toBe(false);
    expect(latch.begin("job-1")).toBe(false);
  });

  it("hands the job on once the owner is done (the Retry path)", () => {
    const latch = new CloseoutLatch();
    expect(latch.begin("job-1")).toBe(true);
    latch.end("job-1");
    expect(latch.begin("job-1")).toBe(true);
  });

  it("is keyed by job: a new recording is never blocked by an old close-out", () => {
    const latch = new CloseoutLatch();
    expect(latch.begin("job-1")).toBe(true);
    expect(latch.begin("job-2")).toBe(true);
    latch.end("job-2");
    expect(latch.begin("job-1")).toBe(false);
  });

  it("end() is idempotent and clear() releases everything (release/discard)", () => {
    const latch = new CloseoutLatch();
    latch.begin("job-1");
    latch.end("job-1");
    latch.end("job-1");
    expect(latch.begin("job-1")).toBe(true);
    latch.begin("job-2");
    latch.clear();
    expect(latch.begin("job-1")).toBe(true);
    expect(latch.begin("job-2")).toBe(true);
  });
});
