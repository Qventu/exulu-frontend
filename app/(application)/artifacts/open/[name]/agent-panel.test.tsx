// @vitest-environment jsdom
/**
 * `AgentPanel` — the chat surface beside the artifact.
 *
 * What is real here and what is not: `HistoryRail` is mounted for real,
 * because two of these tests exist to prove that the alternate
 * `ChatShellContext` this component supplies is complete (the rail throws
 * without it) and that the rail's links stay on the artifact URL instead of
 * leaving for /chat. `SessionScreen` is stubbed — it instantiates the whole
 * chat controller (Apollo, the AI SDK transport, uploads), and the thing worth
 * asserting about it here is the ONE prop this host has to get right: the
 * `sessionPath` that keeps a lazy session create from rewriting the artifact
 * page's URL. The chat hooks are stubbed for the same reason: the rail reads
 * its recents through Apollo.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { UserContext } from "@/app/(application)/authenticated";
import { SidebarProvider } from "@/components/ui/sidebar";
import enMessages from "@/messages/en.json";

// HistoryRail imports the agent switcher, which imports the Lottie player —
// and lottie-web throws on import under jsdom (no canvas). Same mock the chat
// feature's own component tests use.
vi.mock("@/components/lottie", () => ({
  default: () => <span data-testid="agent-visual" />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/artifacts/open/pitch",
  useSearchParams: () => new URLSearchParams(""),
}));

const SESSION = {
  id: "session-1",
  title: "Spare parts",
  agent: "agent-1",
  createdAt: "2026-11-04T10:00:00.000Z",
  updatedAt: "2026-11-04T10:00:00.000Z",
  created_by: 7,
  rights_mode: "private",
  metadata: null,
  project: "p1",
  session_items: [],
};

vi.mock("@/app/(application)/chat/hooks", () => ({
  useChatSessions: () => ({
    sessions: [SESSION],
    itemCount: 1,
    loading: false,
    initialLoading: false,
    refetch: () => {},
  }),
  useSessionMutations: () => ({
    createNamedSession: vi.fn(),
    renameSession: vi.fn(),
    deleteSession: vi.fn(),
    deleteSessions: vi.fn(),
    creating: false,
    renaming: false,
    deleting: false,
  }),
}));

vi.mock("@/app/(application)/chat/components/session-screen", () => ({
  SessionScreen: (props: { sessionPath?: (id: string) => string }) => (
    <div
      data-testid="session-screen"
      data-session-path={props.sessionPath?.("session-9") ?? "(none)"}
    />
  ),
}));

import { AgentPanel } from "./agent-panel";

const AGENT = { id: "agent-1", name: "Pitch Analyst", type: "agent" as const };

/** Captured ResizeObserver callbacks, so a resize can be driven by hand. */
let resizeCallbacks: ResizeObserverCallback[] = [];
let stubWidth = 400;
const realGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

