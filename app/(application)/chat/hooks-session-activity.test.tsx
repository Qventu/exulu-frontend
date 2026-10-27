// @vitest-environment jsdom
/**
 * useChatSessions has to re-read the list while a conversation is working —
 * otherwise a row that says "working" keeps saying it after the answer has
 * landed, which is the state the viewer came back to check.
 *
 * Mock harness copied from hooks-claim-check.test.tsx: hooks.ts pulls in the
 * whole chat feature, so Apollo and the AI SDK transport are stubbed and only
 * the polling wiring is exercised.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ai-sdk/react", () => ({ useChat: vi.fn() }));
vi.mock("@/lib/api/session-files", () => ({
  sessionFilesApi: { list: vi.fn().mockResolvedValue({ files: [] }) },
}));
vi.mock("@/lib/api/claim-check", () => ({
  postClaimCheck: vi.fn(),
  getSessionClaimChecks: vi.fn(),
}));
vi.mock("@/lib/demo/flag", () => ({ isDemoMode: vi.fn(() => false) }));

const apollo = vi.hoisted(() => ({
  items: [] as Record<string, unknown>[],
  startPolling: vi.fn(),
  stopPolling: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: { agent_sessionsPagination: { items: apollo.items, pageInfo: { itemCount: apollo.items.length } } },
      previousData: undefined,
      loading: false,
      refetch: apollo.refetch,
      startPolling: apollo.startPolling,
      stopPolling: apollo.stopPolling,
    })),
    useMutation: vi.fn(() => [vi.fn(), { loading: false }]),
  };
});

import { WORKING_POLL_MS } from "@/lib/session-activity";
import { notifySessionActivityChanged } from "@/lib/session-activity-signal";
import { useChatSessions } from "./hooks";

const NOW = Date.now();
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

beforeEach(() => {
  apollo.items = [];
  apollo.startPolling.mockClear();
  apollo.stopPolling.mockClear();
  apollo.refetch.mockClear();
});
afterEach(cleanup);

describe("useChatSessions polling", () => {
  it("polls while a conversation is working", () => {
    apollo.items = [{ id: "s1", generating_since: at(-5_000) }];

    renderHook(() => useChatSessions({ agentId: "a1" }));

    expect(apollo.startPolling).toHaveBeenCalledWith(WORKING_POLL_MS);
  });

  it("leaves a quiet list alone", () => {
    apollo.items = [{ id: "s1", last_answer_at: at(-120_000), last_seen_at: at(-60_000) }];

    renderHook(() => useChatSessions({ agentId: "a1" }));

    expect(apollo.startPolling).not.toHaveBeenCalled();
    expect(apollo.stopPolling).toHaveBeenCalled();
  });

  it("stops polling once the working conversation has finished", () => {
    apollo.items = [{ id: "s1", generating_since: at(-5_000) }];
    const { rerender } = renderHook(() => useChatSessions({ agentId: "a1" }));
    expect(apollo.startPolling).toHaveBeenCalledWith(WORKING_POLL_MS);

    apollo.items = [{ id: "s1", last_answer_at: at(-1_000) }];
    rerender();

    expect(apollo.stopPolling).toHaveBeenCalled();
  });
});

describe("useChatSessions refreshing", () => {
  it("re-reads the list when the chat screen says activity changed", () => {
    // Without this the list can never notice a turn starting or a session
    // being read: it fetches once on mount, and polling only begins once it
    // ALREADY sees something working.
    renderHook(() => useChatSessions({ agentId: "a1" }));
    apollo.refetch.mockClear();

    act(() => notifySessionActivityChanged());

    expect(apollo.refetch).toHaveBeenCalledTimes(1);
  });

  it("re-reads the list when the tab becomes visible again", () => {
    renderHook(() => useChatSessions({ agentId: "a1" }));
    apollo.refetch.mockClear();

    act(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(apollo.refetch).toHaveBeenCalledTimes(1);
  });

  it("stops listening once unmounted", () => {
    const { unmount } = renderHook(() => useChatSessions({ agentId: "a1" }));
    unmount();
    apollo.refetch.mockClear();

    act(() => notifySessionActivityChanged());

    expect(apollo.refetch).not.toHaveBeenCalled();
  });
});
