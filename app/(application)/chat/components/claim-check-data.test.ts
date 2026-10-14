import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";

import { answerTextOf, collectSources, parseClaimCheckTrigger, summarise } from "./claim-check-data";

const message = {
  id: "msg_1",
  role: "assistant",
  metadata: { claimCheck: { enabled: true, sourceIds: ["i1", "i2"], toolCallIds: ["call_1"] } },
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
    { type: "text", text: "Die FST-2XT arbeitet mit 230 Volt. " },
    { type: "text", text: "Die Tür wurde getauscht." },
  ],
} as unknown as UIMessage;

describe("parseClaimCheckTrigger", () => {
  it("reads the fragment the backend emits", () => {
    expect(parseClaimCheckTrigger(message.metadata)).toEqual({
      enabled: true,
      sourceIds: ["i1", "i2"],
      toolCallIds: ["call_1"],
    });
  });

  it("returns null when there is no fragment, which is the backend's off switch", () => {
    expect(parseClaimCheckTrigger({})).toBeNull();
    expect(parseClaimCheckTrigger(undefined)).toBeNull();
    expect(parseClaimCheckTrigger({ claimCheck: { enabled: true } })).toBeNull(); // no sourceIds
    expect(parseClaimCheckTrigger({ claimCheck: { enabled: true, sourceIds: [] } })).toBeNull();
  });
});

describe("collectSources", () => {
  it("takes only the named ids, with their content, deduplicated and in metadata order", () => {
    expect(collectSources(message, ["i2", "i1"])).toEqual([
      { id: "i2", name: "ticket.txt", content: "Die Tür wurde getauscht." },
      { id: "i1", name: "handbuch.pdf", content: "Die FST-2XT arbeitet mit 230 Volt." },
    ]);
  });

  it("concatenates every chunk of the same item, so a multi-chunk document arrives whole", () => {
    const multi = {
      parts: [
        {
          type: "tool-Context_Search",
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
    expect(collectSources(multi, ["i1"])).toEqual([
      { id: "i1", name: "h.pdf", content: "Erster Teil.\n\nZweiter Teil." },
    ]);
  });

  it("returns an empty array when the tool output cannot be parsed", () => {
    const broken = { parts: [{ type: "tool-Context_Search", output: { result: "<<not json>>" } }] } as unknown as UIMessage;
    expect(collectSources(broken, ["i1"])).toEqual([]);
  });

  it("skips an id the message does not carry rather than inventing an empty source", () => {
    expect(collectSources(message, ["i1", "nope"]).map((s) => s.id)).toEqual(["i1"]);
  });
});

describe("answerTextOf", () => {
  it("joins the text parts in order, which is the string the offsets index into", () => {
    expect(answerTextOf(message)).toBe("Die FST-2XT arbeitet mit 230 Volt. Die Tür wurde getauscht.");
  });

  it("is empty for a message with no text parts", () => {
    expect(answerTextOf({ parts: [{ type: "step-start" }] } as unknown as UIMessage)).toBe("");
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
