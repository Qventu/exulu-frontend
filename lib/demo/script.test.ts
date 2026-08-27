import { describe, expect, it } from "vitest";
import { buildChunks, type ScriptedTurn } from "./script";

const TURN: ScriptedTurn = {
  id: "m1",
  toolCalls: [
    {
      toolCallId: "tc1",
      toolName: "searchContexts",
      input: { query: "door contact fault" },
      output: { chunks: 7 },
    },
  ],
  text: "Check the door contact chain.",
  sources: [{ sourceId: "s1", url: "https://example.test/manual.pdf", title: "Manual" }],
};

describe("buildChunks", () => {
  it("emits the tool call before any assistant text", () => {
    const types = buildChunks(TURN).map((c) => c.type);
    expect(types.indexOf("tool-input-available")).toBeLessThan(types.indexOf("text-start"));
  });

  it("pairs every tool input with its output", () => {
    const chunks = buildChunks(TURN);
    expect(chunks.filter((c) => c.type === "tool-input-available")).toHaveLength(1);
    expect(chunks.filter((c) => c.type === "tool-output-available")).toHaveLength(1);
  });

  it("brackets text deltas with text-start and text-end", () => {
    const types = buildChunks(TURN).map((c) => c.type);
    expect(types.indexOf("text-start")).toBeLessThan(types.indexOf("text-delta"));
    expect(types.lastIndexOf("text-delta")).toBeLessThan(types.indexOf("text-end"));
  });

  it("reassembles to exactly the scripted text", () => {
    const text = buildChunks(TURN)
      .filter((c): c is Extract<typeof c, { type: "text-delta" }> => c.type === "text-delta")
      .map((c) => c.delta)
      .join("");
    expect(text).toBe(TURN.text);
  });

  it("uses one consistent id for the whole text block", () => {
    const ids = new Set(
      buildChunks(TURN)
        .filter((c) => c.type.startsWith("text-"))
        .map((c) => (c as { id: string }).id),
    );
    expect(ids).toEqual(new Set(["m1"]));
  });

  it("emits sources after the text ends", () => {
    const types = buildChunks(TURN).map((c) => c.type);
    expect(types.indexOf("text-end")).toBeLessThan(types.indexOf("source-url"));
  });

  it("handles a turn with no tool calls and no sources", () => {
    const chunks = buildChunks({ id: "m2", toolCalls: [], text: "Hi", sources: [] });
    expect(chunks.map((c) => c.type)).toEqual(["text-start", "text-delta", "text-end"]);
  });
});
