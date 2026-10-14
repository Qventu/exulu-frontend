import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";

import { answerTextOf, collectSources, hasPendingToolApproval, parseClaimCheckTrigger, summarise } from "./claim-check-data";

const message = {
  id: "msg_1",
  role: "assistant",
  metadata: {
    claimCheck: {
      enabled: true,
      sources: [
        { type: "knowledge_base", id: "i1", toolCallId: "call_1" },
        { type: "knowledge_base", id: "i2", toolCallId: "call_1" },
      ],
    },
  },
  parts: [
    { type: "step-start" },
    {
      type: "tool-Context_Search",
      toolCallId: "call_1",
      output: {
        result: JSON.stringify({
          chunks: [
            { chunk_id: "k1", item_id: "i1", item_name: "handbuch.pdf", chunk_content: "Die FST-2XT arbeitet mit 230 Volt." },
            { chunk_id: "k2", item_id: "i2", item_name: "ticket.txt", chunk_content: "Die Tür wurde getauscht." },
            { chunk_id: "k3", item_id: "i3", item_name: "fremd.pdf", chunk_content: "Nicht angefragt." },
          ],
        }),
      },
    },
    { type: "text", text: "Die FST-2XT arbeitet mit 230 Volt." },
    { type: "text", text: "Die Tür wurde getauscht." },
  ],
} as unknown as UIMessage;

describe("parseClaimCheckTrigger", () => {
  it("reads the manifest the backend emits", () => {
    expect(parseClaimCheckTrigger(message.metadata)).toEqual({
      enabled: true,
      sources: [
        { type: "knowledge_base", id: "i1", toolCallId: "call_1" },
        { type: "knowledge_base", id: "i2", toolCallId: "call_1" },
      ],
    });
  });

  it("returns null when there is no fragment, which is the backend's off switch", () => {
    expect(parseClaimCheckTrigger({})).toBeNull();
    expect(parseClaimCheckTrigger(undefined)).toBeNull();
    expect(parseClaimCheckTrigger({ claimCheck: { enabled: true } })).toBeNull(); // no sources
    expect(parseClaimCheckTrigger({ claimCheck: { enabled: true, sources: [] } })).toBeNull();
  });

  it("requires enabled to be the boolean true, not merely truthy — a false positive fires a paid check for an agent whose admin left it off", () => {
    expect(parseClaimCheckTrigger({ claimCheck: { enabled: "true", sources: [{ type: "knowledge_base", id: "i1" }] } })).toBeNull();
    expect(parseClaimCheckTrigger({ claimCheck: { enabled: 1, sources: [{ type: "knowledge_base", id: "i1" }] } })).toBeNull();
  });

  it("returns null when claimCheck itself is not an object", () => {
    expect(parseClaimCheckTrigger({ claimCheck: "yes" })).toBeNull();
    expect(parseClaimCheckTrigger({ claimCheck: null })).toBeNull();
    expect(parseClaimCheckTrigger({ claimCheck: true })).toBeNull();
  });

  it("filters invalid entries out of sources rather than passing them through", () => {
    expect(
      parseClaimCheckTrigger({
        claimCheck: {
          enabled: true,
          sources: [
            { type: "knowledge_base", id: "i1", toolCallId: "call_1" },
            { type: "knowledge_base", id: 42 }, // non-string id
            { type: "knowledge_base" }, // missing id
            "garbage",
            { type: "memory", id: "memory:m_1", toolCallId: 7 }, // non-string toolCallId
          ],
        },
      }),
    ).toEqual({ enabled: true, sources: [{ type: "knowledge_base", id: "i1", toolCallId: "call_1" }] });
  });

  it("accepts a manifest and rejects the Stage 3 shape", () => {
    expect(parseClaimCheckTrigger({ claimCheck: { enabled: true, sources: [{ type: "memory", id: "memory:m_7" }] } }))
      .toEqual({ enabled: true, sources: [{ type: "memory", id: "memory:m_7" }] });
    // The old shape carries no `sources`, so it must read as "nothing to do"
    // rather than as an empty check.
    expect(parseClaimCheckTrigger({ claimCheck: { enabled: true, sourceIds: ["i1"], toolCallIds: ["call_1"] } })).toBeNull();
  });

  it("drops an entry with an unknown type rather than trusting it", () => {
    const out = parseClaimCheckTrigger({
      claimCheck: { enabled: true, sources: [{ type: "memory", id: "memory:m_1" }, { type: "guesswork", id: "x" }] },
    });
    expect(out?.sources).toEqual([{ type: "memory", id: "memory:m_1" }]);
  });
});

