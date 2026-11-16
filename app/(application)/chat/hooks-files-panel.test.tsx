// @vitest-environment jsdom
/**
 * The session-files panel inside a NARROW host (the artifact viewer's agent
 * panel) — `SessionScreen`'s `compact` flag, end to end.
 *
 * Two independent defects produced the same symptom there. The controller
 * restores `chat.sessionFilesPanel.open` from localStorage on mount, so a
 * user who had ever left the panel open in full-page chat got it re-opened
 * inside the artifact panel as well; and `SidePanel` picks docked-vs-Sheet
 * off the WINDOW width, which is still "desktop" even though the host column
 * is ~700px — so the restored panel docked and squeezed the conversation to a
 * 90px composer. `compact` turns both off at once: no restore
 * (`restoreFilesPanel: false` into `useChatSession`) and no docking
 * (`dock={false}` onto both SidePanels).
 *
 * This mounts the REAL `useChatSession` and the REAL `SidePanel` — the two
 * halves the flag has to reach — with the conversation's own children
 * (header, messages, composer, drop target, panel bodies) stubbed out: none
 * of them is what this file is about, and each drags in Apollo/uploads.
 * The mock harness for the hook itself follows hooks-seed-input.test.tsx.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import en from "@/messages/en.json";
import { ConfigContext, type ConfigContextType } from "@/components/shell/config-context";
import { LanguageProvider } from "@/components/shell/language-provider";
import { UserContext } from "@/app/(application)/authenticated";
import type { Agent } from "@/types/models/agent";
import type { AgentSession } from "@/types/models/agent-session";

vi.mock("@ai-sdk/react", () => ({ useChat: vi.fn() }));
vi.mock("@/lib/api/session-files", () => ({
  sessionFilesApi: { list: vi.fn().mockResolvedValue({ files: [] }) },
  MAX_ADOPT_KEYS: 20,
}));
vi.mock("@/lib/api/claim-check", () => ({
  postClaimCheck: vi.fn().mockResolvedValue({}),
  getSessionClaimChecks: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/demo/flag", () => ({ isDemoMode: vi.fn(() => false) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn() } }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/artifacts/open/pitch",
  useSelectedLayoutSegment: () => null,
  useSearchParams: () => new URLSearchParams(),
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
    useMutation: vi.fn(() => [vi.fn().mockResolvedValue({}), { loading: false }]),
  };
});

// The conversation column itself — stubbed: this file asserts on the two
// SidePanels beside it, and each of these drags in Apollo, uploads or the
// Lottie player (which throws under jsdom).
vi.mock("./components/chat-header", () => ({ ChatHeader: () => null }));
vi.mock("./components/message-column", () => ({ MessageColumn: () => null }));
vi.mock("./components/composer", () => ({ Composer: () => null }));
vi.mock("./components/memory-panel", () => ({
  MemoryPanelContent: () => <div data-testid="memory-body" />,
}));
vi.mock("./components/session-files/chat-drop-target", () => ({
  ChatDropTarget: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("./components/session-files/panel-content", () => ({
  SessionFilesContent: () => <div data-testid="files-body" />,
}));

import { useChat } from "@ai-sdk/react";
import { ChatShellContext, type ChatShellContextValue } from "./components/chat-shell";
import { SessionScreen } from "./components/session-screen";
import type { ChatSessionController } from "./hooks";

const mockUseChat = vi.mocked(useChat);

const AGENT: Agent = {
  id: "agent-1",
  type: "agent",
  name: "Pitch Analyst",
  slug: "/agents/run",
  model: "gpt-x",
  suggestions_enabled: false,
};

const SESSION: AgentSession = {
  id: "session-1",
  title: "Spare parts",
  agent: "agent-1",
  project: "p1",
  metadata: null,
  createdAt: "2026-11-04T10:00:00.000Z",
  updatedAt: "2026-11-04T10:00:00.000Z",
  created_by: 1,
  rights_mode: "private",
  session_items: [],
};

// Fixed identity, like every other hooks-*.test.tsx: a fresh object per
// render would bump the hook's "session navigation" effect for a reason that
// has nothing to do with the files panel.
const USER_CTX = { user: { id: 1 } };

const CONFIG = {
  backend: "http://backend/",
  google_client_id: "",
  auth_mode: "regular",
} as ConfigContextType;

const SHELL: ChatShellContextValue = {
  agent: AGENT,
  historySheetOpen: false,
  setHistorySheetOpen: () => {},
  railCollapsed: false,
  setRailCollapsed: () => {},
  toggleHistory: () => {},
  newChatNonce: 0,
  startNewChat: () => {},
  beginLazyCreate: () => () => {},
};

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

const filesTitle = en.chat.files.title;
const memoryTitle = en.chat.memory.panelTitle.replace("{agent}", AGENT.name);

/** The live controller of the last mounted SessionScreen (see onController). */
let controller: ChatSessionController | null = null;

