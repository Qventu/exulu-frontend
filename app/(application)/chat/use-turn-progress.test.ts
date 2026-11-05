// @vitest-environment jsdom
/**
 * useTurnProgress — Task 10 (artifact-agent-panel plan): the signal that lets
 * an artifact beside the chat panel refetch its own data while the agent
 * works, not just when the turn ends.
 *
 * Two independent sources bump the SAME counter:
 *  - a tool part reaching a terminal state (`output-available` or
 *    `output-error`) in `controller.messages`;
 *  - the `streaming -> ready` transition in `controller.status`.
 *
 * Deliberately NOT testing via `onToolCall` (hooks.ts) — that callback fires
 * when a tool is *called*, before it has run, which is exactly the wrong
 * signal this hook exists to avoid (see the hook's own doc comment).
 *
 * jsdom (not node) because `renderHook` mounts a real component tree.
 */
import { cleanup, renderHook } from "@testing-library/react";
import type { DynamicToolUIPart, UIMessage } from "ai";
import { afterEach, describe, expect, test } from "vitest";

import type { ChatSessionController } from "./hooks";
import { useTurnProgress } from "./use-turn-progress";

afterEach(cleanup);

type Controller = Pick<ChatSessionController, "messages" | "status">;

/** One tool call, at a given state, wrapped in its own assistant message. */
function toolMessage(part: DynamicToolUIPart): UIMessage {
  return { id: `m-${part.toolCallId}`, role: "assistant", parts: [part] };
}

const running = (toolCallId: string): DynamicToolUIPart => ({
  type: "dynamic-tool",
  toolName: "search",
  toolCallId,
  state: "input-available",
  input: { query: "x" },
});

const done = (toolCallId: string): DynamicToolUIPart => ({
  type: "dynamic-tool",
  toolName: "search",
  toolCallId,
  state: "output-available",
  input: { query: "x" },
  output: { result: "ok" },
});

const failed = (toolCallId: string): DynamicToolUIPart => ({
  type: "dynamic-tool",
  toolName: "search",
  toolCallId,
  state: "output-error",
  input: { query: "x" },
  errorText: "boom",
});

const mount = (initial: Controller) =>
  renderHook((props: Controller) => useTurnProgress(props), {
    initialProps: initial,
  });

describe("useTurnProgress", () => {
  test("bumps once when a tool part reaches output-available", () => {
    const { result, rerender } = mount({ messages: [], status: "streaming" });
    expect(result.current.nonce).toBe(0);

    rerender({ messages: [toolMessage(done("c1"))], status: "streaming" });

    expect(result.current).toEqual({ nonce: 1, reason: "tool" });
  });

  test("bumps for output-error too — the artifact should refetch either way", () => {
    const { result, rerender } = mount({ messages: [], status: "streaming" });

    rerender({ messages: [toolMessage(failed("c1"))], status: "streaming" });

    expect(result.current).toEqual({ nonce: 1, reason: "tool" });
  });

  test("does not bump again for the same toolCallId", () => {
    // re-render with the same parts → nonce unchanged
    const part = done("c1");
    const { result, rerender } = mount({
      messages: [toolMessage(part)],
      status: "streaming",
    });
    // The very first render already observes a terminal part it has never
    // seen before — that is itself a bump, not a no-op baseline.
    expect(result.current.nonce).toBe(1);

    rerender({ messages: [toolMessage(part)], status: "streaming" });

    expect(result.current.nonce).toBe(1);
  });

  test("bumps on the streaming → ready transition with reason 'turn'", () => {
    const { result, rerender } = mount({ messages: [], status: "streaming" });

    rerender({ messages: [], status: "ready" });

    expect(result.current).toEqual({ nonce: 1, reason: "turn" });
  });

  test("does not bump on an unrelated re-render", () => {
    const messages: UIMessage[] = [];
    const { result, rerender } = mount({ messages, status: "streaming" });

    // Same messages, same status — nothing about the turn or its tools
    // changed, only the component re-rendered.
    rerender({ messages, status: "streaming" });

    expect(result.current.nonce).toBe(0);
  });

  test("does not bump for a tool part still input-available", () => {
    const { result, rerender } = mount({ messages: [], status: "streaming" });

    rerender({ messages: [toolMessage(running("c1"))], status: "streaming" });

    expect(result.current.nonce).toBe(0);
  });

  test("bumps once per distinct tool call completing in the same render", () => {
    // A dense artifact can finish several tool calls in one batched update
    // (e.g. a throttled render that lands two completions at once) — each
    // must still count, not collapse into a single bump.
    const { result, rerender } = mount({ messages: [], status: "streaming" });

    rerender({
      messages: [toolMessage(done("c1")), toolMessage(done("c2"))],
      status: "streaming",
    });

    expect(result.current.nonce).toBe(2);
  });
});
