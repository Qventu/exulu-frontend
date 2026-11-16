// @vitest-environment jsdom
/**
 * The header's files chip counts what the files panel opens on: in a project
 * session that is the session's files plus the project's shared files; in a
 * session without a project it is exactly the session count, as before.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { UserContext } from "@/app/(application)/authenticated";
import { SidebarProvider } from "@/components/ui/sidebar";
import enMessages from "@/messages/en.json";

const nav = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  usePathname: () => "/chat/agent-1/new",
  useSearchParams: () => new URLSearchParams(""),
}));

// lottie-web throws on import under jsdom (no canvas).
vi.mock("@/components/lottie", () => ({
  default: () => <span data-testid="agent-visual" />,
}));

vi.mock("../hooks", () => ({
  useSessionMutations: () => ({
    createNamedSession: vi.fn(),
    renameSession: vi.fn(),
    deleteSession: vi.fn(),
    deleteSessions: vi.fn(),
    creating: false,
    renaming: false,
    deleting: false,
  }),
  useAvailableModels: () => ({ models: [] }),
}));

// The header's overlays are irrelevant here and each drags in Apollo.
vi.mock("./share-popover", () => ({ SharePopover: () => null }));
vi.mock("./model-override-dialog", () => ({ ModelOverrideDialog: () => null }));
vi.mock("./usage-popover", () => ({
  UsageDialog: () => null,
  UsagePopover: () => null,
}));
vi.mock("@/components/save-workflow-modal", () => ({
  SaveWorkflowModal: () => null,
}));

import { ChatHeader } from "./chat-header";
import { ChatShellContext, type ChatShellContextValue } from "./chat-shell";

const AGENT = { id: "agent-1", name: "Pitch Analyst", type: "agent" as const };

const controller = (extra: Record<string, unknown>) => ({
  agent: AGENT,
  session: { id: "s1", title: "T" },
  writeAccess: true,
  tokenCounts: {},
  modelOverride: null,
  setModelOverride: () => {},
  status: "ready",
  messages: [],
  myMemoriesCount: null,
  sessionFilesCount: 0,
  contextOccupancy: null,
  contextWindow: null,
  contextState: null,
  creatorEmail: undefined,
  setFilesPanelOpen: () => {},
  setMemoryPanelOpen: () => {},
  ...extra,
});

const SHELL: ChatShellContextValue = {
  agent: AGENT as never,
  historySheetOpen: false,
  setHistorySheetOpen: () => {},
  railCollapsed: false,
  setRailCollapsed: () => {},
  toggleHistory: () => {},
  newChatNonce: 0,
  startNewChat: () => {},
  beginLazyCreate: () => () => {},
};

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: !query.includes("max-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(cleanup);

const show = (extra: Record<string, unknown>) =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <UserContext.Provider value={{ user: { id: 7 } }}>
        <SidebarProvider>
          <ChatShellContext.Provider value={SHELL}>
            <ChatHeader controller={controller(extra) as never} />
          </ChatShellContext.Provider>
        </SidebarProvider>
      </UserContext.Provider>
    </NextIntlClientProvider>,
  );

const chip = () => screen.getByLabelText(enMessages.chat.header.filesAria);

describe("ChatHeader files chip", () => {
  test("without a project it shows the session count", () => {
    show({ sessionFilesCount: 2, projectFiles: null });
    expect(chip().textContent).toContain("2 files");
  });

  test("in a project session it adds the project's files", () => {
    show({
      sessionFilesCount: 2,
      projectFiles: { id: "p1", name: "Atlas", canWrite: true, files: [{}, {}, {}] },
    });
    expect(chip().textContent).toContain("5 files");
  });

  test("shows the chip for project files alone", () => {
    show({
      sessionFilesCount: 0,
      projectFiles: { id: "p1", name: "Atlas", canWrite: false, files: [{}] },
    });
    expect(chip().textContent).toContain("1 file");
  });
});
