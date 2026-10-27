// @vitest-environment jsdom
/**
 * Coming back to a conversation that was still being answered.
 *
 * The page is server-rendered from stored messages, so a turn finishing
 * elsewhere never reaches this tab on its own — these cases pin the two things
 * that make the answer show up and the marker clear: watching the session row
 * while it is working, and refreshing the route once it stops.
 *
 * Mock harness follows hooks-claim-check.test.tsx.
 */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
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
vi.mock("@/lib/api/session-files", () => ({
  sessionFilesApi: { list: vi.fn().mockResolvedValue({ files: [] }) },
}));
vi.mock("@/lib/api/claim-check", () => ({
  postClaimCheck: vi.fn().mockResolvedValue({}),
  getSessionClaimChecks: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/demo/flag", () => ({ isDemoMode: vi.fn(() => false) }));

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: nav.refresh, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/chat/a1/s1",
  useSearchParams: () => new URLSearchParams(),
}));

const gqlCalls = vi.hoisted(() => ({
  /** Every useQuery(document, options) the hook made, keyed by operation name. */
  queries: [] as { name: string; options: any }[],
  /** What the polled session-row query reports. */
  sessionRow: null as Record<string, unknown> | null,
  markSeen: vi.fn(),
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useMutation: vi.fn(() => [gqlCalls.markSeen, { loading: false }]),
    useQuery: vi.fn((document: any, options: any) => {
      const name = document?.definitions?.[0]?.name?.value ?? "unknown";
      gqlCalls.queries.push({ name, options });
      if (name === "GetAgentSessionById") {
        return {
          data: gqlCalls.sessionRow ? { agent_sessionById: gqlCalls.sessionRow } : undefined,
          previousData: undefined,
          loading: false,
          refetch: vi.fn(),
          startPolling: vi.fn(),
          stopPolling: vi.fn(),
        };
      }
      return {
        data: undefined,
        previousData: undefined,
        loading: false,
        refetch: vi.fn(),
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
      };
    }),
  };
});

import { useChat } from "@ai-sdk/react";
import { WORKING_POLL_MS } from "@/lib/session-activity";
import { subscribeToSessionActivity } from "@/lib/session-activity-signal";
import { useChatSession } from "./hooks";

const mockUseChat = vi.mocked(useChat);

const NOW = Date.now();
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const AGENT: Agent = {
  id: "a1",
  type: "agent",
  name: "Agent",
  slug: "/agents/run",
  model: "gpt-x",
  suggestions_enabled: false,
};

const session = (overrides: Partial<AgentSession> = {}): AgentSession =>
  ({
    id: "s1",
    createdAt: "",
    updatedAt: "",
    agent: "a1",
    project: "",
    title: "t",
    metadata: {},
    created_by: 0,
    session_items: [],
    rights_mode: "private",
    ...overrides,
  }) as AgentSession;

const CONFIG = {
  backend: "http://backend/",
  google_client_id: "",
  auth_mode: "regular",
} as ConfigContextType;

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ConfigContext.Provider value={CONFIG}>
      <UserContext.Provider value={{ user: { id: 1 } }}>
        <LanguageProvider initialLocale="de" initialMessages={de}>
          {children}
        </LanguageProvider>
      </UserContext.Provider>
    </ConfigContext.Provider>
  );
}

const chatReturn = (status: string) =>
  ({
    messages: [] as UIMessage[],
    status,
    sendMessage: vi.fn(),
    stop: vi.fn(),
    regenerate: vi.fn(),
    setMessages: vi.fn(),
    addToolApprovalResponse: vi.fn(),
  }) as never;

const mount = (initialSession: AgentSession | null) =>
  renderHook(
    () =>
      useChatSession({
        agent: AGENT,
        initialSession,
        initialMessages: [],
        beginLazyCreate: () => () => {},
      }),
    { wrapper: Wrapper },
  );

const sessionRowQuery = () => gqlCalls.queries.filter((q) => q.name === "GetAgentSessionById");

beforeEach(() => {
  gqlCalls.queries.length = 0;
  gqlCalls.sessionRow = null;
  gqlCalls.markSeen.mockClear().mockResolvedValue({});
  nav.refresh.mockClear();
  mockUseChat.mockReturnValue(chatReturn("ready"));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useChatSession — the seen marker", () => {
  it("marks the conversation seen when the screen opens", async () => {
    mount(session());

    await waitFor(() =>
      expect(gqlCalls.markSeen).toHaveBeenCalledWith({ variables: { id: "s1" } }),
    );
  });

  it("marks nothing on a brand-new chat that has no session yet", async () => {
    mount(null);

    await waitFor(() => expect(gqlCalls.queries.length).toBeGreaterThan(0));
    expect(gqlCalls.markSeen).not.toHaveBeenCalled();
  });
});

