import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";

import { claimCheckRequestFor } from "./hooks";

const base = {
  id: "msg_1",
  role: "assistant",
  metadata: { claimCheck: { enabled: true, sourceIds: ["i1"], toolCallIds: ["call_1"] } },
  parts: [
    {
      type: "tool-Context_Search",
      toolCallId: "call_1",
      output: { result: JSON.stringify({ chunks: [{ item_id: "i1", item_name: "h.pdf", chunk_content: "230 Volt." }] }) },
    },
    { type: "text", text: "Die FST-2XT arbeitet mit 230 Volt." },
  ],
} as unknown as UIMessage;

const args = { message: base, question: "Womit?", session: "s1", agentId: "a1", locale: "de" };

describe("claimCheckRequestFor", () => {
  it("builds the exact body for a triggered message", () => {
    expect(claimCheckRequestFor(args)).toEqual({
      question: "Womit?",
      answer: "Die FST-2XT arbeitet mit 230 Volt.",
      sources: [{ id: "i1", name: "h.pdf", content: "230 Volt." }],
      agent: "a1",
      session: "s1",
      messageId: "msg_1",
      locale: "de",
    });
  });

  it("returns null when the message carries no trigger", () => {
    expect(claimCheckRequestFor({ ...args, message: { ...base, metadata: {} } as UIMessage })).toBeNull();
  });

  it("returns null when the named sources cannot be recovered from the message", () => {
    const noTool = { ...base, parts: [{ type: "text", text: "Antwort." }] } as unknown as UIMessage;
    expect(claimCheckRequestFor({ ...args, message: noTool })).toBeNull();
  });

  it("returns null for an empty answer", () => {
    const noText = { ...base, parts: [base.parts![0]] } as unknown as UIMessage;
    expect(claimCheckRequestFor({ ...args, message: noText })).toBeNull();
  });

  it("omits session and messageId when there is no session, so an unsaved chat still checks", () => {
    const body = claimCheckRequestFor({ ...args, session: undefined });
    expect(body?.session).toBeUndefined();
    expect(body?.messageId).toBeUndefined();
    expect(body?.answer).toBe("Die FST-2XT arbeitet mit 230 Volt.");
  });
});