describe("collectSources — knowledge_base", () => {
  it("finds each named id's chunks via its tool call, in manifest order", () => {
    expect(
      collectSources(message, [
        { type: "knowledge_base", id: "i2", toolCallId: "call_1" },
        { type: "knowledge_base", id: "i1", toolCallId: "call_1" },
      ]),
    ).toEqual([
      { id: "i2", name: "ticket.txt", type: "knowledge_base", content: "Die Tür wurde getauscht." },
      { id: "i1", name: "handbuch.pdf", type: "knowledge_base", content: "Die FST-2XT arbeitet mit 230 Volt." },
    ]);
  });

  it("concatenates every chunk of the same item, so a multi-chunk document arrives whole", () => {
    const multi = {
      parts: [
        {
          type: "tool-Context_Search",
          toolCallId: "call_1",
          output: {
            result: JSON.stringify({
              chunks: [
                { item_id: "i1", item_name: "h.pdf", chunk_content: "Erster Teil." },
                { item_id: "i1", item_name: "h.pdf", chunk_content: "Zweiter Teil." },
              ],
            }),
          },
        },
      ],
    } as unknown as UIMessage;
    expect(collectSources(multi, [{ type: "knowledge_base", id: "i1", toolCallId: "call_1" }])).toEqual([
      { id: "i1", name: "h.pdf", type: "knowledge_base", content: "Erster Teil.\n\nZweiter Teil." },
    ]);
  });

  it("returns an empty array when the tool output cannot be parsed", () => {
    const broken = {
      parts: [{ type: "tool-Context_Search", toolCallId: "call_1", output: { result: "<<not json>>" } }],
    } as unknown as UIMessage;
    expect(collectSources(broken, [{ type: "knowledge_base", id: "i1", toolCallId: "call_1" }])).toEqual([]);
  });

  it("skips an id the message does not carry rather than inventing an empty source", () => {
    expect(
      collectSources(message, [
        { type: "knowledge_base", id: "i1", toolCallId: "call_1" },
        { type: "knowledge_base", id: "nope", toolCallId: "call_1" },
      ]).map((s) => s.id),
    ).toEqual(["i1"]);
  });

  it("drops an id whose chunks are all missing or empty chunk_content, rather than emitting a source with no text", () => {
    // A source with no text is indistinguishable from a fabricated one: the
    // backend would score every claim citing it against nothing and report
    // those claims `unsupported` — a false hallucination alarm about the
    // user's own answer. This is a different branch than "no matching chunk":
    // here the id DOES have chunks, they just carry no usable text.
    const empty = {
      parts: [
        {
          type: "tool-Context_Search",
          toolCallId: "call_1",
          output: {
            result: JSON.stringify({
              chunks: [
                { item_id: "i1", item_name: "blank.pdf", chunk_content: "" },
                { item_id: "i1", item_name: "blank.pdf" }, // chunk_content absent entirely
              ],
            }),
          },
        },
      ],
    } as unknown as UIMessage;
    expect(collectSources(empty, [{ type: "knowledge_base", id: "i1", toolCallId: "call_1" }])).toEqual([]);
  });

  it("deduplicates a repeated id in the fragment into one source entry", () => {
    expect(
      collectSources(message, [
        { type: "knowledge_base", id: "i1", toolCallId: "call_1" },
        { type: "knowledge_base", id: "i1", toolCallId: "call_1" },
      ]),
    ).toEqual([{ id: "i1", name: "handbuch.pdf", type: "knowledge_base", content: "Die FST-2XT arbeitet mit 230 Volt." }]);
  });
});

describe("collectSources — knowledge_base by tool call id", () => {
  it("finds the retrieval part by its tool call id, whatever the tool is named", () => {
    const message = {
      metadata: { claimCheck: { enabled: true, sources: [{ type: "knowledge_base", id: "i1", toolCallId: "call_1" }] } },
      parts: [{
        type: "tool-Something_Renamed", // deliberately not the production name
        toolCallId: "call_1",
        output: { result: JSON.stringify({ chunks: [{ item_id: "i1", item_name: "h.pdf", chunk_content: "230 Volt." }] }) },
      }],
    } as unknown as UIMessage;
    expect(collectSources(message, [{ type: "knowledge_base", id: "i1", toolCallId: "call_1" }]))
      .toEqual([{ id: "i1", name: "h.pdf", type: "knowledge_base", content: "230 Volt." }]);
  });
});

describe("collectSources — memory", () => {
  it("takes a memory's information out of the turn's metadata", () => {
    const message = {
      metadata: {
        claimCheck: { enabled: true, sources: [{ type: "memory", id: "memory:m_7" }] },
        recalledMemories: [{ id: "m_7", title: "Sprache", information: "Der Kunde bevorzugt Deutsch." }],
      },
      parts: [],
    } as unknown as UIMessage;
    expect(collectSources(message, [{ type: "memory", id: "memory:m_7" }]))
      .toEqual([{ id: "memory:m_7", name: "Sprache", type: "memory", content: "Der Kunde bevorzugt Deutsch." }]);
  });

  it("omits a memory the metadata does not carry, rather than inventing one", () => {
    const message = { metadata: { recalledMemories: [] }, parts: [] } as unknown as UIMessage;
    expect(collectSources(message, [{ type: "memory", id: "memory:m_7" }])).toEqual([]);
  });

  it("omits a memory whose information is empty", () => {
    const message = {
      metadata: { recalledMemories: [{ id: "m_7", title: "Sprache", information: "   " }] },
      parts: [],
    } as unknown as UIMessage;
    expect(collectSources(message, [{ type: "memory", id: "memory:m_7" }])).toEqual([]);
  });
});

