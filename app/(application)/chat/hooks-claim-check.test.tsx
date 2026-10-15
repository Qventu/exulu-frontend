// @vitest-environment jsdom
/**
 * Integration coverage for the two wiring behaviours a reader will notice if
 * they are wrong (task F4):
 *  1. A check fires once per finished assistant message, never again on a
 *     re-render — `useChatSession` re-renders constantly, and a naive effect
 *     would re-post (and re-pay for) the same check on every one of them.
 *  2. A session reopened mid-check (or one whose check never finished
 *     server-side) must not show a stuck "running" state forever — only a
 *     stream that actually ends *during this session* fires a fresh check;
 *     a message with no stored row simply gets no `claimChecks` entry.
 *
 * `useChat` (the AI SDK transport) is mocked out entirely: these two
 * behaviours are about this hook's own effects, not about streaming itself,
 * and a controllable `status`/`messages` pair is the simplest way to drive
 * them deterministically. `@apollo/client`'s `useQuery`/`useMutation` are
 * stubbed too — the GraphQL side of `useChatSession` is untouched by this
 * task and irrelevant to what's under test here.
 */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";

import de from "@/messages/de.json";
import { ConfigContext, type ConfigContextType } from "@/components/shell/config-context";
import { LanguageProvider } from "@/components/shell/language-provider";
import { UserContext } from "@/app/(application)/authenticated";
import type { Agent } from "@/types/models/agent";
import type { AgentSession } from "@/types/models/agent-session";
import type { ClaimCheckResult } from "@/lib/api/claim-check";

vi.mock("@ai-sdk/react", () => ({ useChat: vi.fn() }));
vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: undefined, previousData: undefined, loading: false, refetch: vi.fn() })),
    useMutation: vi.fn(() => [vi.fn(), { loading: false }]),
  };
});
vi.mock("@/lib/api/session-files", () => ({
  sessionFilesApi: { list: vi.fn().mockResolvedValue({ files: [] }) },
}));
vi.mock("@/lib/api/claim-check", () => ({
  postClaimCheck: vi.fn(),
  getSessionClaimChecks: vi.fn(),
}));
vi.mock("@/lib/demo/flag", () => ({ isDemoMode: vi.fn(() => false) }));

import { useChat } from "@ai-sdk/react";
import { isDemoMode } from "@/lib/demo/flag";
import { getSessionClaimChecks, postClaimCheck } from "@/lib/api/claim-check";
import { useChatSession } from "./hooks";

const mockUseChat = vi.mocked(useChat);
const mockPostClaimCheck = vi.mocked(postClaimCheck);
const mockGetSessionClaimChecks = vi.mocked(getSessionClaimChecks);
const mockIsDemoMode = vi.mocked(isDemoMode);

const AGENT: Agent = {
  id: "a1",
  type: "agent",
  name: "Agent",
  slug: "/agents/run",
  model: "gpt-x",
  suggestions_enabled: false,
};

const SESSION: AgentSession = {
  id: "s1",
  createdAt: "",
  updatedAt: "",
  agent: "a1",
  project: "",
  title: "t",
  metadata: {},
  created_by: 0, // falsy — skips the creatorQuery, irrelevant here
  session_items: [],
  rights_mode: "private",
};

const CONFIG: ConfigContextType = {
  backend: "http://backend/",
  google_client_id: "",
  auth_mode: "regular",
} as ConfigContextType;

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ConfigContext.Provider value={CONFIG}>
      <UserContext.Provider value={{ user: { id: 1, super_admin: true } }}>
        <LanguageProvider initialLocale="de" initialMessages={de}>
          {children}
        </LanguageProvider>
      </UserContext.Provider>
    </ConfigContext.Provider>
  );
}

const userMessage = (id: string, text: string): UIMessage =>
  ({ id, role: "user", parts: [{ type: "text", text }] }) as unknown as UIMessage;

/** An assistant message carrying the backend's trigger fragment, with a
 *  matching retrieval-tool part so `collectSources` can recover its one
 *  named source — i.e. a message `claimCheckRequestFor` will actually post. */
const triggeredAssistantMessage = (id: string, text: string): UIMessage =>
  ({
    id,
    role: "assistant",
    metadata: { claimCheck: { enabled: true, sources: [{ type: "knowledge_base", id: "i1", toolCallId: "call_1" }] } },
    parts: [
      {
        type: "tool-Context_Search",
        toolCallId: "call_1",
        output: { result: JSON.stringify({ chunks: [{ item_id: "i1", item_name: "h.pdf", chunk_content: "230 Volt." }] }) },
      },
      { type: "text", text },
    ],
  }) as unknown as UIMessage;