function show(compact?: boolean) {
  return render(
    <ConfigContext.Provider value={CONFIG}>
      <UserContext.Provider value={USER_CTX}>
        <LanguageProvider initialLocale="en" initialMessages={en}>
          <ChatShellContext.Provider value={SHELL}>
            <SessionScreen
              agent={AGENT}
              initialSession={SESSION}
              initialMessages={[]}
              compact={compact}
              onController={(c) => {
                controller = c;
              }}
            />
          </ChatShellContext.Provider>
        </LanguageProvider>
      </UserContext.Provider>
    </ConfigContext.Provider>,
  );
}

beforeEach(() => {
  controller = null;
  mockUseChat.mockReturnValue(chatReturn());
  window.localStorage.clear();
  // Desktop: every min-width query matches, so SidePanel would dock unless
  // something tells it not to. That is the whole point of the `dock` prop.
  window.matchMedia = ((query: string) => ({
    matches: !query.includes("max-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SessionScreen — the files panel in a compact host", () => {
  test("restores the persisted open panel in full-page chat", () => {
    window.localStorage.setItem("chat.sessionFilesPanel.open", "true");

    show();

    expect(screen.getByText(filesTitle)).toBeTruthy();
    expect(screen.getByTestId("files-body")).toBeTruthy();
  });

  test("never restores it when compact", () => {
    window.localStorage.setItem("chat.sessionFilesPanel.open", "true");

    show(true);

    expect(screen.queryByText(filesTitle)).toBeNull();
    expect(screen.queryByTestId("files-body")).toBeNull();
  });

  test("an explicit open still works when compact — as a Sheet, not a dock", async () => {
    // The preference restore is the only thing `compact` suppresses: the
    // attach menu, the header button and a file drop all still open the
    // panel, and must reach the user as an overlay rather than stealing
    // width from a column that has none to give.
    const { container, baseElement } = show(true);

    expect(controller).not.toBeNull();
    await act(async () => {
      await controller!.setFilesPanelOpen(true);
    });

    expect(container.querySelector("aside[role='complementary']")).toBeNull();
    // Radix portals the Sheet out of this subtree.
    expect(baseElement.querySelector("[role='dialog']")).not.toBeNull();
    expect(screen.getByTestId("files-body")).toBeTruthy();
  });

  test("the memory panel is a Sheet when compact too", async () => {
    const { container, baseElement } = show(true);

    await act(async () => {
      controller!.setMemoryPanelOpen(true);
    });

    expect(container.querySelector("aside[role='complementary']")).toBeNull();
    expect(baseElement.querySelector("[role='dialog']")).not.toBeNull();
    expect(screen.getByTestId("memory-body")).toBeTruthy();
  });

  test("full-page chat still docks both panels", async () => {
    const { container } = show();

    await act(async () => {
      await controller!.setFilesPanelOpen(true);
    });
    expect(container.querySelector("aside[role='complementary']")).not.toBeNull();

    await act(async () => {
      controller!.setMemoryPanelOpen(true);
    });
    const docked = container.querySelectorAll("aside[role='complementary']");
    expect(docked.length).toBe(2);
    expect([...docked].map((a) => a.getAttribute("aria-label"))).toEqual([
      filesTitle,
      memoryTitle,
    ]);
  });
});
