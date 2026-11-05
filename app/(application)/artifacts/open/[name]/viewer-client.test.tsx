// @vitest-environment jsdom
/**
 * The artifact viewer's call to action, and the URL state behind it.
 *
 * What is real here and what is not: `ArtifactViewer` and `AgentPanel` are
 * both mounted for real, because two of the things worth asserting are
 * side effects of the panel actually mounting — the app nav collapsing, and
 * the session the panel is handed. `SessionScreen` is stubbed (it instantiates
 * the whole chat controller: Apollo, the AI SDK transport, uploads) and probes
 * the two props this page decides: which session the panel opens with and how
 * many messages came with it. `ArtifactFrame` is stubbed to probe the `panel`
 * prop, which is how the "an agent id never reaches the frame" invariant is
 * pinned from the viewer's side (the frame's own projection is covered by
 * app/artifacts/[artifact_name]/artifact-frame.test.tsx).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { UserContext } from "@/app/(application)/authenticated";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import enMessages from "@/messages/en.json";
import type { Agent } from "@/types/models/agent";

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

// The favourite star reads Apollo (a query plus a mutation); nothing here is
// about favourites.
vi.mock("../../hooks", () => ({
  useFavoriteArtifacts: () => ({
    isFavorite: () => false,
    toggle: vi.fn(),
    canFavorite: false,
  }),
}));

// HistoryRail reads its recents through Apollo.
vi.mock("@/app/(application)/chat/hooks", () => ({
  useChatSessions: () => ({
    sessions: [],
    itemCount: 0,
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

// Probes the two props the page decides for the panel. The messages are
// rendered, not only counted, so a foreign conversation's text can be asserted
// absent from the document rather than merely absent from a count.
vi.mock("@/app/(application)/chat/components/session-screen", () => ({
  SessionScreen: (props: {
    agent: { id: string };
    initialSession: { id: string } | null;
    initialMessages: { id?: string; text?: string }[];
  }) => (
    <div
      data-testid="session-screen"
      data-agent-id={props.agent.id}
      data-session-id={props.initialSession?.id ?? "(none)"}
      data-message-count={String(props.initialMessages.length)}
    >
      {props.initialMessages.map((message, index) => (
        <span key={message.id ?? index}>{message.text}</span>
      ))}
    </div>
  ),
}));

// Probes `panel`. Serialised rather than captured in a closure so the
// assertion reads the exact bytes the viewer handed over — an agent id hiding
// in an unexpected field would show up in the string.
vi.mock("@/app/artifacts/[artifact_name]/artifact-frame", () => ({
  ArtifactFrame: (props: { panel?: unknown }) => (
    <div
      data-testid="artifact-frame"
      data-panel={props.panel === undefined ? "(none)" : JSON.stringify(props.panel)}
    />
  ),
}));

import { resolveSlots, type ResolvedSlot } from "./resolve-slots";
import { ArtifactViewer, type ArtifactViewerProps } from "./viewer-client";

const agent = (id: string, name: string): Agent => ({ id, name, type: "agent" });

const ANALYST = agent("agent-1", "Pitch Analyst");
const REVIEWER = agent("agent-2", "Deal Reviewer");

const SLOT_ANALYSE: ResolvedSlot = { key: "analyse", label: ANALYST.name, agent: ANALYST };
const SLOT_REVIEW: ResolvedSlot = { key: "review", label: REVIEWER.name, agent: REVIEWER };

/** A session of REVIEWER's, with a message whose text must never be rendered beside ANALYST. */
const REVIEWER_SESSION = {
  id: "session-of-agent-2",
  title: "Deal review",
  agent: REVIEWER.id,
  createdAt: "2026-11-04T10:00:00.000Z",
  updatedAt: "2026-11-04T10:00:00.000Z",
  created_by: 7,
  rights_mode: "private",
  metadata: null,
  project: "p1",
  session_items: [],
};
const FOREIGN_MESSAGE = { id: "m1", text: "Reviewer conversation body" };

const ANALYST_SESSION = { ...REVIEWER_SESSION, id: "session-of-agent-1", agent: ANALYST.id };
const OWN_MESSAGE = { id: "m2", text: "Analyst conversation body" };

const CTA = "agent-cta";