/** The same message mid-turn: paused on an approval-gated tool, so the
 *  answer so far is only the first fragment. The SDK reports `ready` here —
 *  the backend emitted `finish` — which is exactly the trap. */
const pausedAssistantMessage = (id: string, text: string, state: string): UIMessage =>
  ({
    id,
    role: "assistant",
    metadata: { claimCheck: { enabled: true, sources: [{ type: "knowledge_base", id: "i1", toolCallId: "call_1" }] } },
    parts: [
      {
        type: "tool-Context_Search",
        toolCallId: "call_1",
        output: { result: JSON.stringify({ chunks: [{ item_id: "i1", item_name: "h.pdf", chunk_content: "230 Volt." }] }) },
      },
      { type: "text", text },
      { type: "tool-jira_create", toolCallId: "call_2", state },
    ],
  }) as unknown as UIMessage;

const STUB_RESULT: ClaimCheckResult = {
  status: "ok",
  score: { claims: 1, supported: 1, contradicted: 0, unsupported: 0, unsupportedShare: 0, label: "ok" },
  sentences: [{ index: 0, start: 0, end: 10, state: "checked", claimIds: ["c1"] }],
  claims: [
    {
      id: "c1",
      sentenceIndex: 0,
      text: "Die FST-2XT arbeitet mit 230 Volt.",
      inferred: false,
      verdict: "supported",
      evidence: [{ sourceId: "i1", quote: "230 Volt" }],
      rationale: "ok",
      rechecked: false,
    },
  ],
  usage: { calls: 8, inputTokens: 1, outputTokens: 1 },
  timings: {},
  limits: { truncated: false, sentencesSkipped: 0 },
  notes: [],
};

type ChatReturn = ReturnType<typeof useChat>;

function chatReturn(messages: UIMessage[], status: ChatReturn["status"]): ChatReturn {
  return {
    messages,
    status,
    sendMessage: vi.fn(),
    stop: vi.fn(),
    regenerate: vi.fn(),
    setMessages: vi.fn(),
    addToolApprovalResponse: vi.fn(),
  } as unknown as ChatReturn;
}

afterEach(() => {
  // vitest.config.ts sets no `test.globals`, so testing-library's implicit
  // afterEach(cleanup) registration never fires here. renderHook mounts
  // through render() under the hood, so without this each case's
  // useChatSession tree — and its live effects — stays attached to
  // document.body for the rest of the file (see claim-check.test.tsx, which
  // already does this for the same reason).
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockGetSessionClaimChecks.mockResolvedValue({});
  mockPostClaimCheck.mockResolvedValue(STUB_RESULT);
  mockIsDemoMode.mockReturnValue(false);
});

