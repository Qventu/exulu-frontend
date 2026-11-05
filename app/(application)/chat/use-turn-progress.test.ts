// @vitest-environment jsdom
/**
 * useTurnProgress / useProgressRelay — Task 10 (artifact-agent-panel plan):
 * the signal that lets an artifact beside the chat panel refetch its own
 * data while the agent works, not just when the turn ends.
 *
 * `useTurnProgress` derives a `{nonce, reason}` from the controller: a tool
 * part reaching a terminal state (`output-available`/`output-error`), or the
 * `streaming -> ready` transition. `enabled` (added in review round 2) gates
 * that work entirely, because `SessionScreenInner` runs this hook for every
 * ordinary chat session too, most of which never pass `onProgress` — see
 * the describe block below for the no-op-when-disabled contract and the
 * "stale prevStatusRef" edge case that gate has to avoid.
 *
 * `useProgressRelay` is the separately-extracted piece that turns a
 * `{nonce, reason}` into exactly one `onProgress` call per real change, with
 * no controller involved at all — see use-turn-progress.ts's doc comment for
 * why it was split out: it is the exact mechanism a prior review round
 * found untested (the mount-guard, and the "a batch of bumps collapses into
 * one outward call" behaviour).
 *
 * The last describe block composes both hooks exactly as `SessionScreenInner`
 * does, over a bare controller fixture, proving the two pieces' tests above
 * actually add up to the end-to-end behaviour rather than leaving that
 * composition to narrative reasoning.
 *
 * Deliberately NOT testing via `onToolCall` (hooks.ts) — that callback fires
 * when a tool is *called*, before it has run, which is exactly the wrong
 * signal this hook exists to avoid (see the hook's own doc comment).
 *
 * jsdom (not node) because `renderHook` mounts a real component tree.
 */
import { cleanup, renderHook } from "@testing-library/react";
import type { DynamicToolUIPart, UIMessage } from "ai";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { ChatSessionController } from "./hooks";
import {
  useProgressRelay,
  useTurnProgress,
  type TurnProgress,
} from "./use-turn-progress";

afterEach(cleanup);

type Controller = Pick<ChatSessionController, "messages" | "status">;
type Props = Controller & { enabled: boolean };
type Reason = "tool" | "turn";

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

const mount = (initial: Props) =>
  renderHook(
    (props: Props) =>
      useTurnProgress(
        { messages: props.messages, status: props.status },
        props.enabled,
      ),
    { initialProps: initial },
  );

describe("useTurnProgress", () => {
  test("bumps once when a tool part reaches output-available", () => {
    const { result, rerender } = mount({
      messages: [],
      status: "streaming",
      enabled: true,
    });
    expect(result.current.nonce).toBe(0);

    rerender({
      messages: [toolMessage(done("c1"))],
      status: "streaming",
      enabled: true,
    });

    expect(result.current).toEqual({ nonce: 1, reason: "tool" });
  });

  test("bumps for output-error too — the artifact should refetch either way", () => {
    const { result, rerender } = mount({
      messages: [],
      status: "streaming",
      enabled: true,
    });

    rerender({
      messages: [toolMessage(failed("c1"))],
      status: "streaming",
      enabled: true,
    });

    expect(result.current).toEqual({ nonce: 1, reason: "tool" });
  });

  test("does not bump again for the same toolCallId", () => {
    // re-render with the same parts → nonce unchanged
    const part = done("c1");
    const { result, rerender } = mount({
      messages: [toolMessage(part)],
      status: "streaming",
      enabled: true,
    });
    // The very first render already observes a terminal part it has never
    // seen before — that is itself a bump, not a no-op baseline.
    expect(result.current.nonce).toBe(1);

    rerender({ messages: [toolMessage(part)], status: "streaming", enabled: true });

    expect(result.current.nonce).toBe(1);
  });

  test("bumps on the streaming → ready transition with reason 'turn'", () => {
    const { result, rerender } = mount({
      messages: [],
      status: "streaming",
      enabled: true,
    });

    rerender({ messages: [], status: "ready", enabled: true });

    expect(result.current).toEqual({ nonce: 1, reason: "turn" });
  });

  test("does not bump on an unrelated re-render", () => {
    // A freshly-allocated message (and part) carrying the SAME toolCallId
    // and the SAME terminal state on every render — a new object identity
    // each time, so React's effect dependency ([messages, ...]) does not
    // bail out before the effect body ever runs. What actually has to do
    // the work here is the Set-based dedup, keyed on toolCallId, not on
    // object identity (review round 2: the previous version of this test
    // passed the identical array reference, which never exercised that).
    const { result, rerender } = mount({
      messages: [toolMessage(done("c1"))],
      status: "streaming",
      enabled: true,
    });
    expect(result.current.nonce).toBe(1); // already observed once, at mount

    rerender({
      messages: [toolMessage(done("c1"))],
      status: "streaming",
      enabled: true,
    });

    expect(result.current.nonce).toBe(1);
  });

  test("does not bump for a tool part still input-available", () => {
    const { result, rerender } = mount({
      messages: [],
      status: "streaming",
      enabled: true,
    });

    rerender({
      messages: [toolMessage(running("c1"))],
      status: "streaming",
      enabled: true,
    });

    expect(result.current.nonce).toBe(0);
  });

  test("bumps once per distinct tool call completing in the same render", () => {
    // A dense artifact can finish several tool calls in one batched update
    // (e.g. a throttled render that lands two completions at once) — each
    // must still count, not collapse into a single bump.
    const { result, rerender } = mount({
      messages: [],
      status: "streaming",
      enabled: true,
    });

    rerender({
      messages: [toolMessage(done("c1")), toolMessage(done("c2"))],
      status: "streaming",
      enabled: true,
    });

    expect(result.current.nonce).toBe(2);
  });

  describe("enabled: false — ordinary chat (no onProgress consumer) pays nothing", () => {
    test("does no state updates while disabled: a tool completion and a finished turn both land with nonce still 0", () => {
      const { result, rerender } = mount({
        messages: [],
        status: "streaming",
        enabled: false,
      });
      expect(result.current).toEqual({ nonce: 0, reason: "turn" });

      rerender({
        messages: [toolMessage(done("c1"))],
        status: "streaming",
        enabled: false,
      });
      expect(result.current).toEqual({ nonce: 0, reason: "turn" });

      rerender({
        messages: [toolMessage(done("c1"))],
        status: "ready",
        enabled: false,
      });
      // Same object as every render above: disabled means no `setProgress`
      // call ever happened, not merely that the visible count stayed 0.
      expect(result.current).toEqual({ nonce: 0, reason: "turn" });
    });

    test("keeps prevStatusRef current while disabled, so a later enable does not misread an old transition as new", () => {
      const { result, rerender } = mount({
        messages: [],
        status: "streaming",
        enabled: false,
      });

      // The REAL transition happens while nobody is listening.
      rerender({ messages: [], status: "ready", enabled: false });
      expect(result.current.nonce).toBe(0);

      // Enabling later, with status unchanged since that disabled render,
      // must not replay the old transition as if it were new: a `prev`
      // left stale at "streaming" would read THIS render as a fresh
      // "streaming -> ready" and fire a phantom "turn" bump for an event
      // that happened before anyone was watching.
      rerender({ messages: [], status: "ready", enabled: true });
      expect(result.current.nonce).toBe(0);

      // Enabling is not itself inert, though: a genuinely NEW transition
      // after that point is still caught normally.
      rerender({ messages: [], status: "streaming", enabled: true });
      rerender({ messages: [], status: "ready", enabled: true });
      expect(result.current).toEqual({ nonce: 1, reason: "turn" });
    });
  });
});