/** What the simulated layout leaves the artifact; the test moves it. */
let artifactPx = 1000;
/** What the panel's own root measures — the number that must NOT reach the frame. */
const PANEL_PX = 400;
/** Captured ResizeObserver callbacks, so a resize can be driven by hand. */
let resizeCallbacks: ResizeObserverCallback[] = [];
const realGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

beforeEach(() => {
  artifactPx = 1000;
  resizeCallbacks = [];
  // The URL is this component's own state store; a test that opened a panel
  // must not leave `?agent=` behind for the next one.
  window.history.replaceState(null, "", "/");

  // SidebarProvider/useIsMobile, SidePanel/useMediaQuery and Radix's popper
  // all read matchMedia, which jsdom does not implement. Desktop: every
  // min-width query matches, no max-width one does — so SidePanel renders its
  // docked branch rather than a Sheet.
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

  // Radix's popper (the picker's content) observes its anchor, and the viewer
  // watches the artifact's own box through one.
  class RO {
    constructor(callback: ResizeObserverCallback) {
      resizeCallbacks.push(callback);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

  // jsdom computes no layout: every box is 0×0, so "the artifact's width" and
  // "the panel's width" would both be 0 and a test could not tell which one
  // reached the frame. This stands in for flow layout, with two
  // unmistakably different numbers:
  //   - the artifact's region is the box that holds the frame;
  //   - the panel's own root is the box that declares its collapse state
  //     (AgentPanel measures itself; see its data-state).
  HTMLElement.prototype.getBoundingClientRect = function () {
    const element = this as HTMLElement;
    const width = element.querySelector("[data-testid='artifact-frame']")
      ? artifactPx
      : element.dataset.state
        ? PANEL_PX
        : 0;
    return { width, height: 600, top: 0, left: 0, right: width, bottom: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
});

afterEach(() => {
  cleanup();
  HTMLElement.prototype.getBoundingClientRect = realGetBoundingClientRect;
});

/** The app nav's state, which the panel is supposed to collapse while it is up. */
function NavProbe() {
  const { open } = useSidebar();
  return <span data-testid="nav-open">{String(open)}</span>;
}

const show = (overrides: Partial<ArtifactViewerProps> = {}) => {
  const props: ArtifactViewerProps = {
    name: "pitch",
    filename: "pitch.html",
    authMode: "regular",
    status: "ready",
    html: "<p>pitch</p>",
    slots: [],
    initialSlotKey: null,
    initialSession: null,
    initialMessages: [],
    ...overrides,
  };
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <UserContext.Provider value={{ user: { id: 7 } }}>
        <SidebarProvider>
          <NavProbe />
          <ArtifactViewer {...props} />
        </SidebarProvider>
      </UserContext.Provider>
    </NextIntlClientProvider>,
  );
  return { ...view, props };
};

/**
 * Radix's DropdownMenuTrigger opens on pointerdown or Enter/Space/ArrowDown,
 * never on a plain click — and jsdom implements no PointerEvent, so a
 * synthesised pointerdown carries no `button` and Radix's `button === 0` gate
 * rejects it. Enter is the path that actually works here, and it is a real
 * user's path too.
 */
const openPicker = (trigger: HTMLElement) => fireEvent.keyDown(trigger, { key: "Enter" });

const panelOf = (): unknown => {
  const raw = screen.getByTestId("artifact-frame").getAttribute("data-panel") ?? "(none)";
  return raw === "(none)" ? undefined : JSON.parse(raw);
};

const viewportOf = () => (panelOf() as { viewport: { width: number; open: boolean } }).viewport;

/**
 * The panel's chat surface once it is on screen. `await`, not `get`, because
 * `AgentPanel` is a `next/dynamic` import: its chunk resolves a microtask
 * after the slot is chosen, exactly as it will in the browser.
 */
const panelScreen = () => screen.findByTestId("session-screen");

describe("ArtifactViewer agent CTA", () => {
  test("no CTA when the artifact has no slots", () => {
    show();

    expect(screen.queryByTestId(CTA)).toBeNull();
    expect(screen.queryByTestId("session-screen")).toBeNull();
  });

  test("one slot renders a single button labelled with the agent name", () => {
    show({ slots: [SLOT_ANALYSE] });

    const cta = screen.getByTestId(CTA);
    expect(cta.textContent).toContain("Pitch Analyst");
    expect(screen.getByRole("button", { name: /Pitch Analyst/ })).toBe(cta);
    // One button, not a picker: a single assignment needs no choosing.
    expect(screen.queryByRole("menuitem")).toBeNull();
  });

  test("several slots render one trigger that opens a picker", () => {
    show({ slots: [SLOT_ANALYSE, SLOT_REVIEW] });

    const triggers = screen.getAllByTestId(CTA);
    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toBe(
      screen.getByRole("button", { name: enMessages.artifacts.openAgentPanel }),
    );
    expect(screen.queryByTestId("session-screen")).toBeNull();

    openPicker(triggers[0]);

    expect(screen.getByRole("menuitem", { name: "Pitch Analyst" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Deal Reviewer" })).toBeTruthy();
  });

  test("a slot whose agent the user cannot reach is not offered", () => {
    // The reachability filter is the server-side join: the agents query is
    // RBAC-scoped, so an agent the viewer may not see is simply absent from
    // its result and the slot pointing at it is dropped — "not offered", never
    // an error.
    const resolved = resolveSlots(
      [
        { key: "analyse", agentId: ANALYST.id },
        { key: "ghost", agentId: "agent-nobody-can-see" },
      ],
      [ANALYST],
    );

    expect(resolved).toEqual([
      { key: "analyse", label: "Pitch Analyst", agent: ANALYST },
    ]);
  });

  test("no CTA for a non-app artifact even if slots exist", () => {
    show({ filename: "pitch.docx", html: undefined, slots: [SLOT_ANALYSE] });

    expect(screen.queryByTestId(CTA)).toBeNull();
  });

  test.each(["public", "password"] as const)(
    "no CTA on a %s share even if slots exist",
    (authMode) => {
      // The panel runs the chat as the viewing user; a share opened without a
      // session has nobody to run as. Absent, not disabled — and the frame is
      // told there is no panel, so an in-artifact trigger hides itself too.
      show({ authMode, slots: [SLOT_ANALYSE] });

      expect(screen.queryByTestId(CTA)).toBeNull();
      expect(screen.getByTestId("artifact-frame").getAttribute("data-panel")).toBe("(none)");
    },
  );

  test("choosing an agent opens the panel and collapses the nav", async () => {
    show({ slots: [SLOT_ANALYSE] });
    expect(screen.getByTestId("nav-open").textContent).toBe("true");

    fireEvent.click(screen.getByTestId(CTA));

    expect((await panelScreen()).getAttribute("data-agent-id")).toBe(ANALYST.id);
    await waitFor(() => expect(screen.getByTestId("nav-open").textContent).toBe("false"));
  });

  test("choosing from the picker opens that agent", async () => {
    show({ slots: [SLOT_ANALYSE, SLOT_REVIEW] });

    openPicker(screen.getByTestId(CTA));
    fireEvent.click(screen.getByRole("menuitem", { name: "Deal Reviewer" }));

    expect((await panelScreen()).getAttribute("data-agent-id")).toBe(REVIEWER.id);
  });

  test("closing the panel takes it down and gives the nav back", async () => {
    show({ slots: [SLOT_ANALYSE], initialSlotKey: "analyse" });
    await panelScreen();

    fireEvent.click(screen.getByRole("button", { name: enMessages.common.close }));

    expect(screen.queryByTestId("session-screen")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("nav-open").textContent).toBe("true"));
  });
});

describe("ArtifactViewer panel URL state", () => {
  test("?agent= opens that slot's panel on arrival", async () => {
    show({ slots: [SLOT_ANALYSE, SLOT_REVIEW], initialSlotKey: "review" });

    expect((await panelScreen()).getAttribute("data-agent-id")).toBe(REVIEWER.id);
  });

  test("?agent= naming a slot that is not offered opens nothing", () => {
    show({ slots: [SLOT_ANALYSE], initialSlotKey: "ghost" });

    expect(screen.queryByTestId("session-screen")).toBeNull();
    expect(screen.getByTestId(CTA)).toBeTruthy();
  });

  test("opening the panel puts the slot in the URL, so a reload restores it", async () => {
    // Nothing has been sent yet, so there is no session for the controller to
    // write — without this the panel would simply be gone after a reload.
    // `?agent=<key>` is what the page reads back to reopen it (see
    // "?agent= opens that slot's panel on arrival" above, which covers the
    // other half of the round trip).
    show({ slots: [SLOT_ANALYSE] });
    expect(window.location.search).toBe("");

    fireEvent.click(screen.getByTestId(CTA));
    await panelScreen();

    expect(new URLSearchParams(window.location.search).get("agent")).toBe("analyse");
  });

  test("closing the panel takes its state back out of the URL", async () => {
    show({ slots: [SLOT_ANALYSE], initialSlotKey: "analyse", initialSession: ANALYST_SESSION as never });
    await panelScreen();
    expect(window.location.search).not.toBe("");

    fireEvent.click(screen.getByRole("button", { name: enMessages.common.close }));

    await waitFor(() => expect(window.location.search).toBe(""));
  });

  test("an open conversation is in the URL with its slot, so a reload restores both", async () => {
    show({
      slots: [SLOT_ANALYSE, SLOT_REVIEW],
      initialSlotKey: "analyse",
      initialSession: ANALYST_SESSION as never,
      initialMessages: [OWN_MESSAGE] as never,
    });
    await panelScreen();

    const url = new URLSearchParams(window.location.search);
    expect(url.get("agent")).toBe("analyse");
    expect(url.get("session")).toBe("session-of-agent-1");
  });

  test("?session= of the open slot's own agent is restored", async () => {
    // The positive control for the test below: without it, "initialSession is
    // null" could pass because the session never reaches the panel at all.
    show({
      slots: [SLOT_ANALYSE, SLOT_REVIEW],
      initialSlotKey: "analyse",
      initialSession: ANALYST_SESSION as never,
      initialMessages: [OWN_MESSAGE] as never,
    });

    const screenEl = await panelScreen();
    expect(screenEl.getAttribute("data-session-id")).toBe("session-of-agent-1");
    expect(screenEl.getAttribute("data-message-count")).toBe("1");
    expect(screen.getByText("Analyst conversation body")).toBeTruthy();
  });

  test("?session= naming a session of another agent falls back to a new chat", async () => {
    // Review Focus 4. A session id is a URL the user can type, and the history
    // rail's rows and the lazy session create both land on `?session=<id>`
    // with no `?agent=`, so the id is NOT guaranteed to belong to the slot
    // that is open.
    show({
      slots: [SLOT_ANALYSE, SLOT_REVIEW],
      initialSlotKey: "analyse",
      initialSession: REVIEWER_SESSION as never,
      initialMessages: [FOREIGN_MESSAGE] as never,
    });

    const screenEl = await panelScreen();
    expect(screenEl.getAttribute("data-agent-id")).toBe(ANALYST.id);
    expect(screenEl.getAttribute("data-session-id")).toBe("(none)");
    expect(screenEl.getAttribute("data-message-count")).toBe("0");
    expect(screen.queryByText("Reviewer conversation body")).toBeNull();
  });

  test("a session is not carried over to a slot the user switches to", async () => {
    // Same rejection reached the other way: the URL's session is the analyst's
    // and the user picks the reviewer, so the reviewer's panel must start
    // empty rather than inherit a conversation that is not its own.
    show({
      slots: [SLOT_ANALYSE, SLOT_REVIEW],
      initialSlotKey: "analyse",
      initialSession: ANALYST_SESSION as never,
      initialMessages: [OWN_MESSAGE] as never,
    });

    await panelScreen();
    openPicker(screen.getByTestId(CTA));
    fireEvent.click(screen.getByRole("menuitem", { name: "Deal Reviewer" }));

    const screenEl = await waitFor(() => {
      const element = screen.getByTestId("session-screen");
      expect(element.getAttribute("data-agent-id")).toBe(REVIEWER.id);
      return element;
    });
    expect(screenEl.getAttribute("data-session-id")).toBe("(none)");
    expect(screen.queryByText("Analyst conversation body")).toBeNull();
  });
});

describe("ArtifactViewer → ArtifactFrame panel prop", () => {
  test("the frame is told slot keys and labels, never an agent id", () => {
    show({ slots: [SLOT_ANALYSE, SLOT_REVIEW] });

    const raw = screen.getByTestId("artifact-frame").getAttribute("data-panel") ?? "";
    expect(raw).not.toContain(ANALYST.id);
    expect(raw).not.toContain(REVIEWER.id);
    expect((panelOf() as { slots: unknown }).slots).toEqual([
      { key: "analyse", label: "Pitch Analyst" },
      { key: "review", label: "Deal Reviewer" },
    ]);
  });

  test("no panel is announced when nothing is assigned", () => {
    // `panel: false` rather than an empty slot list: an artifact author who
    // checks only `host.panel` must not end up with a button that can never
    // work.
    show();

    expect(screen.getByTestId("artifact-frame").getAttribute("data-panel")).toBe("(none)");
  });

  test("the viewport width is the ARTIFACT's, never the panel's", async () => {
    // The spec: "the parent posts the artifact's new viewport width over the
    // port so the artifact can reflow itself". An artifact decides whether it
    // still has room for three columns from the width IT has; the panel's own
    // width cannot answer that without the total. The simulated layout gives
    // the two boxes deliberately different numbers so this cannot pass by
    // coincidence.
    artifactPx = 1000;
    show({ slots: [SLOT_ANALYSE] });

    expect(viewportOf()).toEqual({ width: 1000, open: false });

    // Opening the panel squeezes the artifact: 1000 − the panel's 400.
    artifactPx = 1000 - PANEL_PX;
    fireEvent.click(screen.getByTestId(CTA));
    await panelScreen();

    await waitFor(() => expect(viewportOf()).toEqual({ width: 600, open: true }));
    expect(viewportOf().width).not.toBe(PANEL_PX);
  });

  test("a resize with no panel report still updates the artifact's width", async () => {
    // The docked → Sheet breakpoint flip produces no panel report at all, so
    // the artifact's own box is what has to be observed. Here the panel stays
    // put and only the window moves.
    artifactPx = 1000;
    show({ slots: [SLOT_ANALYSE], initialSlotKey: "analyse" });
    await panelScreen();

    artifactPx = 480;
    act(() => {
      for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);
    });

    expect(viewportOf().width).toBe(480);
  });

  test("no progress is announced before a turn has made any", () => {
    // `progressNonce` is an event counter; the frame announces on every change
    // of it, so it must be absent until something real has happened.
    show({ slots: [SLOT_ANALYSE] });

    expect((panelOf() as { progressNonce?: number }).progressNonce).toBeUndefined();
  });
});

describe("resolveSlots", () => {
  test("keeps the owner's slot order and labels with the agent's name", () => {
    const resolved = resolveSlots(
      [
        { key: "review", agentId: REVIEWER.id },
        { key: "analyse", agentId: ANALYST.id },
      ],
      [ANALYST, REVIEWER],
    );

    expect(resolved.map((slot) => slot.key)).toEqual(["review", "analyse"]);
    expect(resolved.map((slot) => slot.label)).toEqual(["Deal Reviewer", "Pitch Analyst"]);
  });

  test("an empty agents list offers nothing", () => {
    expect(resolveSlots([{ key: "analyse", agentId: ANALYST.id }], [])).toEqual([]);
  });

  test("an agent switched off after it was assigned is not offered", () => {
    // `agentByIds` does not filter by `active` the way the paginated query
    // could, so the rule lives here; the assignment UI only ever offered
    // active agents, so this is one that was deactivated afterwards.
    expect(resolveSlots([{ key: "analyse", agentId: ANALYST.id }], [{ ...ANALYST, active: false }])).toEqual([]);
    // An unselected field must not hide every agent.
    expect(resolveSlots([{ key: "analyse", agentId: ANALYST.id }], [{ ...ANALYST, active: undefined }])).toHaveLength(1);
  });

  test("a malformed stored slot is dropped rather than rendered", () => {
    // The column is json written by an older client; a row that predates
    // validation must degrade, not crash the page.
    expect(
      resolveSlots(
        [{ key: "", agentId: ANALYST.id }, { key: "ok", agentId: "" }] as never,
        [ANALYST],
      ),
    ).toEqual([]);
  });
});
