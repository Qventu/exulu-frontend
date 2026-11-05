// @vitest-environment jsdom
/**
 * The controller's prefill seed channel (task 9, artifact-agent-panel plan).
 *
 * There is no `controller.setInput` — the composer owns `input` as its own
 * `useState` (composer.tsx:114) — so this is the one channel through which
 * something OUTSIDE the composer (the artifact-panel open-request
 * orchestrator, applyOpenRequest) can still land text in it.
 *
 * It is deliberately NOT the existing `?q=` deep link
 * (composer.tsx:315-342): that path is seeded once per mount, guarded by
 * `deepLinkSeededRef`, specifically so a stale closure can never re-win
 * against the user's first keystroke. A second artifact-panel button click
 * in an ALREADY-MOUNTED panel needs to keep working, so this channel carries
 * a nonce that bumps on every `seedInput` call — including a call with the
 * exact same text as last time — and the composer applies it keyed on the
 * nonce, not on the text. See composer-seed.test.tsx for the composer half
 * of this contract; this file only pins the controller's own state machine.
 *
 * Mock harness follows hooks-session-path.test.tsx (same file, same reason:
 * useChatSession needs a full mount to exercise anything on the returned
 * controller). addSessionFiles additionally needs sessionFilesApi.adopt, so
 * that mock gains one more method over the base harness.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { DocumentNode } from "@apollo/client";

import de from "@/messages/de.json";
import { ConfigContext, type ConfigContextType } from "@/components/shell/config-context";
import { LanguageProvider } from "@/components/shell/language-provider";
import { UserContext } from "@/app/(application)/authenticated";
import type { Agent } from "@/types/models/agent";

vi.mock("@ai-sdk/react", () => ({ useChat: vi.fn() }));

const sessionFiles = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue({ files: [] }),
  adopt: vi.fn().mockResolvedValue({ adopted: [{ key: "dest/report.pdf", name: "report.pdf" }], rejected: [] }),
}));
vi.mock("@/lib/api/session-files", () => ({
  sessionFilesApi: sessionFiles,
  // addSessionFiles chunks by this cap (mirrors the backend's own).
  MAX_ADOPT_KEYS: 20,
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

const toastSpies = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastSpies }));

/** The one mutation addSessionFiles' ensureSession path drives. */
const mutations = vi.hoisted(() => ({
  createAgentSession: vi.fn(),
}));

/**
 * A `DocumentNode`'s first definition's operation name, if it has one.
 * `DefinitionNode` is a union (operations, fragments, schema/type system
 * definitions, ...) and only some members carry `name` at all, so this
 * narrows with `in` rather than reaching for `any` on the parameter the way
 * the pre-existing `hooks-session-path.test.tsx`/`hooks-session-catchup.
 * test.tsx` mocks do.
 */