describe("useProgressRelay", () => {
  type RelayProps = { progress: TurnProgress; onProgress?: (reason: Reason) => void };

  const mountRelay = (initial: RelayProps) =>
    renderHook(
      (props: RelayProps) => useProgressRelay(props.progress, props.onProgress),
      { initialProps: initial },
    );

  test("does not call onProgress on mount, even when the first value handed in is already non-zero", () => {
    const onProgress = vi.fn();
    mountRelay({ progress: { nonce: 0, reason: "turn" }, onProgress });
    expect(onProgress).not.toHaveBeenCalled();

    // A relay used on its own (outside the exact composition in
    // session-screen.tsx) may see a non-zero `progress` on its very first
    // render — it must still not announce an event nobody caused on THIS
    // instance's watch.
    const onProgress2 = vi.fn();
    mountRelay({ progress: { nonce: 5, reason: "tool" }, onProgress: onProgress2 });
    expect(onProgress2).not.toHaveBeenCalled();
  });

  test("fires exactly once when the nonce jumps — a batch of bumps collapsed into one commit", () => {
    const onProgress = vi.fn();
    const { rerender } = mountRelay({
      progress: { nonce: 0, reason: "turn" },
      onProgress,
    });

    // `useTurnProgress` batches several `setProgress` calls from one effect
    // pass into a single next render; this is what that looks like from the
    // relay's side — one jump, never a sequence of +1 renders.
    rerender({ progress: { nonce: 3, reason: "tool" }, onProgress });

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith("tool");
  });

  test("does not fire again on a plain re-render with no change", () => {
    const onProgress = vi.fn();
    const { rerender } = mountRelay({
      progress: { nonce: 2, reason: "tool" },
      onProgress,
    });
    rerender({ progress: { nonce: 2, reason: "tool" }, onProgress }); // already settled

    rerender({ progress: { nonce: 2, reason: "tool" }, onProgress }); // unrelated re-render

    expect(onProgress).not.toHaveBeenCalled();
  });

  test("does nothing when there is no onProgress to call", () => {
    const { rerender } = mountRelay({ progress: { nonce: 0, reason: "turn" } });
    expect(() =>
      rerender({ progress: { nonce: 4, reason: "tool" } }),
    ).not.toThrow();
  });
});

describe("the composed pipeline, wired exactly as SessionScreenInner wires it", () => {
  const mountPipeline = (
    initial: Props,
    onProgress: (reason: Reason) => void,
  ) =>
    renderHook(
      (props: Props) => {
        const progress = useTurnProgress(
          { messages: props.messages, status: props.status },
          props.enabled,
        );
        useProgressRelay(progress, onProgress);
      },
      { initialProps: initial },
    );

  test("a batch of historical tool completions already in the first messages relays onProgress exactly once", () => {
    const onProgress = vi.fn();
    const messages = [
      toolMessage(done("c1")),
      toolMessage(done("c2")),
      toolMessage(done("c3")),
    ];

    mountPipeline({ messages, status: "streaming", enabled: true }, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith("tool");
  });

  test("a plain re-render with nothing new relays nothing", () => {
    const onProgress = vi.fn();
    const { rerender } = mountPipeline(
      { messages: [], status: "streaming", enabled: true },
      onProgress,
    );

    // A freshly-allocated, content-identical messages array — same
    // "nothing really changed" shape as the pure hook's own test above.
    rerender({ messages: [], status: "streaming", enabled: true });

    expect(onProgress).not.toHaveBeenCalled();
  });
});