describe("answerTextOf", () => {
  it("joins the text parts in order, which is the string the offsets index into", () => {
    expect(answerTextOf(message)).toBe("Die FST-2XT arbeitet mit 230 Volt.\n\nDie Tür wurde getauscht.");
  });

  it("is empty for a message with no text parts", () => {
    expect(answerTextOf({ parts: [{ type: "step-start" }] } as unknown as UIMessage)).toBe("");
  });

  it("joins with blank lines rather than raw concatenation, so a tool call interrupting the answer cannot fuse two sentences into one", () => {
    // A raw join here would read "...230 Volt.Sie braucht..." — no whitespace
    // after the period — and the backend's Intl.Segmenter needs that
    // whitespace to see two sentences rather than one. Matches
    // messageMarkdown's separator in components/message-renderer.tsx.
    const interrupted = {
      parts: [
        { type: "text", text: "Die Anlage läuft mit 230 Volt." },
        { type: "tool-Context_Search", toolCallId: "call_2", output: { result: JSON.stringify({ chunks: [] }) } },
        { type: "text", text: "Sie braucht einen Trenntransformator." },
      ],
    } as unknown as UIMessage;
    expect(answerTextOf(interrupted)).toBe(
      "Die Anlage läuft mit 230 Volt.\n\nSie braucht einen Trenntransformator.",
    );
  });
});

describe("summarise", () => {
  const result = {
    status: "partial",
    score: { claims: 10, supported: 7, contradicted: 1, unsupported: 2, unsupportedShare: 0.3, label: "alert" },
  } as never;

  it("lifts the counts the panel's header needs", () => {
    expect(summarise(result)).toEqual({
      checked: 10,
      supported: 7,
      contradicted: 1,
      unsupported: 2,
      label: "alert",
      partial: true,
    });
  });

  it("preserves an 'n/a' label rather than collapsing it into a zero score", () => {
    const nothingToCheck = {
      status: "ok",
      score: { claims: 0, supported: 0, contradicted: 0, unsupported: 0, unsupportedShare: 0, label: "n/a" },
    } as never;
    expect(summarise(nothingToCheck).label).toBe("n/a");
    expect(summarise(nothingToCheck).partial).toBe(false);
  });
});

describe("hasPendingToolApproval", () => {
  const msg = (parts: unknown[]) => ({ id: "m", role: "assistant", parts }) as never;

  // When a turn stops to ask for tool approval the backend emits `finish`
  // (with the trigger, if retrieval ran) and the SDK sets status "ready" —
  // so a status-only guard fires a paid check on the half-answer, and the
  // fired-set then blocks the real check when the turn resumes on the SAME
  // assistant message id. The panel under the complete answer would show a
  // score computed over its first fragment, with `status: "ok"` and no
  // incompleteness marker, and claims whose supporting retrieval happened
  // after the pause could read `unsupported`.
  it("is true while a tool part waits for an answer", () => {
    expect(hasPendingToolApproval(msg([{ type: "tool-jira_create", state: "approval-requested" }]))).toBe(true);
  });

  it("is true once the approval is answered but the turn has not resumed", () => {
    expect(hasPendingToolApproval(msg([{ type: "tool-jira_create", state: "approval-responded" }]))).toBe(true);
  });

  it("is true when the pending part sits behind a finished one", () => {
    expect(
      hasPendingToolApproval(
        msg([
          { type: "tool-Context_Search", state: "output-available" },
          { type: "text", text: "Teilantwort." },
          { type: "tool-jira_create", state: "approval-requested" },
        ]),
      ),
    ).toBe(true);
  });

  // The SDK's terminal states for an answered approval are output-available
  // (ran) and output-denied (declined). Matching output-denied too would
  // suppress claim checking permanently for any turn the user said no in.
  it("is false once a declined tool has resolved to output-denied", () => {
    expect(
      hasPendingToolApproval(
        msg([
          { type: "tool-jira_create", state: "output-denied", approval: { id: "a", approved: false } },
          { type: "text", text: "Dann nicht." },
        ]),
      ),
    ).toBe(false);
  });

  it("is false for a finished turn, whatever its parts", () => {
    expect(
      hasPendingToolApproval(
        msg([
          { type: "tool-Context_Search", state: "output-available" },
          { type: "tool-jira_create", state: "output-available" },
          { type: "text", text: "Antwort." },
        ]),
      ),
    ).toBe(false);
    expect(hasPendingToolApproval(msg([{ type: "tool-x", state: "output-error" }]))).toBe(false);
    expect(hasPendingToolApproval(msg([]))).toBe(false);
    expect(hasPendingToolApproval({ id: "m", role: "assistant" } as never)).toBe(false);
  });
});
