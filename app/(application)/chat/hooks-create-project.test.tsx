// @vitest-environment jsdom
/**
 * After the agent's create_project tool ran, the session row has a project the
 * chat opened without. The hook refetches the session once per finished call
 * and hands the new project id to useChatProjectFiles; chats reopened later
 * (call already in the history) never refetch.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";

import de from "@/messages/de.json";
import { ConfigContext, type ConfigContextType } from "@/components/shell/config-context";
import { LanguageProvider } from "@/components/shell/language-provider";
import { UserContext } from "@/app/(application)/authenticated";
import type { Agent } from "@/types/models/agent";
import type { AgentSession } from "@/types/models/agent-session";

vi.mock("@ai-sdk/react", () => ({ useChat: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/chat/a1/s1",
  useSearchParams: () => new URLSearchParams(),
}));

type Row = { project: string | null } | null;
// One response per lookup activation (the last one repeats); "error" simulates a failed request.
const lookup = vi.hoisted(() => ({ activations: 0, wasActive: false, responses: [{ project: "p1" }] as (Row | "error")[] }));
vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useQuery: vi.fn((_doc: unknown, options?: { skip?: boolean; pollInterval?: number; variables?: { id?: string } }) => {
      // The one-shot session lookup: active, for s1, not the catch-up poll.
      const isLookup = options?.skip === false && options.pollInterval === undefined && options.variables?.id === "s1";
      if (isLookup && !lookup.wasActive) lookup.activations += 1;
      lookup.wasActive = isLookup;
      const response = lookup.responses[Math.min(lookup.activations, lookup.responses.length) - 1];
      return {
        data: isLookup && response !== "error" ? { agent_sessionById: response } : undefined,
        error: isLookup && response === "error" ? new Error("boom") : undefined,
        previousData: undefined,
        loading: false,
        refetch: vi.fn(),
      };
    }),
    useMutation: vi.fn(() => [vi.fn(), { loading: false }]),
  };
});
vi.mock("@/lib/api/session-files", () => ({ sessionFilesApi: { list: vi.fn().mockResolvedValue({ files: [] }) } }));
vi.mock("@/lib/api/claim-check", () => ({ postClaimCheck: vi.fn(), getSessionClaimChecks: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/demo/flag", () => ({ isDemoMode: vi.fn(() => false) }));
vi.mock("./use-project-files", () => ({
  useChatProjectFiles: vi.fn(() => ({ projectFiles: null, refreshProjectFiles: vi.fn(), syncProjectFiles: vi.fn() })),
}));

import { useChat } from "@ai-sdk/react";
import { useChatProjectFiles } from "./use-project-files";
import { useChatSession } from "./hooks";

const mockUseChat = vi.mocked(useChat);
const mockProjectFiles = vi.mocked(useChatProjectFiles);

const AGENT: Agent = { id: "a1", type: "agent", name: "Agent", slug: "/agents/run", model: "gpt-x", suggestions_enabled: false };
const SESSION: AgentSession = {
  id: "s1", createdAt: "", updatedAt: "", agent: "a1", project: "", title: "t", metadata: {},
  created_by: 0, session_items: [], rights_mode: "private",
};
const CONFIG = { backend: "http://backend/", google_client_id: "", auth_mode: "regular" } as ConfigContextType;

// Stable identity: the hook resets itself when `user` changes, as the real context never does per render.
const USER_VALUE = { user: { id: 1, super_admin: true } };

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ConfigContext.Provider value={CONFIG}>
      <UserContext.Provider value={USER_VALUE}>
        <LanguageProvider initialLocale="de" initialMessages={de}>{children}</LanguageProvider>
      </UserContext.Provider>
    </ConfigContext.Provider>
  );
}

const call = (state: string, extra: Record<string, unknown> = {}) =>
  ({
    id: "m1", role: "assistant",
    parts: [{ type: "tool-create_project", toolCallId: "tc1", state, input: { name: "Alpha", files: [] }, ...extra }],
  }) as unknown as UIMessage;

function chatReturn(messages: UIMessage[], status = "streaming") {
  return {
    messages, status, sendMessage: vi.fn(), stop: vi.fn(), regenerate: vi.fn(),
    setMessages: vi.fn(), addToolApprovalResponse: vi.fn(),
  } as unknown as ReturnType<typeof useChat>;
}

const render = (initialMessages: UIMessage[], initialSession: AgentSession = SESSION) =>
  renderHook(
    () => useChatSession({ agent: AGENT, initialSession, initialMessages, beginLazyCreate: () => () => {} }),
    { wrapper: Wrapper },
  );

const lastProjectArg = () => mockProjectFiles.mock.calls.at(-1)?.[0];

beforeEach(() => {
  lookup.activations = 0;
  lookup.wasActive = false;
  lookup.responses = [{ project: "p1" }];
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useChatSession — project created by the agent", () => {
  it("refetches the session once when create_project finishes and passes the new project on", async () => {
    mockUseChat.mockReturnValue(chatReturn([call("approval-responded")]));
    const { rerender, result } = render([]);
    expect(lastProjectArg()).toBeNull();

    mockUseChat.mockReturnValue(chatReturn([call("output-available", { output: { result: "ok" } })]));
    await act(async () => rerender());
    expect(lastProjectArg()).toBe("p1");
    expect(result.current.session?.project).toBe("p1");

    // More ticks / re-renders: no second lookup.
    mockUseChat.mockReturnValue(chatReturn([call("output-available", { output: { result: "ok" } })], "ready"));
    await act(async () => rerender());
    await act(async () => rerender());
    expect(lookup.activations).toBe(1);
  });

  it("does not refetch for a finished call already in the history on mount", async () => {
    const done = call("output-available", { output: { result: "ok" } });
    mockUseChat.mockReturnValue(chatReturn([done], "ready"));
    const { rerender } = render([done], { ...SESSION, project: "p1" });
    await act(async () => rerender());
    expect(lookup.activations).toBe(0);
  });

  it("ignores preliminary, errored and denied calls", async () => {
    mockUseChat.mockReturnValue(chatReturn([call("output-available", { preliminary: true })]));
    const { rerender } = render([]);
    for (const state of ["output-error", "output-denied"]) {
      mockUseChat.mockReturnValue(chatReturn([call(state)]));
      await act(async () => rerender());
    }
    expect(lookup.activations).toBe(0);
    expect(lastProjectArg()).toBeNull();
  });

  it("gives up quietly after one retry when the row never gets a project", async () => {
    vi.useFakeTimers();
    try {
      lookup.responses = [{ project: null }];
      mockUseChat.mockReturnValue(chatReturn([call("approval-responded")]));
      const { rerender, result } = render([]);
      mockUseChat.mockReturnValue(chatReturn([call("output-available", { output: { result: "failed" } })]));
      await act(async () => rerender());
      expect(lookup.activations).toBe(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
      expect(lookup.activations).toBe(2);
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
      await act(async () => rerender());
      expect(lookup.activations).toBe(2);
      expect(lastProjectArg()).toBeNull();
      expect(result.current.session?.project).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("sets the project when the retry finds it", async () => {
    vi.useFakeTimers();
    try {
      lookup.responses = [{ project: null }, { project: "p2" }];
      mockUseChat.mockReturnValue(chatReturn([call("output-available", { output: { result: "ok" } })]));
      const { rerender, result } = render([]);
      await act(async () => rerender());
      expect(lastProjectArg()).toBeNull();
      await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
      expect(result.current.session?.project).toBe("p2");
      expect(lastProjectArg()).toBe("p2");
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears a lookup that resolves without a row, so a later call looks again", async () => {
    lookup.responses = [null, { project: "p1" }];
    mockUseChat.mockReturnValue(chatReturn([call("output-available", { output: { result: "ok" } })]));
    const { rerender, result } = render([]);
    await act(async () => rerender());
    expect(lookup.activations).toBe(1);
    expect(lastProjectArg()).toBeNull();

    const second = { ...call("output-available", { output: { result: "ok" } }) };
    (second.parts[0] as any).toolCallId = "tc2";
    mockUseChat.mockReturnValue(chatReturn([second]));
    await act(async () => rerender());
    expect(lookup.activations).toBe(2);
    expect(result.current.session?.project).toBe("p1");
  });

  it("clears a lookup that errors", async () => {
    lookup.responses = ["error", { project: "p1" }];
    mockUseChat.mockReturnValue(chatReturn([call("output-available", { output: { result: "ok" } })]));
    const { rerender } = render([]);
    await act(async () => rerender());
    expect(lookup.activations).toBe(1);
    const second = call("output-available", { output: { result: "ok" } });
    (second.parts[0] as any).toolCallId = "tc2";
    mockUseChat.mockReturnValue(chatReturn([second]));
    await act(async () => rerender());
    expect(lookup.activations).toBe(2);
  });

  it("does not drop a second call that finishes while the first lookup is retrying", async () => {
    vi.useFakeTimers();
    try {
      lookup.responses = [{ project: null }, { project: null }, { project: "p3" }];
      mockUseChat.mockReturnValue(chatReturn([call("output-available", { output: { result: "ok" } })]));
      const { rerender, result } = render([]);
      await act(async () => rerender());
      const second = call("output-available", { output: { result: "ok" } });
      (second.parts[0] as any).toolCallId = "tc2";
      mockUseChat.mockReturnValue(chatReturn([call("output-available", { output: { result: "ok" } }), second]));
      await act(async () => rerender());
      await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
      await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
      expect(result.current.session?.project).toBe("p3");
    } finally {
      vi.useRealTimers();
    }
  });

  it("discards a pending retry when the session switches", async () => {
    vi.useFakeTimers();
    try {
      lookup.responses = [{ project: null }, { project: "pX" }];
      mockUseChat.mockReturnValue(chatReturn([call("output-available", { output: { result: "ok" } })]));
      let session = SESSION;
      const { rerender, result } = renderHook(
        () => useChatSession({ agent: AGENT, initialSession: session, initialMessages: [], beginLazyCreate: () => () => {} }),
        { wrapper: Wrapper },
      );
      await act(async () => rerender());
      expect(lookup.activations).toBe(1);
      session = { ...SESSION, id: "s2" };
      mockUseChat.mockReturnValue(chatReturn([]));
      await act(async () => rerender());
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
      expect(lookup.activations).toBe(1);
      expect(result.current.session?.id).toBe("s2");
      expect(result.current.session?.project).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });
});
