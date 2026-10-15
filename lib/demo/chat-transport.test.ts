import { describe, expect, it, vi } from "vitest";
import { DemoChatTransport } from "./chat-transport";
import type { ScriptedTurn } from "./script";

const TURNS: ScriptedTurn[] = [
  { id: "m1", toolCalls: [], text: "First answer.", sources: [] },
  { id: "m2", toolCalls: [], text: "Second answer.", sources: [] },
];

async function drain(stream: ReadableStream<any>) {
  const out: any[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(value);
  }
  return out;
}

const noSleep = () => Promise.resolve();

describe("DemoChatTransport", () => {
  it("streams the first scripted turn", async () => {
    const t = new DemoChatTransport({ turns: TURNS, sleep: noSleep });
    const chunks = await drain(await t.sendMessages({} as any));
    const text = chunks.filter((c) => c.type === "text-delta").map((c) => c.delta).join("");
    expect(text).toBe("First answer.");
  });

  it("advances to the next turn on the next send", async () => {
    const t = new DemoChatTransport({ turns: TURNS, sleep: noSleep });
    await drain(await t.sendMessages({} as any));
    const chunks = await drain(await t.sendMessages({} as any));
    const text = chunks.filter((c) => c.type === "text-delta").map((c) => c.delta).join("");
    expect(text).toBe("Second answer.");
  });

  it("replays the last turn once the script runs out", async () => {
    const t = new DemoChatTransport({ turns: TURNS, sleep: noSleep });
    await drain(await t.sendMessages({} as any));
    await drain(await t.sendMessages({} as any));
    const chunks = await drain(await t.sendMessages({} as any));
    const text = chunks.filter((c) => c.type === "text-delta").map((c) => c.delta).join("");
    expect(text).toBe("Second answer.");
  });

  it("paces the stream between chunks", async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const t = new DemoChatTransport({ turns: TURNS, delayMs: 25, sleep });
    await drain(await t.sendMessages({} as any));
    expect(sleep).toHaveBeenCalledWith(25);
  });

  it("stops streaming when aborted", async () => {
    const controller = new AbortController();
    const t = new DemoChatTransport({
      turns: TURNS,
      sleep: () => {
        controller.abort();
        return Promise.resolve();
      },
    });
    const chunks = await drain(await t.sendMessages({ abortSignal: controller.signal } as any));
    // The loop checks signal?.aborted BEFORE enqueuing, so the first chunk
    // (text-start) is enqueued, then sleep fires abort(), then the next
    // iteration breaks immediately. Exactly 1 chunk reaches the reader.
    expect(chunks.length).toBe(1);
  });

  it("has no stream to reconnect to", async () => {
    const t = new DemoChatTransport({ turns: TURNS, sleep: noSleep });
    await expect(t.reconnectToStream({ chatId: "x" } as any)).resolves.toBeNull();
  });

  it("refuses an empty script rather than streaming nothing", () => {
    expect(() => new DemoChatTransport({ turns: [] })).toThrow(/at least one turn/i);
  });
});

describe("the search beat", () => {
  const TOOL_TURN: ScriptedTurn[] = [
    {
      id: "m3",
      toolCalls: [{ toolCallId: "tc1", toolName: "Context_Search", input: { q: "x" }, output: { result: "[]" } }],
      text: "Answer.",
      sources: [],
    },
  ];

  it("holds after the tool call goes out, and again once its result is in", async () => {
    const calls: number[] = [];
    const sleep = vi.fn((ms: number) => { calls.push(ms); return Promise.resolve(); });
    const t = new DemoChatTransport({ turns: TOOL_TURN, delayMs: 5, sleep });
    const chunks = await drain(await t.sendMessages({} as any));
    const types = chunks.map((c) => c.type);
    const inputIdx = types.indexOf("tool-input-available");
    const outputIdx = types.indexOf("tool-output-available");
    expect(inputIdx).toBeGreaterThanOrEqual(0);
    expect(outputIdx).toBeGreaterThan(inputIdx);
    // One pacing sleep per chunk, plus exactly one 1800 right after the
    // input chunk's pacing sleep and one 600 right after the output chunk's.
    const after = (idx: number) => { let seen = -1; for (let i = 0; i < calls.length; i++) { if (calls[i] === 5) seen++; if (seen === idx) return calls[i + 1]; } return undefined; };
    expect(after(inputIdx)).toBe(1800);
    expect(after(outputIdx)).toBe(600);
    expect(calls.filter((ms) => ms === 1800)).toHaveLength(1);
    expect(calls.filter((ms) => ms === 600)).toHaveLength(1);
  });

  it("lets the holds be configured", async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const t = new DemoChatTransport({ turns: TOOL_TURN, delayMs: 5, sleep, holdAfterToolInputMs: 10, holdAfterToolOutputMs: 20 });
    await drain(await t.sendMessages({} as any));
    expect(sleep).toHaveBeenCalledWith(10);
    expect(sleep).toHaveBeenCalledWith(20);
    expect(sleep).not.toHaveBeenCalledWith(1800);
  });

  it("stops during a hold when aborted", async () => {
    const controller = new AbortController();
    const t = new DemoChatTransport({
      turns: TOOL_TURN,
      delayMs: 5,
      holdAfterToolInputMs: 1800,
      sleep: (ms) => { if (ms === 1800) controller.abort(); return Promise.resolve(); },
    });
    const chunks = await drain(await t.sendMessages({ abortSignal: controller.signal } as any));
    expect(chunks.map((c) => c.type)).toEqual(["tool-input-available"]);
  });
});
