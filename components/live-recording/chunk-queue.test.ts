import { describe, expect, it, vi } from "vitest";

import { backoffMs, ChunkQueue, QueueAbortError, type SendResult } from "./chunk-queue";

type P = { seq: number; label: string };

/** Scripted transport: each seq gets a list of responses consumed in order. */
function transport(script: Record<number, SendResult[]>) {
  const sent: Array<{ seq: number; skipped: boolean }> = [];
  const send = vi.fn(async (chunk: P, opts: { skipped: boolean }): Promise<SendResult> => {
    sent.push({ seq: chunk.seq, skipped: opts.skipped });
    const next = script[chunk.seq]?.shift();
    return next ?? { ok: true, text: `t${chunk.seq}` };
  });
  return { send, sent };
}

const sleeps: number[] = [];
const sleep = async (ms: number) => {
  sleeps.push(ms);
};

describe("backoffMs", () => {
  it("doubles from 1 s and caps at 30 s", () => {
    expect([0, 1, 2, 3, 4, 5, 10].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
});

describe("ChunkQueue", () => {
  it("sends strictly in order, one at a time, and records the text", async () => {
    const { send, sent } = transport({});
    const q = new ChunkQueue<P>({ send, sleep });
    q.enqueue({ seq: 0, label: "a" });
    q.enqueue({ seq: 1, label: "b" });
    q.enqueue({ seq: 2, label: "c" });
    await q.drain();
    expect(sent.map((s) => s.seq)).toEqual([0, 1, 2]);
    expect(q.snapshot().map((c) => [c.seq, c.status, c.text])).toEqual([
      [0, "sent", "t0"],
      [1, "sent", "t1"],
      [2, "sent", "t2"],
    ]);
  });

  it("retries a transient failure with backoff and never advances past it", async () => {
    sleeps.length = 0;
    const { send, sent } = transport({
      0: [{ ok: false, status: 503 }, { ok: false, status: null }, { ok: true, text: "ok" }],
    });
    const q = new ChunkQueue<P>({ send, sleep });
    q.enqueue({ seq: 0, label: "a" });
    q.enqueue({ seq: 1, label: "b" });
    await q.drain();
    expect(sent.map((s) => s.seq)).toEqual([0, 0, 0, 1]);
    expect(sleeps).toEqual([1000, 2000]);
    expect(q.snapshot()[0]).toMatchObject({ status: "sent", text: "ok", attempts: 3 });
  });

  it("keeps retrying transients indefinitely (no give-up)", async () => {
    const failures: SendResult[] = Array.from({ length: 40 }, () => ({ ok: false, status: 500 }));
    const { send, sent } = transport({ 0: [...failures, { ok: true, text: "finally" }] });
    const q = new ChunkQueue<P>({ send, sleep });
    q.enqueue({ seq: 0, label: "a" });
    await q.drain();
    expect(sent.length).toBe(41);
    expect(q.snapshot()[0].text).toBe("finally");
  });

  it("sends a skip marker for the same seq on a deterministic rejection, then continues", async () => {
    const { send, sent } = transport({ 0: [{ ok: false, status: 413 }] });
    const q = new ChunkQueue<P>({ send, sleep });
    q.enqueue({ seq: 0, label: "a" });
    q.enqueue({ seq: 1, label: "b" });
    await q.drain();
    expect(sent).toEqual([
      { seq: 0, skipped: false },
      { seq: 0, skipped: true },
      { seq: 1, skipped: false },
    ]);
    expect(q.snapshot()[0]).toMatchObject({ status: "skipped", text: "" });
  });

  it("aborts on 409 not_recording: drain rejects, later chunks are never sent", async () => {
    const { send, sent } = transport({ 0: [{ ok: false, status: 409, body: { kind: "not_recording" } }] });
    const q = new ChunkQueue<P>({ send, sleep });
    q.enqueue({ seq: 0, label: "a" });
    q.enqueue({ seq: 1, label: "b" });
    await expect(q.drain()).rejects.toBeInstanceOf(QueueAbortError);
    expect(sent.map((s) => s.seq)).toEqual([0]);
    expect(q.snapshot().map((c) => c.status)).toEqual(["failed", "pending"]);
  });

  it("abort() stops a retry loop and rejects drain", async () => {
    const { send } = transport({ 0: [{ ok: false, status: 500 }, { ok: false, status: 500 }, { ok: false, status: 500 }] });
    const q = new ChunkQueue<P>({
      send,
      sleep: async () => {
        q.abort("user");
      },
    });
    q.enqueue({ seq: 0, label: "a" });
    await expect(q.drain()).rejects.toMatchObject({ reason: "user" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers on every state change and drain resolves when idle", async () => {
    const { send } = transport({});
    const q = new ChunkQueue<P>({ send, sleep });
    const states: string[] = [];
    q.subscribe(() => states.push(q.snapshot().map((c) => c.status).join(",")));
    await q.drain(); // nothing queued → resolves immediately
    q.enqueue({ seq: 0, label: "a" });
    await q.drain();
    expect(states).toEqual(["pending", "sending", "sent"]);
    expect(q.pendingCount()).toBe(0);
  });
});

describe("ChunkQueue — fix round 1 regression coverage", () => {
  it("treats a thrown/rejected send as a transient failure and drain waits for the eventual success (no unhandled rejection)", async () => {
    const sent: number[] = [];
    let calls = 0;
    const send = vi.fn(async (chunk: P, _opts: { skipped: boolean }): Promise<SendResult> => {
      sent.push(chunk.seq);
      calls += 1;
      if (calls === 1) throw new Error("network exploded");
      return { ok: true, text: `t${chunk.seq}` };
    });
    const q = new ChunkQueue<P>({ send, sleep });
    q.enqueue({ seq: 0, label: "a" });
    await q.drain();
    expect(sent).toEqual([0, 0]);
    expect(q.snapshot()[0]).toMatchObject({ status: "sent", text: "t0" });
  });

  it("isolates a throwing subscriber: enqueue does not throw, the chunk still sends, and other subscribers still run", async () => {
    const { send } = transport({});
    const q = new ChunkQueue<P>({ send, sleep });
    const calls: string[] = [];
    q.subscribe(() => {
      calls.push("first");
      throw new Error("listener boom");
    });
    q.subscribe(() => {
      calls.push("second");
    });
    expect(() => q.enqueue({ seq: 0, label: "a" })).not.toThrow();
    await q.drain();
    expect(q.snapshot()[0]).toMatchObject({ status: "sent", text: "t0" });
    expect(calls).toContain("second");
  });

  it("retries the skip marker itself (not the original payload) after a transient failure, then succeeds", async () => {
    sleeps.length = 0;
    const { send, sent } = transport({
      0: [{ ok: false, status: 413 }, { ok: false, status: 500 }, { ok: true, text: "t0" }],
    });
    const q = new ChunkQueue<P>({ send, sleep });
    q.enqueue({ seq: 0, label: "a" });
    await q.drain();
    expect(sent.map((s) => [s.seq, s.skipped])).toEqual([
      [0, false],
      [0, true],
      [0, true],
    ]);
    expect(q.snapshot()[0]).toMatchObject({ status: "skipped", text: "" });
  });

  it("aborts with skip_rejected (not a livelock) when the skip marker itself is deterministically rejected", async () => {
    const { send, sent } = transport({
      0: [{ ok: false, status: 413 }, { ok: false, status: 400 }],
    });
    const q = new ChunkQueue<P>({ send, sleep });
    q.enqueue({ seq: 0, label: "a" });
    q.enqueue({ seq: 1, label: "b" });
    await expect(q.drain()).rejects.toMatchObject({ reason: "skip_rejected" });
    expect(sent.map((s) => s.seq)).toEqual([0, 0]);
    expect(q.snapshot().map((c) => c.status)).toEqual(["failed", "pending"]);
  });
});

describe("ChunkQueue.abortedReason", () => {
  it("is null while the queue is live and holds the reason afterwards", async () => {
    const { send } = transport({});
    const q = new ChunkQueue<P>({ send, sleep });
    expect(q.abortedReason).toBeNull();
    q.enqueue({ seq: 0, label: "a" });
    await q.drain();
    expect(q.abortedReason).toBeNull();
    q.abort("discard");
    expect(q.abortedReason).toBe("discard");
  });

  it("surfaces a 409 not_recording abort to a subscriber (the recorder's only mid-recording signal)", async () => {
    const { send } = transport({ 0: [{ ok: false, status: 409, body: { kind: "not_recording" } }] });
    const q = new ChunkQueue<P>({ send, sleep });
    const seen: Array<string | null> = [];
    q.subscribe(() => seen.push(q.abortedReason));
    q.enqueue({ seq: 0, label: "a" });
    await expect(q.drain()).rejects.toBeInstanceOf(QueueAbortError);
    expect(seen.filter((r) => r !== null)).toContain("not_recording");
    expect(q.abortedReason).toBe("not_recording");
  });
});
