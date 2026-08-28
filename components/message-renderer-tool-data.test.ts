import type { DynamicToolUIPart } from "ai";
import { describe, expect, it, vi } from "vitest";

import {
  computeContextSearchData,
  computeUntypedToolData,
  getCachedToolData,
  messageItemPropsEqual,
  type ToolDataCache,
} from "./message-renderer-tool-data";

const toolPart = (overrides: Record<string, unknown>): DynamicToolUIPart =>
  ({
    type: "dynamic-tool",
    toolName: "some_tool",
    toolCallId: "call-1",
    state: "output-available",
    input: {},
    ...overrides,
  }) as unknown as DynamicToolUIPart;

describe("computeUntypedToolData", () => {
  it("parses a JSON-string result on an object output into a copied part (input part untouched)", () => {
    const output = { result: JSON.stringify({ answer: 42 }) };
    const part = toolPart({ output });
    const data = computeUntypedToolData(part);

    expect(data.ok).toBe(true);
    expect((data.part.output as any).result).toEqual({ answer: 42 });
    // No in-place mutation (the legacy code mutated part.output.result).
    expect(output.result).toBe(JSON.stringify({ answer: 42 }));
    expect(data.part).not.toBe(part);
  });

  it("keeps the part unchanged when output is a JSON string (legacy parity: raw part passed on)", () => {
    const part = toolPart({ output: JSON.stringify({ result: { a: 1 } }) });
    const data = computeUntypedToolData(part);
    expect(data.ok).toBe(true);
    expect(data.part).toBe(part);
  });

  it("treats a non-JSON string output as plain text instead of failing", () => {
    const part = toolPart({ output: "not json at all" });
    const data = computeUntypedToolData(part);
    expect(data.ok).toBe(true);
    expect(data.part).toBe(part);
  });

  it("treats an unparseable output.result as text, like a bare string output", () => {
    // This asserted ok=false — "legacy: render nothing" — until the demo work
    // showed what that costs. The caller turns ok=false into `return null`, so
    // a tool whose result is a plain status string is visible WHILE IT RUNS
    // and disappears when it succeeds, because success is when the unparseable
    // output arrives. Newlift's memory writes return "Created Newton Memory
    // Item with the following ID: …", so every remembered fact vanished from
    // the transcript at the moment it was remembered.
    //
    // The asymmetry was never a decision. A bare non-JSON string output has
    // always rendered as text (the case above), and the oauth/credential guard
    // further up exists precisely because that text also hit this branch and
    // rendered nothing — the same bug, patched narrowly. This aligns the
    // wrapped case with the bare one.
    const part = toolPart({ output: { result: "{broken" } });
    const data = computeUntypedToolData(part);
    expect(data.ok).toBe(true);
    // Passed through unchanged: nothing parsed, so there is nothing to swap in.
    expect(data.part).toBe(part);
  });

  it("passes through an output with no result and undefined output", () => {
    expect(computeUntypedToolData(toolPart({ output: undefined })).ok).toBe(true);
    const part = toolPart({ output: { content: "x" } });
    const data = computeUntypedToolData(part);
    expect(data.ok).toBe(true);
    expect(data.part).toBe(part);
  });

  it("passes an oauth short-circuit output through with ok=true despite the non-JSON result text", () => {
    const output = {
      result: "Authorization required. Show the user this link: https://auth.atlassian.com/authorize?x=1",
      oauth: { authorizationUrl: "https://auth.atlassian.com/authorize?x=1" },
    };
    const part = toolPart({ output });
    const data = computeUntypedToolData(part);
    expect(data.ok).toBe(true);
    expect((data.part.output as any).oauth.authorizationUrl).toContain("atlassian");
  });

  it("passes a credentialRequest short-circuit output through with ok=true", () => {
    const output = {
      credentialRequest: {
        provider: "moco",
        fields: [],
        submitUrl: "http://localhost:9001/credentials/submit",
        nonce: "n",
      },
      result: null,
    };
    const part = toolPart({ output });
    const data = computeUntypedToolData(part);
    expect(data.ok).toBe(true);
    expect((data.part.output as any).credentialRequest.provider).toBe("moco");
  });

  it("detects the image_generation_widget result shape", () => {
    const widget = { type: "image_generation_widget", prompt: "p" };
    const data = computeUntypedToolData(
      toolPart({ output: { result: JSON.stringify(widget) } }),
    );
    expect(data.imageWidget).toEqual(widget);
    expect(data.imageInline).toBeUndefined();
  });

  it("detects the legacy inline image_generation result shape", () => {
    const data = computeUntypedToolData(
      toolPart({
        output: {
          result: {
            type: "image_generation",
            url: "https://img",
            prompt: "p",
            revised_prompt: "rp",
            model: "m",
          },
        },
      }),
    );
    expect(data.imageInline).toEqual({
      url: "https://img",
      prompt: "p",
      revisedPrompt: "rp",
      model: "m",
    });
  });

  it("extracts reasoning and a metrics line from an agentic result", () => {
    const result = {
      chunks: [],
      reasoning: [{ text: "step", tools: [] }],
      metrics: { inputTokens: 10, outputTokens: 5 },
    };
    const data = computeUntypedToolData(toolPart({ output: { result } }));
    expect(data.reasoning).toEqual([{ text: "step", tools: [] }]);
    expect(data.metricsLine).toContain("10 in / 5 out tokens");
  });
});

