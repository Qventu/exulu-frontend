// @vitest-environment jsdom
/**
 * Task 6 (artifact-agent-panel plan): where createSession's URL swap lands.
 *
 * createSession (hooks.ts) finishes a lazy create with a raw
 * `window.history.replaceState` to `/chat/<agent>/<id>` — see the big comment
 * above that call for why it is replaceState and not router.replace. Mounted
 * somewhere other than the internal /chat route (the artifact panel, next),
 * that literal would rewrite the HOST page's URL out from under it. This
 * file pins the new `sessionPath` override: default unchanged, override
 * respected, and read at call time rather than captured at mount — the
 * create is async, so a render that happens while it is in flight must still
 * win.
 *
 * Mock harness follows hooks-session-catchup.test.tsx, with one addition:
 * useMutation here distinguishes createAgentSession from the hook's other
 * mutations (markSeen, session-items update, ...) so the lazy-create flow
 * can actually be driven end to end. Those other mutations are irrelevant to
 * this file and get an inert stub.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import de from "@/messages/de.json";
import { ConfigContext, type ConfigContextType } from "@/components/shell/config-context";
import { LanguageProvider } from "@/components/shell/language-provider";
import { UserContext } from "@/app/(application)/authenticated";
import type { Agent } from "@/types/models/agent";

vi.mock("@ai-sdk/react", () => ({ useChat: vi.fn() }));
vi.mock("@/lib/api/session-files", () => ({
  sessionFilesApi: { list: vi.fn().mockResolvedValue({ files: [] }) },
}));
vi.mock("@/lib/api/claim-check", () => ({
  postClaimCheck: vi.fn().mockResolvedValue({}),
  getSessionClaimChecks: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/demo/flag", () => ({ isDemoMode: vi.fn(() => false) }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/chat/agent-1/new",
  useSearchParams: () => new URLSearchParams(),
}));

/** The one mutation this file drives. */
const mutations = vi.hoisted(() => ({
  createAgentSession: vi.fn(),
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: undefined,
      previousData: undefined,
      loading: false,
      refetch: vi.fn(),
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
    })),
    useMutation: vi.fn((document: any) => {
      const name = document?.definitions?.[0]?.name?.value ?? "unknown";
      if (name === "createAgentSession") {
        return [mutations.createAgentSession, { loading: false }];
      }
      // markSeen, session-items update, etc. — untested here, inert stub.
      return [vi.fn().mockResolvedValue({}), { loading: false }];
    }),
  };
});

import { useChat } from "@ai-sdk/react";
import { useChatSession } from "./hooks";

const mockUseChat = vi.mocked(useChat);

const AGENT: Agent = {
  id: "agent-1",
  type: "agent",
  name: "Agent",
  slug: "/agents/run",
  model: "gpt-x",
  suggestions_enabled: false,
};

// Fixed identity: hooks.ts' "reset on session navigation" effect depends on
// `user`, so UserContext handing out a fresh object every render would bump
// the hook's lazy-create epoch on this file's own `rerender()` calls — for a
// reason that has nothing to do with sessionPath, and would make the
// read-at-call-time test flake.
const USER_CTX = { user: { id: 1 } };

const CONFIG = {
  backend: "http://backend/",
  google_client_id: "",
  auth_mode: "regular",
} as ConfigContextType;

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ConfigContext.Provider value={CONFIG}>
      <UserContext.Provider value={USER_CTX}>
        <LanguageProvider initialLocale="de" initialMessages={de}>
          {children}
        </LanguageProvider>
      </UserContext.Provider>
    </ConfigContext.Provider>
  );
}

const chatReturn = () =>
  ({
    messages: [],
    status: "ready",
    sendMessage: vi.fn(),
    stop: vi.fn(),
    regenerate: vi.fn(),
    setMessages: vi.fn(),
    addToolApprovalResponse: vi.fn(),
  }) as never;

type MountProps = { sessionPath?: (sessionId: string) => string };

/** A brand-new chat (no session yet) — the only state that drives createSession. */
const mount = (initialProps: MountProps = {}) =>
  renderHook(
    (props: MountProps) =>
      useChatSession({
        agent: AGENT,
        initialSession: null,
        initialMessages: [],
        beginLazyCreate: () => () => {},
        sessionPath: props.sessionPath,
      }),
    { wrapper: Wrapper, initialProps },
  );

const createdSessionResult = {
  data: { agent_sessionsCreateOne: { item: { id: "session-9" } } },
};

let replaceStateSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mutations.createAgentSession.mockReset();
  mockUseChat.mockReturnValue(chatReturn());
  replaceStateSpy = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  replaceStateSpy.mockRestore();
  vi.clearAllMocks();
});

describe("useChatSession — the lazy-create destination", () => {
  test("defaults to the /chat literal", async () => {
    mutations.createAgentSession.mockResolvedValue(createdSessionResult);

    const { result } = mount();

    await act(async () => {
      await result.current.sendUserMessage("hi");
    });

    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/chat/agent-1/session-9");
  });

  test("uses sessionPath when supplied", async () => {
    mutations.createAgentSession.mockResolvedValue(createdSessionResult);

    const { result } = mount({
      sessionPath: (id) => `/artifacts/open/pitch?session=${id}`,
    });

    await act(async () => {
      await result.current.sendUserMessage("hi");
    });

    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      "",
      "/artifacts/open/pitch?session=session-9",
    );
  });

  test("the destination is read at call time, not captured at mount", async () => {
    let resolveCreate!: (value: unknown) => void;
    mutations.createAgentSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const { result, rerender } = mount({
      sessionPath: (id) => `/path-a/${id}`,
    });

    // Kick off the send; createSession's mutation is now in flight (the
    // promise above is still unresolved), captured by this render's closure.
    let sendDone!: Promise<void>;
    await act(async () => {
      sendDone = result.current.sendUserMessage("hi");
    });
    expect(mutations.createAgentSession).toHaveBeenCalled();

    // A new sessionPath arrives — e.g. the panel host re-renders with a
    // different artifact name — before the create resolves.
    rerender({ sessionPath: (id) => `/path-b/${id}` });

    await act(async () => {
      resolveCreate(createdSessionResult);
      await sendDone;
    });

    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/path-b/session-9");
    expect(replaceStateSpy).not.toHaveBeenCalledWith(null, "", "/path-a/session-9");
  });
});