describe("useChatSession — catching up on an answer finished elsewhere", () => {
  it("watches the session row when it arrives mid-answer", async () => {
    mount(session({ generating_since: at(-5_000) }));

    await waitFor(() => expect(sessionRowQuery().length).toBeGreaterThan(0));
    const latest = sessionRowQuery().at(-1)!.options;
    expect(latest.skip).toBe(false);
    expect(latest.pollInterval).toBe(WORKING_POLL_MS);
  });

  it("does not watch a conversation that arrives idle", async () => {
    mount(session({ last_answer_at: at(-120_000), last_seen_at: at(-60_000) }));

    await waitFor(() => expect(sessionRowQuery().length).toBeGreaterThan(0));
    expect(sessionRowQuery().at(-1)!.options.skip).toBe(true);
  });

  it("does not watch while this tab is streaming the turn itself", async () => {
    mockUseChat.mockReturnValue(chatReturn("streaming"));

    mount(session({ generating_since: at(-5_000) }));

    await waitFor(() => expect(sessionRowQuery().length).toBeGreaterThan(0));
    expect(sessionRowQuery().at(-1)!.options.skip).toBe(true);
  });

  it("refreshes the route once the answer has landed, so the stored turn renders", async () => {
    const { rerender } = mount(session({ generating_since: at(-5_000) }));
    await waitFor(() => expect(sessionRowQuery().at(-1)!.options.skip).toBe(false));

    // The poll now reports the turn finished.
    gqlCalls.sessionRow = { id: "s1", generating_since: null, last_answer_at: at(0) };
    rerender();

    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
  });

  it("stops watching once it has caught up", async () => {
    const { rerender } = mount(session({ generating_since: at(-5_000) }));
    await waitFor(() => expect(sessionRowQuery().at(-1)!.options.skip).toBe(false));

    gqlCalls.sessionRow = { id: "s1", generating_since: null, last_answer_at: at(0) };
    rerender();

    await waitFor(() => expect(sessionRowQuery().at(-1)!.options.skip).toBe(true));
  });
});

describe("useChatSession — telling the chat lists to re-read", () => {
  /** Subscribes through the real signal module, so no mock can fake the wiring. */
  const listen = () => {
    const heard = vi.fn();
    const unsubscribe = subscribeToSessionActivity(heard);
    return { heard, unsubscribe };
  };

  it("announces once the session has been marked seen, so the unread dot clears", async () => {
    const { heard, unsubscribe } = listen();
    try {
      mount(session());

      // After the mutation resolves, never before: a list re-reading ahead of
      // the server's write would just load the stale last_seen_at again.
      await waitFor(() => expect(gqlCalls.markSeen).toHaveBeenCalled());
      await waitFor(() => expect(heard).toHaveBeenCalled());
    } finally {
      unsubscribe();
    }
  });

  it("announces when a turn starts, so the row can show it working", async () => {
    const { heard, unsubscribe } = listen();
    try {
      mockUseChat.mockReturnValue(chatReturn("ready"));
      const { rerender } = mount(session());
      await waitFor(() => expect(gqlCalls.markSeen).toHaveBeenCalled());
      heard.mockClear();

      mockUseChat.mockReturnValue(chatReturn("streaming"));
      rerender();

      await waitFor(() => expect(heard).toHaveBeenCalled());
    } finally {
      unsubscribe();
    }
  });

  it("announces when a turn ends, so the row stops showing it working", async () => {
    const { heard, unsubscribe } = listen();
    try {
      mockUseChat.mockReturnValue(chatReturn("streaming"));
      const { rerender } = mount(session());
      heard.mockClear();

      mockUseChat.mockReturnValue(chatReturn("ready"));
      rerender();

      await waitFor(() => expect(heard).toHaveBeenCalled());
    } finally {
      unsubscribe();
    }
  });
});

describe("useChatSession — catchingUp is visible to the screen", () => {
  it("reports catching up when the conversation arrives mid-answer", async () => {
    const { result } = mount(session({ generating_since: at(-5_000) }));

    await waitFor(() => expect(result.current.catchingUp).toBe(true));
  });

  it("reports nothing to catch up on an idle conversation", async () => {
    const { result } = mount(session({ last_answer_at: at(-120_000), last_seen_at: at(-60_000) }));

    await waitFor(() => expect(gqlCalls.markSeen).toHaveBeenCalled());
    expect(result.current.catchingUp).toBe(false);
  });

  it("stops reporting it once the answer has landed", async () => {
    const { result, rerender } = mount(session({ generating_since: at(-5_000) }));
    await waitFor(() => expect(result.current.catchingUp).toBe(true));

    gqlCalls.sessionRow = { id: "s1", generating_since: null, last_answer_at: at(0) };
    rerender();

    await waitFor(() => expect(result.current.catchingUp).toBe(false));
  });
});