describe("computeContextSearchData", () => {
  const chunk = (itemId: string, ctx: string) => ({
    item_id: itemId,
    item_name: `name-${itemId}`,
    item_external_id: `ext-${itemId}`,
    item_created_at: "2026-01-01",
    item_updated_at: "2026-01-02",
    context: { name: ctx, id: `ctx-${ctx}` },
  });

  it("groups chunks by item and joins context names", () => {
    const chunks = [chunk("a", "docs_ctx"), chunk("a", "docs_ctx"), chunk("b", "web_ctx")];
    const data = computeContextSearchData({ output: { result: { chunks } } });
    expect(data).not.toBeNull();
    expect(data!.items).toHaveLength(2);
    expect(data!.items[0].chunks).toHaveLength(2);
    expect(data!.totalChunks).toBe(3);
    expect(data!.contextNames).toBe("docs ctx, web ctx");
  });

  it("handles array results (chunks directly) with empty reasoning", () => {
    const data = computeContextSearchData({
      output: { result: JSON.stringify([chunk("a", "ctx")]) },
    });
    expect(data).not.toBeNull();
    expect(data!.reasoning).toEqual([]);
    expect(data!.totalChunks).toBe(1);
  });

  it("returns null for unparseable output or result", () => {
    expect(computeContextSearchData({ output: "{broken" })).toBeNull();
    expect(computeContextSearchData({ output: { result: "{broken" } })).toBeNull();
  });
});

describe("getCachedToolData", () => {
  it("computes once for a terminal state and reuses the cached value", () => {
    const cache: ToolDataCache = new Map();
    const compute = vi.fn(() => ({ v: 1 }));
    const first = getCachedToolData(cache, "k", "output-available", compute);
    const second = getCachedToolData(cache, "k", "output-available", compute);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("recomputes every call for non-terminal states", () => {
    const cache: ToolDataCache = new Map();
    const compute = vi.fn(() => ({}));
    getCachedToolData(cache, "k", "input-streaming", compute);
    getCachedToolData(cache, "k", "input-streaming", compute);
    expect(compute).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(0);
  });

  it("recomputes when the state transitions, then caches the terminal result", () => {
    const cache: ToolDataCache = new Map();
    let calls = 0;
    const compute = () => ({ call: ++calls });
    getCachedToolData(cache, "k", "input-available", compute);
    const terminal = getCachedToolData(cache, "k", "output-available", compute);
    const again = getCachedToolData(cache, "k", "output-available", compute);
    expect(terminal).toEqual({ call: 2 });
    expect(again).toBe(terminal);
  });

  it("caches null compute results too", () => {
    const cache: ToolDataCache = new Map();
    const compute = vi.fn(() => null);
    getCachedToolData(cache, "k", "output-error", compute);
    expect(getCachedToolData(cache, "k", "output-error", compute)).toBeNull();
    expect(compute).toHaveBeenCalledTimes(1);
  });
});

describe("messageItemPropsEqual", () => {
  const message = { id: "m1" };
  const base = {
    message,
    isLastMessage: false,
    streamingLabel: null as string | null,
    config: { marginTopFirstMessage: "mt-6" },
    onTtsClick: () => {},
    UntypedToolPartComponent: function Tool() {
      return null;
    },
  };

  it("ignores handler identity but compares data props", () => {
    expect(
      messageItemPropsEqual(base, { ...base, onTtsClick: () => {} }),
    ).toBe(true);
    expect(
      messageItemPropsEqual(base, { ...base, message: { id: "m1" } }),
    ).toBe(false);
    expect(messageItemPropsEqual(base, { ...base, isLastMessage: true })).toBe(
      false,
    );
    expect(
      messageItemPropsEqual(base, { ...base, streamingLabel: "Thinking..." }),
    ).toBe(false);
  });

  it("compares component-type props by identity", () => {
    expect(
      messageItemPropsEqual(base, {
        ...base,
        UntypedToolPartComponent: function Other() {
          return null;
        },
      }),
    ).toBe(false);
  });

  it("compares config by its fields, not by object identity", () => {
    expect(
      messageItemPropsEqual(base, {
        ...base,
        config: { marginTopFirstMessage: "mt-6" },
      }),
    ).toBe(true);
    expect(
      messageItemPropsEqual(base, {
        ...base,
        config: { marginTopFirstMessage: "mt-12" },
      }),
    ).toBe(false);
    expect(messageItemPropsEqual({ ...base, config: undefined }, { ...base, config: undefined })).toBe(true);
  });
});