function operationName(document: DocumentNode): string {
  const def = document.definitions[0];
  return def && "name" in def && def.name ? def.name.value : "unknown";
}

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
    useMutation: vi.fn((document: DocumentNode) => {
      const name = operationName(document);
      if (name === "createAgentSession") {
        return [mutations.createAgentSession, { loading: false }];
      }
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

// Fixed identity for the same reason hooks-session-path.test.tsx pins one:
// a fresh object per render would bump the hook's lazy-create epoch on this
// file's own rerenders, for a reason unrelated to the seed channel.
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

const mount = () =>
  renderHook(
    () =>
      useChatSession({
        agent: AGENT,
        initialSession: null,
        initialMessages: [],
        beginLazyCreate: () => () => {},
      }),
    { wrapper: Wrapper },
  );

const createdSessionResult = {
  data: { agent_sessionsCreateOne: { item: { id: "session-9" } } },
};

beforeEach(() => {
  mutations.createAgentSession.mockReset();
  mockUseChat.mockReturnValue(chatReturn());
  sessionFiles.list.mockClear();
  sessionFiles.adopt.mockClear();
  sessionFiles.adopt.mockResolvedValue({
    adopted: [{ key: "dest/report.pdf", name: "report.pdf" }],
    rejected: [],
  });
  toastSpies.error.mockClear();
  vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useChatSession — the prefill seed channel", () => {
  test("seedInput exposes the text with a fresh nonce", () => {
    const { result } = mount();

    expect(result.current.pendingInput).toBeNull();

    act(() => {
      result.current.seedInput("Summarise this filing");
    });

    expect(result.current.pendingInput).toEqual({
      text: "Summarise this filing",
      nonce: 1,
    });
  });

  test("seeding twice with the same text still bumps the nonce", () => {
    // Two clicks of the same artifact-panel button must both reach the
    // composer — a plain value-equality check on the text would see no
    // change on the second click and silently drop it.
    const { result } = mount();

    act(() => {
      result.current.seedInput("Summarise this filing");
    });
    const first = result.current.pendingInput;

    act(() => {
      result.current.seedInput("Summarise this filing");
    });
    const second = result.current.pendingInput;

    expect(first?.text).toBe(second?.text);
    expect(second?.nonce).not.toBe(first?.nonce);
  });

  test("consumePendingInput clears it", () => {
    const { result } = mount();

    act(() => {
      result.current.seedInput("Summarise this filing");
    });
    expect(result.current.pendingInput).not.toBeNull();

    act(() => {
      result.current.consumePendingInput();
    });

    expect(result.current.pendingInput).toBeNull();
  });
});

// Additional coverage, beyond the brief's three cases: addSessionFiles is new
// non-trivial logic (lazy session create, dedupe, adopt, refresh) that the
// apply-open-request tests exercise only through a mocked stand-in — this is
// the one place the REAL hooks.ts implementation gets driven end to end.
describe("useChatSession — addSessionFiles", () => {
  test("ensures a session, dedupes, adopts, and refreshes the files count", async () => {
    mutations.createAgentSession.mockResolvedValue(createdSessionResult);
    const { result } = mount();

    await act(async () => {
      await result.current.addSessionFiles(["key-a", "key-a", "key-b"]);
    });

    expect(mutations.createAgentSession).toHaveBeenCalledTimes(1);
    expect(sessionFiles.adopt).toHaveBeenCalledWith("session-9", ["key-a", "key-b"]);
    // refreshFilesCount re-lists after a successful adopt.
    expect(sessionFiles.list).toHaveBeenCalledWith("session-9");
  });

  test("toasts and never calls adopt when the lazy session create fails", async () => {
    mutations.createAgentSession.mockResolvedValue({ data: null });
    const { result } = mount();

    await act(async () => {
      await result.current.addSessionFiles(["key-a"]);
    });

    expect(sessionFiles.adopt).not.toHaveBeenCalled();
    expect(toastSpies.error).toHaveBeenCalled();
  });

  test("never calls ensureSession for an empty (post-dedupe) key list", async () => {
    const { result } = mount();

    await act(async () => {
      await result.current.addSessionFiles([]);
    });

    expect(mutations.createAgentSession).not.toHaveBeenCalled();
    expect(sessionFiles.adopt).not.toHaveBeenCalled();
  });

  test("chunks a batch larger than the adopt cap into multiple requests", async () => {
    // The server 403s the WHOLE batch over MAX_ADOPT_KEYS (mocked to 20
    // above) rather than copying the first 20 — this proves the client
    // splits BEFORE that happens, instead of forwarding an oversized batch.
    mutations.createAgentSession.mockResolvedValue(createdSessionResult);
    const { result } = mount();
    const keys = Array.from({ length: 25 }, (_, i) => `key-${i}`);

    await act(async () => {
      await result.current.addSessionFiles(keys);
    });

    expect(sessionFiles.adopt).toHaveBeenCalledTimes(2);
    expect(sessionFiles.adopt).toHaveBeenNthCalledWith(1, "session-9", keys.slice(0, 20));
    expect(sessionFiles.adopt).toHaveBeenNthCalledWith(2, "session-9", keys.slice(20));
  });
});