describe("useChatSession — claim check wiring (F4)", () => {
  it("does not get stuck at \"running\" when an incidental re-render (new messages reference, same status) happens while the post is still in flight", async () => {
    const user = userMessage("msg_0", "Womit?");
    const assistant = triggeredAssistantMessage("msg_1", "Die FST-2XT arbeitet mit 230 Volt.");

    let resolvePost: ((v: ClaimCheckResult) => void) | undefined;
    mockPostClaimCheck.mockImplementationOnce(
      () =>
        new Promise<ClaimCheckResult>((resolve) => {
          resolvePost = resolve;
        }),
    );

    mockUseChat.mockReturnValue(chatReturn([user, assistant], "streaming"));
    const { result, rerender } = renderHook(
      () =>
        useChatSession({
          agent: AGENT,
          initialSession: SESSION,
          initialMessages: [user, assistant],
          beginLazyCreate: () => () => {},
        }),
      { wrapper: Wrapper },
    );

    // Stream ends — fires, and the post is now pending (not yet resolved).
    mockUseChat.mockReturnValue(chatReturn([user, assistant], "ready"));
    await act(async () => {
      rerender();
    });
    await waitFor(() => expect(mockPostClaimCheck).toHaveBeenCalledTimes(1));
    expect(result.current.claimChecks.msg_1).toEqual({ status: "running" });

    // An incidental re-render — status unchanged, but `messages` is a new
    // array (the AI SDK recreates it on almost every tick) — happens *while*
    // the post is still in flight. This must not be mistaken for "this
    // instance is gone, discard the eventual result": nothing about the
    // session or the component changed, so the cancellation guard here must
    // be tied to a longer-lived signal than this effect's own dependency
    // array (see `aliveRef`, not a per-run `cancelled` closure).
    mockUseChat.mockReturnValue(chatReturn([{ ...user }, { ...assistant }], "ready"));
    await act(async () => {
      rerender();
    });

    // Now the post resolves.
    await act(async () => {
      resolvePost?.(STUB_RESULT);
    });

    expect(result.current.claimChecks.msg_1).toEqual({ status: "done", result: STUB_RESULT });
  });

  it("fires the check exactly once when the stream ends, and a later re-render does not re-fire it", async () => {
    const user = userMessage("msg_0", "Womit?");
    const assistant = triggeredAssistantMessage("msg_1", "Die FST-2XT arbeitet mit 230 Volt.");

    mockUseChat.mockReturnValue(chatReturn([user, assistant], "streaming"));

    const { result, rerender } = renderHook(
      () =>
        useChatSession({
          agent: AGENT,
          initialSession: SESSION,
          initialMessages: [user, assistant],
          beginLazyCreate: () => () => {},
        }),
      { wrapper: Wrapper },
    );

    // Still streaming: no check yet.
    expect(mockPostClaimCheck).not.toHaveBeenCalled();
    expect(result.current.claimChecks.msg_1).toBeUndefined();

    // The stream ends.
    mockUseChat.mockReturnValue(chatReturn([user, assistant], "ready"));
    await act(async () => {
      rerender();
    });

    await waitFor(() => expect(mockPostClaimCheck).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.claimChecks.msg_1).toEqual({ status: "done", result: STUB_RESULT }));

    // Unrelated re-renders with the status unchanged but a fresh `messages`
    // array each time (the AI SDK recreates it on virtually every tick) —
    // the naive bug this guards against re-posts on exactly this churn.
    mockUseChat.mockReturnValue(chatReturn([{ ...user }, { ...assistant }], "ready"));
    await act(async () => {
      rerender();
    });
    mockUseChat.mockReturnValue(chatReturn([{ ...user }, { ...assistant }], "ready"));
    await act(async () => {
      rerender();
    });

    expect(mockPostClaimCheck).toHaveBeenCalledTimes(1);
  });

  it("does not re-fire for the same message id across a second streaming -> ready transition (the claimCheckFired guard, not just the status-transition one)", async () => {
    const user = userMessage("msg_0", "Womit?");
    const assistant = triggeredAssistantMessage("msg_1", "Die FST-2XT arbeitet mit 230 Volt.");

    mockUseChat.mockReturnValue(chatReturn([user, assistant], "streaming"));
    const { rerender } = renderHook(
      () =>
        useChatSession({
          agent: AGENT,
          initialSession: SESSION,
          initialMessages: [user, assistant],
          beginLazyCreate: () => () => {},
        }),
      { wrapper: Wrapper },
    );

    mockUseChat.mockReturnValue(chatReturn([user, assistant], "ready"));
    await act(async () => {
      rerender();
    });
    await waitFor(() => expect(mockPostClaimCheck).toHaveBeenCalledTimes(1));

    // A second streaming -> ready cycle for the very same message id (e.g. a
    // reconnect replaying the tail of the same turn). The status-transition
    // guard alone would permit this — prev really was "streaming" again —
    // so only `claimCheckFired` having already seen this id stops a repost.
    mockUseChat.mockReturnValue(chatReturn([user, assistant], "streaming"));
    await act(async () => {
      rerender();
    });
    mockUseChat.mockReturnValue(chatReturn([user, assistant], "ready"));
    await act(async () => {
      rerender();
    });

    expect(mockPostClaimCheck).toHaveBeenCalledTimes(1);
  });

  // I1: a turn that pauses for tool approval emits `finish` and the SDK sets
  // status "ready", so the effect fired a paid check on the half-answer —
  // and because the SDK resumes the SAME assistant message id, the fired-set
  // then blocked the real check. The panel under the complete answer carried
  // a score computed over its first fragment, with `status: "ok"` and no
  // incompleteness marker; a claim whose supporting retrieval happened after
  // the pause can read `unsupported`, which the stored row then makes
  // permanent.
  it.each(["approval-requested", "approval-responded"])(
    "does not fire while the turn is paused on a %s tool part, and checks the complete answer once it resumes",
    async (pausedState) => {
      const user = userMessage("msg_0", "Womit und bitte ein Ticket?");
      const paused = pausedAssistantMessage("msg_1", "Die FST-2XT arbeitet mit 230 Volt.", pausedState);

      mockUseChat.mockReturnValue(chatReturn([user, paused], "streaming"));
      const { result, rerender } = renderHook(
        () =>
          useChatSession({
            agent: AGENT,
            initialSession: SESSION,
            initialMessages: [user, paused],
            beginLazyCreate: () => () => {},
          }),
        { wrapper: Wrapper },
      );

      // The backend's `finish` arrives with the approval still outstanding:
      // streaming -> ready, but the turn is not over.
      mockUseChat.mockReturnValue(chatReturn([user, paused], "ready"));
      await act(async () => {
        rerender();
      });
      await act(async () => {});
      expect(mockPostClaimCheck).not.toHaveBeenCalled();
      expect(result.current.claimChecks.msg_1).toBeUndefined();

      // The user answers; `sendAutomaticallyWhen` resumes the turn on the
      // same message id.
      mockUseChat.mockReturnValue(chatReturn([user, paused], "streaming"));
      await act(async () => {
        rerender();
      });

      // The turn really finishes: the approved tool has its output and the
      // answer has its second half.
      const complete = triggeredAssistantMessage("msg_1", "Die FST-2XT arbeitet mit 230 Volt.");
      (complete.parts as unknown[]).push(
        { type: "tool-jira_create", toolCallId: "call_2", state: "output-available", output: { ok: true } },
        { type: "text", text: "Das Ticket ist angelegt." },
      );
      mockUseChat.mockReturnValue(chatReturn([user, complete], "ready"));
      await act(async () => {
        rerender();
      });

      await waitFor(() => expect(mockPostClaimCheck).toHaveBeenCalledTimes(1));
      // The body is the WHOLE answer, not the fragment that was on screen
      // when the approval card appeared.
      expect(mockPostClaimCheck.mock.calls[0]![0]!.answer).toBe(
        "Die FST-2XT arbeitet mit 230 Volt.\n\nDas Ticket ist angelegt.",
      );
    },
  );

  it("rehydrates a stored check on session open without re-posting it", async () => {
    const user = userMessage("msg_0", "Womit?");
    const assistant = triggeredAssistantMessage("msg_done", "Die FST-2XT arbeitet mit 230 Volt.");

    // Mounts already "ready" — a reload, not a live stream in this tab.
    mockUseChat.mockReturnValue(chatReturn([user, assistant], "ready"));
    mockGetSessionClaimChecks.mockResolvedValue({ msg_done: STUB_RESULT });

    const { result } = renderHook(
      () =>
        useChatSession({
          agent: AGENT,
          initialSession: SESSION,
          initialMessages: [user, assistant],
          beginLazyCreate: () => () => {},
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(mockGetSessionClaimChecks).toHaveBeenCalledWith("s1"));
    await waitFor(() => expect(result.current.claimChecks.msg_done).toEqual({ status: "done", result: STUB_RESULT }));

    // The trigger fragment is still on the message (the backend persists it),
    // so the only thing that stopped a live re-check is the reload not
    // reading as "a stream just ended" in this tab.
    expect(mockPostClaimCheck).not.toHaveBeenCalled();
  });

  it("leaves no entry for a message whose check never completed server-side — not a stuck running state", async () => {
    const user = userMessage("msg_0", "Womit?");
    const assistant = triggeredAssistantMessage("msg_gone", "Die FST-2XT arbeitet mit 230 Volt.");

    // Mounts already "ready", and the server has no stored row for msg_gone
    // (the check started but never finished before the backend went away).
    mockUseChat.mockReturnValue(chatReturn([user, assistant], "ready"));
    mockGetSessionClaimChecks.mockResolvedValue({});

    const { result } = renderHook(
      () =>
        useChatSession({
          agent: AGENT,
          initialSession: SESSION,
          initialMessages: [user, assistant],
          beginLazyCreate: () => () => {},
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(mockGetSessionClaimChecks).toHaveBeenCalledWith("s1"));
    // Flush any remaining microtasks from the rehydrate effect settling.
    await act(async () => {});

    expect(result.current.claimChecks.msg_gone).toBeUndefined();
    expect(mockPostClaimCheck).not.toHaveBeenCalled();
  });

  // M2: `request` answers null for any demo-mode path it has no fixture for,
  // so the panel would have dereferenced a null result. The sibling
  // follow-up-suggestions effect short-circuits on isDemoMode() for exactly
  // this reason.
  it("never fires in demo mode", async () => {
    mockIsDemoMode.mockReturnValue(true);
    const user = userMessage("msg_0", "Womit?");
    const assistant = triggeredAssistantMessage("msg_1", "Die FST-2XT arbeitet mit 230 Volt.");

    mockUseChat.mockReturnValue(chatReturn([user, assistant], "streaming"));
    const { result, rerender } = renderHook(
      () =>
        useChatSession({
          agent: AGENT,
          initialSession: SESSION,
          initialMessages: [user, assistant],
          beginLazyCreate: () => () => {},
        }),
      { wrapper: Wrapper },
    );

    mockUseChat.mockReturnValue(chatReturn([user, assistant], "ready"));
    await act(async () => {
      rerender();
    });
    await act(async () => {});

    expect(mockPostClaimCheck).not.toHaveBeenCalled();
    expect(mockGetSessionClaimChecks).not.toHaveBeenCalled();
    expect(result.current.claimChecks.msg_1).toBeUndefined();
  });
});
