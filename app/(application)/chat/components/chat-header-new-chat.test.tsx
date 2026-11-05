// @vitest-environment jsdom
/**
 * The header's new-chat destination.
 *
 * `ChatHeader` navigated with a hardcoded `/chat/${agent.id}/new` at both of
 * its new-chat call sites (the <sm icon button, and the return to a fresh chat
 * after deleting the current session). Internal chat is the only host that was
 * ever considered, so nothing was wrong until the artifact agent panel mounted
 * the same header on `/artifacts/open/<name>`: clicking New chat there threw
 * the user out of the artifact they were working on. It is the same defect
 * class as the hardcoded lazy-create destination in `hooks.ts` (parameterised
 * as `sessionPath`) and the rail's hardcoded hrefs (parameterised as
 * `HistoryRailPaths`), so it is parameterised the same way — an optional
 * `newChatPath` on `ChatShellContextValue`, falling back to today's literal.
 *
 * Both directions are asserted here, because the fallback is the half that
 * keeps internal chat byte-identical and a regression in it would be silent.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

const controller = {
  agent: AGENT,
  session: null,
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
};

const shell = (newChatPath?: string): ChatShellContextValue => ({
  agent: AGENT as never,
  historySheetOpen: false,
  setHistorySheetOpen: () => {},
  railCollapsed: false,
  setRailCollapsed: () => {},
  toggleHistory: () => {},
  newChatNonce: 0,
  startNewChat: () => {},
  ...(newChatPath === undefined ? {} : { newChatPath }),
  beginLazyCreate: () => () => {},
});

beforeEach(() => {
  nav.push.mockClear();
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

const show = (newChatPath?: string) =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <UserContext.Provider value={{ user: { id: 7 } }}>
        <SidebarProvider>
          <ChatShellContext.Provider value={shell(newChatPath)}>
            <ChatHeader controller={controller as never} />
          </ChatShellContext.Provider>
        </SidebarProvider>
      </UserContext.Provider>
    </NextIntlClientProvider>,
  );

describe("ChatHeader new-chat destination", () => {
  test("internal chat still goes to /chat/<agent>/new when none is supplied", () => {
    show();

    fireEvent.click(screen.getByLabelText(enMessages.chat.header.newChat));

    expect(nav.push).toHaveBeenCalledWith("/chat/agent-1/new");
  });

  test("the artifact panel's header goes to the artifact URL", () => {
    show("/artifacts/open/pitch");

    fireEvent.click(screen.getByLabelText(enMessages.chat.header.newChat));

    expect(nav.push).toHaveBeenCalledWith("/artifacts/open/pitch");
    expect(nav.push).not.toHaveBeenCalledWith("/chat/agent-1/new");
  });

  test("no new-chat navigation in the header is hardcoded any more", () => {
    // The second call site — the return to a fresh chat after deleting the
    // session — sits behind an overflow menu and a confirm dialog, which is a
    // lot of Radix to drive for one string. Both sites now read the same
    // resolved href, and this is what guards the one the clicks above cannot
    // reach (and anything added later).
    const source = readFileSync(join(__dirname, "chat-header.tsx"), "utf8");
    const pushes = [...source.matchAll(/router\.push\(([^)]*)\)/g)].map(
      (match) => match[1],
    );

    expect(pushes.length).toBeGreaterThanOrEqual(2);
    for (const target of pushes) {
      expect(target).toBe("newChatHref");
    }
  });
});
