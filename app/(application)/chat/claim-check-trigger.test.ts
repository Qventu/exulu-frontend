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

  // M6. The case above recovers ZERO sources, so it passes even if the guard
  // is weakened to `sources.length === 0`. This one recovers SOME but not
  // all: the fragment names two ids and only one chunk survived. That is the
  // dangerous shape — checking an answer against a subset of the evidence it
  // actually used returns `unsupported` for claims that are in fact
  // grounded, and `unsupported` is in the numerator of the label share, so
  // the panel renders an alert for a correct answer (spec §2.4, §5). This
  // guard is the client's half of that invariant; a missing panel is the
  // honest failure.
  it("returns null when SOME of the named sources are recovered but not all", () => {
    const partial = {
      ...base,
      metadata: { claimCheck: { enabled: true, sourceIds: ["i1", "i2"], toolCallIds: ["call_1"] } },
      parts: [
        {
          type: "tool-Context_Search",
          toolCallId: "call_1",
          output: {
            result: JSON.stringify({
              chunks: [{ item_id: "i1", item_name: "h.pdf", chunk_content: "230 Volt." }],
            }),
          },
        },
        { type: "text", text: "Die FST-2XT arbeitet mit 230 Volt." },
      ],
    } as unknown as UIMessage;
    expect(claimCheckRequestFor({ ...args, message: partial })).toBeNull();
  });

  // The same two-id fragment with both chunks present DOES check — so the
  // case above is pinning the mismatch, not simply "two ids never work".
  it("checks when every named source is recovered, two of two included", () => {
    const both = {
      ...base,
      metadata: { claimCheck: { enabled: true, sourceIds: ["i1", "i2"], toolCallIds: ["call_1"] } },
      parts: [
        {
          type: "tool-Context_Search",
          toolCallId: "call_1",
          output: {
            result: JSON.stringify({
              chunks: [
                { item_id: "i1", item_name: "h.pdf", chunk_content: "230 Volt." },
                { item_id: "i2", item_name: "w.pdf", chunk_content: "18 kg." },
              ],
            }),
          },
        },
        { type: "text", text: "Die FST-2XT arbeitet mit 230 Volt." },
      ],
    } as unknown as UIMessage;
    expect(claimCheckRequestFor({ ...args, message: both })?.sources).toEqual([
      { id: "i1", name: "h.pdf", content: "230 Volt." },
      { id: "i2", name: "w.pdf", content: "18 kg." },
    ]);
  });

  // A chunk that exists for the id but carries no text is dropped by
  // collectSources ("a source with no text is indistinguishable from a
  // fabricated one"), so it reaches this guard as a mismatch too.
  it("returns null when a named source's only chunk has no text", () => {
    const empty = {
      ...base,
      metadata: { claimCheck: { enabled: true, sourceIds: ["i1", "i2"], toolCallIds: ["call_1"] } },
      parts: [
        {
          type: "tool-Context_Search",
          toolCallId: "call_1",
          output: {
            result: JSON.stringify({
              chunks: [
                { item_id: "i1", item_name: "h.pdf", chunk_content: "230 Volt." },
                { item_id: "i2", item_name: "w.pdf", chunk_content: "" },
              ],
            }),
          },
        },
        { type: "text", text: "Die FST-2XT arbeitet mit 230 Volt." },
      ],
    } as unknown as UIMessage;
    expect(claimCheckRequestFor({ ...args, message: empty })).toBeNull();
  });

  it("returns null for an empty answer", () => {
    const noText = { ...base, parts: [base.parts![0]] } as unknown as UIMessage;
    expect(claimCheckRequestFor({ ...args, message: noText })).toBeNull();
  });

  // A turn that pauses for tool approval is not over: the backend emits
  // `finish` (with the trigger, if retrieval already ran) and the SDK sets
  // status "ready", so the fire effect would pay for a check of the
  // half-answer and the fired-set would then block the real one — the SDK
  // continues the SAME assistant message id after the approval. The panel
  // under the complete answer would carry a score over its first fragment
  // with no incompleteness marker, and a claim whose supporting retrieval
  // happens after the pause can read `unsupported`, the worst output this
  // system produces. Refusing here (rather than in the effect) keeps the
  // fired-set untouched, so the resumed turn gets its real check.
  it("returns null while the turn is paused on an approval-requested tool part", () => {
    const paused = {
      ...base,
      parts: [...base.parts!, { type: "tool-jira_create", toolCallId: "call_2", state: "approval-requested" }],
    } as unknown as UIMessage;
    expect(claimCheckRequestFor({ ...args, message: paused })).toBeNull();
  });

  it("returns null while the approval is answered but the turn has not resumed", () => {
    const responded = {
      ...base,
      parts: [...base.parts!, { type: "tool-jira_create", toolCallId: "call_2", state: "approval-responded" }],
    } as unknown as UIMessage;
    expect(claimCheckRequestFor({ ...args, message: responded })).toBeNull();
  });

  it("checks the resumed turn once the approved tool has its output", () => {
    const resumed = {
      ...base,
      parts: [
        ...base.parts!,
        { type: "tool-jira_create", toolCallId: "call_2", state: "output-available", output: { ok: true } },
        { type: "text", text: "Das Ticket ist angelegt." },
      ],
    } as unknown as UIMessage;
    const body = claimCheckRequestFor({ ...args, message: resumed });
    expect(body?.answer).toBe("Die FST-2XT arbeitet mit 230 Volt.\n\nDas Ticket ist angelegt.");
  });

  it("omits session and messageId when there is no session, so an unsaved chat still checks", () => {
    const body = claimCheckRequestFor({ ...args, session: undefined });
    expect(body?.session).toBeUndefined();
    expect(body?.messageId).toBeUndefined();
    expect(body?.answer).toBe("Die FST-2XT arbeitet mit 230 Volt.");
  });
});
