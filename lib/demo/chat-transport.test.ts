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
