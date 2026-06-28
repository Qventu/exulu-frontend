import { describe, test, expect } from "vitest";
import type { UIMessage } from "ai";
import {
  findTrajectoryRefForFeedback,
  trajectoryIdFromPart,
} from "./trajectory-ref";

// Minimal factories — only the fields the finder reads.
const ksPart = (trajectoryId: string | null) => ({
  type: "tool-knowledge_search",
  output: {
    result: JSON.stringify({
      chunks: [],
      ...(trajectoryId ? { trajectoryId } : {}),
    }),
  },
});
const textPart = (text: string) => ({ type: "text", text });
const msg = (id: string, role: "user" | "assistant", parts: unknown[]) =>
  ({ id, role, parts }) as unknown as UIMessage;

describe("trajectoryIdFromPart", () => {
  test("reads trajectoryId from a wrapped { result: json } output", () => {
    expect(trajectoryIdFromPart(ksPart("newton::abc"))).toBe("newton::abc");
  });
  test("reads trajectoryId present directly on output (future shape)", () => {
    expect(
      trajectoryIdFromPart({ output: { trajectoryId: "newton::xyz" } }),
    ).toBe("newton::xyz");
  });
  test("name-agnostic: any tool part whose output carries trajectoryId", () => {
    expect(
      trajectoryIdFromPart({
        type: "tool-something_else",
        output: { result: JSON.stringify({ trajectoryId: "a::b" }) },
      }),
    ).toBe("a::b");
  });
  test("null for malformed JSON, missing field, or no output", () => {
    expect(trajectoryIdFromPart({ output: { result: "{not json" } })).toBeNull();
    expect(
      trajectoryIdFromPart({ output: { result: JSON.stringify({ chunks: [] }) } }),
    ).toBeNull();
    expect(trajectoryIdFromPart(textPart("hi"))).toBeNull();
    expect(trajectoryIdFromPart(undefined)).toBeNull();
  });
});

describe("findTrajectoryRefForFeedback", () => {
  test("one retrieval part in the rated message", () => {
    const messages = [
      msg("u1", "user", [textPart("q")]),
      msg("a1", "assistant", [ksPart("T1"), textPart("ans")]),
    ];
    expect(findTrajectoryRefForFeedback(messages, "a1")).toBe("T1");
  });
  test("two retrieval parts → latest within the message", () => {
    const messages = [
      msg("a1", "assistant", [ksPart("T1"), ksPart("T2"), textPart("ans")]),
    ];
    expect(findTrajectoryRefForFeedback(messages, "a1")).toBe("T2");
  });
  test("rated text-only message → walks back to a prior assistant retrieval", () => {
    const messages = [
      msg("a1", "assistant", [ksPart("T1")]),
      msg("a2", "assistant", [textPart("ans")]),
    ];
    expect(findTrajectoryRefForFeedback(messages, "a2")).toBe("T1");
  });
  test("unbounded walk: crosses an intervening user message (late feedback)", () => {
    const messages = [
      msg("u1", "user", [textPart("q1")]),
      msg("a1", "assistant", [ksPart("T1"), textPart("ans1")]),
      msg("u2", "user", [textPart("q2 follow-up")]),
      msg("a2", "assistant", [textPart("ans2, no retrieval")]),
    ];
    expect(findTrajectoryRefForFeedback(messages, "a2")).toBe("T1");
  });
  test("no trajectory anywhere → null", () => {
    const messages = [
      msg("u1", "user", [textPart("q")]),
      msg("a1", "assistant", [textPart("ans")]),
    ];
    expect(findTrajectoryRefForFeedback(messages, "a1")).toBeNull();
  });
  test("unknown id / undefined messages → null", () => {
    expect(
      findTrajectoryRefForFeedback(
        [msg("a1", "assistant", [ksPart("T1")])],
        "nope",
      ),
    ).toBeNull();
    expect(findTrajectoryRefForFeedback(undefined, "a1")).toBeNull();
  });
});
