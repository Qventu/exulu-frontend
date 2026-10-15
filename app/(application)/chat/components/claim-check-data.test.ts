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

  // Addendum (2026-10-14), ruled against the F1 brief: dropping just the bad
  // entries and returning the rest would leave `trigger.sources` shorter than
  // the backend's actual manifest, so the length-based completeness guard in
  // hooks.ts would agree with what's left and run the check anyway —
  // verifying the answer against part of its evidence. A malformed entry is
  // a reason to distrust the whole manifest, not to silently shrink it.
  it("refuses the whole manifest when any entry fails validation, rather than silently shrinking it", () => {
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
    ).toBeNull();
  });

  it("accepts a manifest and rejects the Stage 3 shape", () => {
    expect(parseClaimCheckTrigger({ claimCheck: { enabled: true, sources: [{ type: "memory", id: "memory:m_7" }] } }))
      .toEqual({ enabled: true, sources: [{ type: "memory", id: "memory:m_7" }] });
    // The old shape carries no `sources`, so it must read as "nothing to do"
    // rather than as an empty check.
    expect(parseClaimCheckTrigger({ claimCheck: { enabled: true, sourceIds: ["i1"], toolCallIds: ["call_1"] } })).toBeNull();
  });

  // The backend never emits `other` — its own types call it request-only —
  // and before this it parsed here and then failed at the coverage guard
  // instead: two silent-refusal paths for one condition, in the module whose
  // rule is to fail closed in ONE place.
  it("refuses a manifest naming the request-only `other` type, which the backend never emits", () => {
    expect(
      parseClaimCheckTrigger({ claimCheck: { enabled: true, sources: [{ type: "other", id: "tool:call_1", toolCallId: "call_1" }] } }),
    ).toBeNull();
  });

  // Same reasoning as above: an unknown type names evidence this client
  // cannot produce, so the manifest must fail closed rather than drop that
  // one entry and let the rest look like a complete manifest.
  it("refuses the whole manifest when it carries a type this client does not understand", () => {
    const out = parseClaimCheckTrigger({
      claimCheck: { enabled: true, sources: [{ type: "memory", id: "memory:m_1" }, { type: "guesswork", id: "x" }] },
    });
    expect(out).toBeNull();
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

  // Fix round 3, Critical 3. Several retrieval calls per turn are designed
  // and normal (`max_searches`), and each call serialises only its OWN
  // chunks. The backend names `{knowledge_base, i1, toolCallId: call_1}`
  // once — first-seen wins — so reading only `call_1`'s part lost every
  // passage `call_2` returned for the same handbook while the answer rested
  // on them, and the coverage guard was satisfied, so the check ran and
  // scored a grounded claim `unsupported`. Stage 3 pooled chunks across all
  // retrieval parts; this is the regression Stage 4 introduced.
  it("unions an item's chunks across every retrieval call the manifest names, not only the entry's own", () => {
    const twoCalls = {
      parts: [
        {
          type: "tool-Context_Search",
          toolCallId: "call_1",
          output: {
            result: JSON.stringify({
              chunks: [{ item_id: "i1", item_name: "handbuch.pdf", chunk_content: "Die FST-2XT arbeitet mit 230 Volt." }],
            }),
          },
        },
        {
          type: "tool-Context_Search",
          toolCallId: "call_2",
          output: {
            result: JSON.stringify({
              chunks: [{ item_id: "i1", item_name: "handbuch.pdf", chunk_content: "Wartungsintervall: jährlich." }],
            }),
          },
        },
      ],
    } as unknown as UIMessage;
    // One manifest entry, carrying the FIRST call's id as provenance.
    expect(collectSources(twoCalls, [{ type: "knowledge_base", id: "i1", toolCallId: "call_1" }])).toEqual([
      {
        id: "i1",
        name: "handbuch.pdf",
        type: "knowledge_base",
        content: "Die FST-2XT arbeitet mit 230 Volt.\n\nWartungsintervall: jährlich.",
      },
    ]);
  });

  // The pooling filter is the ITEM ID, which is what keeps attribution
  // correct without any tool-name knowledge: a chunk carrying this item's id
  // is a passage of this item, and a chunk carrying another item's id is
  // never folded into it (that item has its own manifest entry and its own
  // source).
  it("never folds another item's passages into this entry, however many calls ran", () => {
    const twoItems = {
      parts: [
        {
          type: "tool-Context_Search",
          toolCallId: "call_1",
          output: { result: JSON.stringify({ chunks: [{ item_id: "i1", item_name: "h.pdf", chunk_content: "Aus dem Handbuch." }] }) },
        },
        {
          type: "tool-Context_Search",
          toolCallId: "call_2",
          output: { result: JSON.stringify({ chunks: [{ item_id: "i2", item_name: "ticket.txt", chunk_content: "Aus dem Ticket." }] }) },
        },
      ],
    } as unknown as UIMessage;
    expect(collectSources(twoItems, [{ type: "knowledge_base", id: "i1", toolCallId: "call_1" }])).toEqual([
      { id: "i1", name: "h.pdf", type: "knowledge_base", content: "Aus dem Handbuch." },
    ]);
  });

  // A session-items search nests its chunks one level deeper (an array of
  // per-context responses), so `chunksOf` reads nothing from it and it can
  // never leak into a knowledge-base source — it has its own arm and its own
  // manifest entry.
  it("reads nothing from a session-items part, whose chunks are nested per context", () => {
    const mixed = {
      parts: [
        {
          type: "tool-Context_Search",
          toolCallId: "call_1",
          output: { result: JSON.stringify({ chunks: [{ item_id: "i1", item_name: "h.pdf", chunk_content: "Aus der Wissensbasis." }] }) },
        },
        {
          type: "tool-session_items_information_context_search",
          toolCallId: "call_5",
          output: {
            result: JSON.stringify([
              { context: { id: "ctx_1" }, chunks: [{ item_id: "i1", item_name: "h.pdf", chunk_content: "Aus den angehefteten Elementen." }] },
            ]),
          },
        },
      ],
    } as unknown as UIMessage;
    expect(collectSources(mixed, [{ type: "knowledge_base", id: "i1", toolCallId: "call_1" }])).toEqual([
      { id: "i1", name: "h.pdf", type: "knowledge_base", content: "Aus der Wissensbasis." },
    ]);
  });

  it("does not repeat a passage both calls returned", () => {
    const twoCalls = {
      parts: [
        {
          type: "tool-Context_Search",
          toolCallId: "call_1",
          output: { result: JSON.stringify({ chunks: [{ chunk_id: "k1", item_id: "i1", item_name: "h.pdf", chunk_content: "230 Volt." }] }) },
        },
        {
          type: "tool-Context_Search",
          toolCallId: "call_2",
          output: {
            result: JSON.stringify({
              chunks: [
                { chunk_id: "k1", item_id: "i1", item_name: "h.pdf", chunk_content: "230 Volt." },
                { chunk_id: "k2", item_id: "i1", item_name: "h.pdf", chunk_content: "Jährliche Wartung." },
              ],
            }),
          },
        },
      ],
    } as unknown as UIMessage;
    expect(
      collectSources(twoCalls, [
        { type: "knowledge_base", id: "i1", toolCallId: "call_1" },
      ])[0]!.content,
    ).toBe("230 Volt.\n\nJährliche Wartung.");
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

  // Fix round 3, Important 5. The prompt block the model read is
  // `- {item_name: "<title>", item_id: …} <information> (saved by …)`
  // (backend buildMemoryPromptBlock), so with blank `information` the TITLE
  // is still real evidence in the system prompt — and a hand-created memory
  // row with only a name is an ordinary shape. Dropping it discarded
  // evidence the model was shown, so a claim resting on it scored
  // `unsupported`.
  it("falls back to the title as the content when the information is blank", () => {
    const message = {
      metadata: { recalledMemories: [{ id: "m_7", title: "Kunde bevorzugt Deutsch", information: "   " }] },
      parts: [],
    } as unknown as UIMessage;
    expect(collectSources(message, [{ type: "memory", id: "memory:m_7" }])).toEqual([
      { id: "memory:m_7", name: "Kunde bevorzugt Deutsch", type: "memory", content: "Kunde bevorzugt Deutsch" },
    ]);
  });

  it("omits a memory whose title and information are both blank", () => {
    const message = {
      metadata: { recalledMemories: [{ id: "m_7", title: "  ", information: "   " }] },
      parts: [],
    } as unknown as UIMessage;
    expect(collectSources(message, [{ type: "memory", id: "memory:m_7" }])).toEqual([]);
  });

  // Normalised at the source, not by two downstream falsiness checks (the
  // message column's `source.name &&` and the panel's `name ?`): a blank
  // title is no name at all.
  it("reports a blank title as no name rather than an empty string", () => {
    const message = {
      metadata: { recalledMemories: [{ id: "m_7", title: "   ", information: "Der Kunde bevorzugt Deutsch." }] },
      parts: [],
    } as unknown as UIMessage;
    expect(collectSources(message, [{ type: "memory", id: "memory:m_7" }])).toEqual([
      { id: "memory:m_7", name: undefined, type: "memory", content: "Der Kunde bevorzugt Deutsch." },
    ]);
  });
});

describe("collectSources — document", () => {
  it("takes a document tool's content and names it from the tool's input filename", () => {
    const message = {
      parts: [{ type: "tool-read_session_file", toolCallId: "call_4", input: { filename: "wartung.pdf" }, output: { content: "230 Volt." } }],
    } as unknown as UIMessage;
    expect(collectSources(message, [{ type: "document", id: "tool:call_4", toolCallId: "call_4" }]))
      .toEqual([{ id: "tool:call_4", name: "wartung.pdf", type: "document", content: "230 Volt." }]);
  });

  // Review Focus 2
  it("never sends a tool error as evidence", () => {
    const message = {
      parts: [{ type: "tool-read_session_file", toolCallId: "call_4", output: { error: "Could not read session file \"x\"." } }],
    } as unknown as UIMessage;
    expect(collectSources(message, [{ type: "document", id: "tool:call_4", toolCallId: "call_4" }])).toEqual([]);
  });
});

describe("collectSources — web", () => {
  it("makes one source per cited page, named by its title", () => {
    const parsed = {
      content: "Die Anlage läuft mit 230 Volt.",
      search_results: [
        { url: "https://example.com/a", title: "Anlagen A", snippet: "230 Volt." },
        { url: "https://example.com/b", title: "Anlagen B", snippet: "Wartung jährlich." },
      ],
    };
    const message = {
      parts: [{ type: "tool-Internet_Search", toolCallId: "call_9", output: { result: JSON.stringify(parsed) } }],
    } as unknown as UIMessage;
    const out = collectSources(message, [{ type: "web", id: "tool:call_9", toolCallId: "call_9" }]);
    expect(out.filter((s) => (s.id ?? "").includes("#"))).toHaveLength(2);
    // `title ?? url`, not the other way round: the panel renders names as
    // prose beside a quote ("Webseite – Anlagen A: „230 Volt“"), where a
    // bare URL reads worse than a headline.
    expect(out.find((s) => s.id === "tool:call_9#0")).toEqual({
      id: "tool:call_9#0", name: "Anlagen A", type: "web", content: "Anlagen A\n\n230 Volt.",
    });
  });

  it("falls back to the url when a cited page has no title", () => {
    const message = {
      parts: [{
        type: "tool-Internet_Search",
        toolCallId: "call_9",
        output: { result: JSON.stringify({ search_results: [{ url: "https://example.com/a", snippet: "230 Volt." }] }) },
      }],
    } as unknown as UIMessage;
    const out = collectSources(message, [{ type: "web", id: "tool:call_9", toolCallId: "call_9" }]);
    expect(out[0]!.name).toBe("https://example.com/a");
  });

  // Fix round 3, Critical 1. The snippets are a sentence or two each; the
  // text the assistant actually paraphrased is Perplexity's prose answer in
  // `content`. Sending only the snippets scores a claim that paraphrases the
  // body but appears in no snippet `unsupported` — a false "your answer was
  // unfounded" on an ordinary search turn.
  it("always sends the answer body as its own source, not only when citations are missing", () => {
    const parsed = {
      content: "Die Anlage läuft mit 230 Volt und braucht jährliche Wartung.",
      search_results: [
        { url: "https://example.com/a", title: "Anlagen A", snippet: "230 Volt." },
        { url: "https://example.com/b", title: "Anlagen B", snippet: "Wartung jährlich." },
      ],
    };
    const message = {
      parts: [{
        type: "tool-Internet_Search",
        toolCallId: "call_9",
        input: { query: "Womit arbeitet die FST-2XT?" },
        output: { result: JSON.stringify(parsed) },
      }],
    } as unknown as UIMessage;
    const out = collectSources(message, [{ type: "web", id: "tool:call_9", toolCallId: "call_9" }]);
    // The body AND both pages: a verdict can still cite the page it came from.
    expect(out).toHaveLength(3);
    expect(out.find((s) => s.id === "tool:call_9")).toEqual({
      id: "tool:call_9",
      name: "Womit arbeitet die FST-2XT?",
      type: "web",
      content: "Die Anlage läuft mit 230 Volt und braucht jährliche Wartung.",
    });
  });

  // The backend's internet_search substitutes each `[n]` marker in the prose
  // for `JSON.stringify({ url, title, snippet })` of search_results[n-1]
  // (src/templates/tools/perplexity.ts). Left alone, an evidence quote shown
  // to a reader can be a `{"url":…}` blob.
  it("puts the inline citation markers back, so a quote never surfaces a {\"url\":…} blob", () => {
    const first = { url: "https://example.com/a", title: "Anlagen A", snippet: "230 Volt." };
    const second = { url: "https://example.com/b", title: "Anlagen B", snippet: "Wartung jährlich." };
    const parsed = {
      content:
        `Die Anlage läuft mit 230 Volt${JSON.stringify(first)} und wird jährlich gewartet${JSON.stringify(second)}.`,
      search_results: [first, second],
    };
    const message = {
      parts: [{ type: "tool-Internet_Search", toolCallId: "call_9", output: { result: JSON.stringify(parsed) } }],
    } as unknown as UIMessage;
    const body = collectSources(message, [{ type: "web", id: "tool:call_9", toolCallId: "call_9" }])
      .find((s) => s.id === "tool:call_9");
    expect(body?.content).toBe("Die Anlage läuft mit 230 Volt[1] und wird jährlich gewartet[2].");
    expect(body?.content).not.toContain('{"url"');
  });

  it("still sends the body when the search cited nothing usable", () => {
    const message = {
      parts: [{
        type: "tool-Internet_Search",
        toolCallId: "call_9",
        output: { result: JSON.stringify({ content: "Nur Prosa.", search_results: [{ url: "https://x" }] }) },
      }],
    } as unknown as UIMessage;
    expect(collectSources(message, [{ type: "web", id: "tool:call_9", toolCallId: "call_9" }])).toEqual([
      { id: "tool:call_9", name: undefined, type: "web", content: "Nur Prosa." },
    ]);
  });

  // Review Focus 3 — zero sources here would trip the completeness guard and
  // silently kill the check on every search turn.
  it("falls back to one source for the search itself when there are no citations", () => {
    const message = {
      parts: [{ type: "tool-Internet_Search", toolCallId: "call_9", output: { result: JSON.stringify({ content: "Die Anlage läuft mit 230 Volt." }) } }],
    } as unknown as UIMessage;
    const out = collectSources(message, [{ type: "web", id: "tool:call_9", toolCallId: "call_9" }]);
    expect(out).toEqual([{ id: "tool:call_9", name: undefined, type: "web", content: "Die Anlage läuft mit 230 Volt." }]);
  });

  it("omits the entry entirely when the payload will not parse", () => {
    const message = {
      parts: [{ type: "tool-Internet_Search", toolCallId: "call_9", output: { result: "<<not json>>" } }],
    } as unknown as UIMessage;
    expect(collectSources(message, [{ type: "web", id: "tool:call_9", toolCallId: "call_9" }])).toEqual([]);
  });
});

describe("collectSources — session_item", () => {
  // Measured shape (not the brief's guessed one): the tool returns
  // `{ result: JSON.stringify(results.flat()) }` where `results` is one
  // `context.search(...)` call per context referenced in the session.
  // `context.search` (src/exulu/context.ts) returns a whole vectorSearch
  // response — `{ ..., chunks: VectorSearchChunkResult[], ... }` — not a bare
  // chunk, so each flattened element nests its chunks under `.chunks` and
  // carries `item_id`/`item_name`/`chunk_content` one level deeper than the
  // knowledge-base tool's output. A context with no embedder configured
  // contributes a bare string (its error message) instead of a response
  // object — not evidence, so it must not surface as a source.
  it("finds each item's chunks nested under a per-context search response, joining a multi-chunk item", () => {
    const message = {
      parts: [{
        type: "tool-session_items_information_context_search",
        toolCallId: "call_5",
        output: {
          result: JSON.stringify([
            {
              context: { name: "Handbücher", id: "ctx_1" },
              chunks: [
                { item_id: "i1", item_name: "wartung.pdf", chunk_content: "230 Volt." },
                { item_id: "i1", item_name: "wartung.pdf", chunk_content: "Jährliche Wartung." },
              ],
            },
          ]),
        },
      }],
    } as unknown as UIMessage;
    expect(collectSources(message, [{ type: "session_item", id: "tool:call_5", toolCallId: "call_5" }])).toEqual([
      { id: "tool:call_5#i1", name: "wartung.pdf", type: "session_item", content: "230 Volt.\n\nJährliche Wartung." },
    ]);
  });

  it("skips a context's bare embedder-not-configured error string rather than sending it as evidence", () => {
    const message = {
      parts: [{
        type: "tool-session_items_information_context_search",
        toolCallId: "call_5",
        output: { result: JSON.stringify(["Embedder not configured for context ctx_2."]) },
      }],
    } as unknown as UIMessage;
    expect(collectSources(message, [{ type: "session_item", id: "tool:call_5", toolCallId: "call_5" }])).toEqual([]);
  });

  it("returns an empty array when there are no chunks to recover", () => {
    const message = {
      parts: [{
        type: "tool-session_items_information_context_search",
        toolCallId: "call_5",
        output: { result: JSON.stringify([{ context: { name: "Leer", id: "ctx_1" }, chunks: [] }]) },
      }],
    } as unknown as UIMessage;
    expect(collectSources(message, [{ type: "session_item", id: "tool:call_5", toolCallId: "call_5" }])).toEqual([]);
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