beforeEach(() => {
  resizeCallbacks = [];
  stubWidth = 400;

  // SidebarProvider/useIsMobile and SidePanel/useMediaQuery both read
  // matchMedia, which jsdom does not implement. Desktop: every min-width query
  // matches, no max-width one does — so SidePanel renders its DOCKED branch,
  // which is the one that takes width away from the artifact.
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

  class RO {
    constructor(callback: ResizeObserverCallback) {
      resizeCallbacks.push(callback);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

  // jsdom has no layout: every box is 0×0. The panel reports what it measures,
  // so the measurement has to be stubbed for the report to mean anything.
  HTMLElement.prototype.getBoundingClientRect = function () {
    return {
      width: stubWidth,
      height: 600,
      top: 0,
      left: 0,
      right: stubWidth,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
});

afterEach(() => {
  cleanup();
  HTMLElement.prototype.getBoundingClientRect = realGetBoundingClientRect;
});

type Overrides = Partial<React.ComponentProps<typeof AgentPanel>>;

const show = (overrides: Overrides = {}) => {
  const props = {
    agent: AGENT as never,
    initialSession: null,
    initialMessages: [],
    artifactName: "pitch",
    open: true,
    onClose: vi.fn(),
    onWidthChange: vi.fn(),
    onProgress: vi.fn(),
    ...overrides,
  };
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <UserContext.Provider value={{ user: { id: 7 } }}>
        <SidebarProvider>
          <AgentPanel {...props} />
        </SidebarProvider>
      </UserContext.Provider>
    </NextIntlClientProvider>,
  );
  return { ...view, props };
};

/** Every href the panel renders, rail rows included. */
const hrefs = (container: HTMLElement) =>
  [...container.querySelectorAll("a[href]")].map(
    (a) => a.getAttribute("href") ?? "",
  );

describe("AgentPanel", () => {
  test("renders nothing when closed", () => {
    const { container, props } = show({ open: false });

    expect(screen.queryByTestId("session-screen")).toBeNull();
    expect(container.querySelector("[role='complementary']")).toBeNull();
    expect(hrefs(container)).toEqual([]);
    expect(props.onWidthChange).not.toHaveBeenCalled();
  });

  test("supplies ChatShellContext so HistoryRail mounts without throwing", () => {
    // HistoryRail (and every SessionRow under it) calls useChatShell(), which
    // throws outside a provider — so rendering at all is most of the proof.
    const { container } = show();

    expect(
      container.querySelector(
        `[aria-label="${enMessages.chat.history.title}"]`,
      ),
    ).not.toBeNull();
    expect(screen.getByTestId("session-screen")).toBeTruthy();
  });

  test("rail session links point at the artifact URL, not /chat", () => {
    const { container } = show();

    const links = hrefs(container);
    expect(links).toContain("/artifacts/open/pitch?session=session-1");
    expect(links).toContain("/artifacts/open/pitch");
    expect(links.filter((href) => href.startsWith("/chat"))).toEqual([]);
  });

  test("gives SessionScreen a sessionPath on the artifact URL", () => {
    // Task 6's parameter: without it the first send rewrites this page's URL
    // to /chat/<agent>/<session> behind the user's back.
    show();

    expect(
      screen.getByTestId("session-screen").getAttribute("data-session-path"),
    ).toBe("/artifacts/open/pitch?session=session-9");
  });

  test("reports its width on mount and on resize", () => {
    const { props } = show();

    expect(props.onWidthChange).toHaveBeenCalledWith(400);

    stubWidth = 640;
    for (const callback of resizeCallbacks) {
      callback([], {} as ResizeObserver);
    }

    expect(props.onWidthChange).toHaveBeenCalledWith(640);
  });

  test("collapsing keeps the session mounted and gives the artifact its width back", () => {
    const { container, props } = show();

    fireEvent.click(screen.getByLabelText(enMessages.artifacts.panelCollapse));

    // The conversation is still mounted — collapse is not close.
    expect(screen.getByTestId("session-screen")).toBeTruthy();
    expect(container.querySelector("[role='complementary']")).not.toBeNull();
    expect(props.onClose).not.toHaveBeenCalled();
    // ...and the panel is out of the row, so the artifact gets its width back,
    // with the thin edge as the way in again.
    expect(container.querySelector("[data-state='collapsed']")).not.toBeNull();
    expect(
      screen.getByLabelText(enMessages.artifacts.panelExpand),
    ).toBeTruthy();
  });

  test("expanding puts the panel back", () => {
    const { container } = show();

    fireEvent.click(screen.getByLabelText(enMessages.artifacts.panelCollapse));
    fireEvent.click(screen.getByLabelText(enMessages.artifacts.panelExpand));

    expect(container.querySelector("[data-state='collapsed']")).toBeNull();
    expect(container.querySelector("[data-state='expanded']")).not.toBeNull();
    expect(
      screen.queryByLabelText(enMessages.artifacts.panelExpand),
    ).toBeNull();
  });

  test("closing the panel asks the host to close it, not to collapse it", () => {
    const { props } = show();

    fireEvent.click(screen.getByLabelText(enMessages.common.close));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByLabelText(enMessages.artifacts.panelExpand),
    ).toBeNull();
  });

  test("accepts onProgress without calling it yet (Task 10 owns the emission)", () => {
    const { props } = show();

    expect(props.onProgress).not.toHaveBeenCalled();
  });
});
