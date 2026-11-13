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

import type { UIMessage } from "ai";

import { UserContext } from "@/app/(application)/authenticated";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import type { AgentSlot } from "@/lib/api/shared-artifacts";
import enMessages from "@/messages/en.json";
import type { Agent } from "@/types/models/agent";
import type { AgentSession } from "@/types/models/agent-session";

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

// The minimal stand-in for a mounted controller that task 9's openRequest
// wiring reaches (same shape and reasoning as agent-panel.test.tsx's own
// fakeController) — NOT a `ChatSessionController` fixture, just the 4
// methods `applyOpenRequest` is ever handed.
const fakeController = vi.hoisted(() => ({
  seedInput: vi.fn(),
  addSessionItems: vi.fn(async () => {}),
  addSessionFiles: vi.fn(async () => {}),
  setFilesPanelOpen: vi.fn(async () => {}),
}));

// Probes the two props the page decides for the panel. The messages are
// rendered, not only counted, so a foreign conversation's text can be asserted
// absent from the document rather than merely absent from a count.
//
// Also simulates `onController` (task 9), the same way SessionScreenInner
// really does — every render, with `fakeController` standing in for the live
// controller — so a test here can observe whether AgentPanel's openRequest
// effect reached an actual controller handle, including across an AgentPanel
// REMOUNT (closing and reopening the panel): this mock lives for the whole
// test file, so `fakeController` is the one thing that survives a remount to
// prove whether a stale request was (wrongly) re-applied to it.
vi.mock("@/app/(application)/chat/components/session-screen", () => ({
  SessionScreen: (props: {
    agent: Agent;
    initialSession: AgentSession | null;
    initialMessages: UIMessage[];
    onController?: (controller: typeof fakeController) => void;
  }) => {
    React.useEffect(() => {
      props.onController?.(fakeController);
    });
    return (
      <div
        data-testid="session-screen"
        data-agent-id={props.agent.id}
        data-session-id={props.initialSession?.id ?? "(none)"}
        data-message-count={String(props.initialMessages.length)}
      >
        {props.initialMessages.map((message) => (
          <span key={message.id}>
            {message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")}
          </span>
        ))}
      </div>
    );
  },
}));

/** The `onOpenRequest` the viewer handed to the (stubbed) frame, captured so
 *  a test can simulate the artifact's postMessage without the real channel —
 *  functions do not survive the `panel` prop's JSON serialisation below, so
 *  this is the only way to reach it. */
let capturedOnOpenRequest: ((request: unknown) => void) | null = null;

// Probes `panel`. Serialised rather than captured in a closure so the
// assertion reads the exact bytes the viewer handed over — an agent id hiding
// in an unexpected field would show up in the string.
vi.mock("@/app/artifacts/[artifact_name]/artifact-frame", () => ({
  ArtifactFrame: (props: { panel?: { onOpenRequest?: (request: unknown) => void } }) => {
    capturedOnOpenRequest = props.panel?.onOpenRequest ?? null;
    return (
      <div
        data-testid="artifact-frame"
        data-panel={props.panel === undefined ? "(none)" : JSON.stringify(props.panel)}
      />
    );
  },
}));

import { choosePanelState, resolveSlots, type ResolvedSlot } from "./resolve-slots";
import { ArtifactViewer, type ArtifactViewerProps } from "./viewer-client";

const agent = (id: string, name: string): Agent => ({ id, name, type: "agent" });

const ANALYST = agent("agent-1", "Pitch Analyst");
const REVIEWER = agent("agent-2", "Deal Reviewer");

const SLOT_ANALYSE: ResolvedSlot = { key: "analyse", label: ANALYST.name, agent: ANALYST };
const SLOT_REVIEW: ResolvedSlot = { key: "review", label: REVIEWER.name, agent: REVIEWER };

/**
 * Declared as the production types rather than cast: the comparison under
 * test is `initialSession.agent === activeSlot.agent.id`, and `types/models/`
 * is hand-maintained until codegen lands — so these are exactly the shapes
 * that drift. Typed, a rename on either side fails the typecheck instead of
 * the product.
 */
const REVIEWER_SESSION: AgentSession = {
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
const ANALYST_SESSION: AgentSession = { ...REVIEWER_SESSION, id: "session-of-agent-1", agent: ANALYST.id };

const message = (id: string, text: string): UIMessage => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text }],
});
/** Must never be rendered beside ANALYST. */
const FOREIGN_MESSAGE = message("m1", "Reviewer conversation body");
const OWN_MESSAGE = message("m2", "Analyst conversation body");

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
  capturedOnOpenRequest = null;
  fakeController.seedInput.mockClear();
  fakeController.addSessionItems.mockClear();
  fakeController.addSessionFiles.mockClear();
  fakeController.setFilesPanelOpen.mockClear();
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

const wrapped = (props: ArtifactViewerProps) => (
  <NextIntlClientProvider locale="en" messages={enMessages}>
    <UserContext.Provider value={{ user: { id: 7 } }}>
      <SidebarProvider>
        <NavProbe />
        <ArtifactViewer {...props} />
      </SidebarProvider>
    </UserContext.Provider>
  </NextIntlClientProvider>
);

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
  const view = render(wrapped(props));
  // Re-renders the SAME tree with new props merged over the ones this call
  // used — e.g. simulating the in-panel history rail navigating to a
  // different `?session=`, which this page re-fetches and re-renders with
  // server-side, WITHOUT unmounting `ArtifactViewer` itself (only the
  // `AgentPanel` keyed on `panelSession.id` inside it remounts).
  const rerenderWith = (next: Partial<ArtifactViewerProps>) => {
    view.rerender(wrapped({ ...props, ...next }));
  };
  return { ...view, props, rerenderWith };
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
    show({ slots: [SLOT_ANALYSE], initialSlotKey: "analyse", initialSession: ANALYST_SESSION });
    await panelScreen();
    expect(window.location.search).not.toBe("");

    fireEvent.click(screen.getByRole("button", { name: enMessages.common.close }));

    await waitFor(() => expect(window.location.search).toBe(""));
  });

  test("an open conversation is in the URL with its slot, so a reload restores both", async () => {
    show({
      slots: [SLOT_ANALYSE, SLOT_REVIEW],
      initialSlotKey: "analyse",
      initialSession: ANALYST_SESSION,
      initialMessages: [OWN_MESSAGE],
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
      initialSession: ANALYST_SESSION,
      initialMessages: [OWN_MESSAGE],
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
      initialSession: REVIEWER_SESSION,
      initialMessages: [FOREIGN_MESSAGE],
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
      initialSession: ANALYST_SESSION,
      initialMessages: [OWN_MESSAGE],
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

describe("ArtifactViewer → openRequest wiring (task 9)", () => {
  test("an artifact's exulu:panel:open request reaches the mounted controller", async () => {
    show({ slots: [SLOT_ANALYSE] });

    act(() => {
      capturedOnOpenRequest?.({
        type: "exulu:panel:open",
        v: 2,
        slot: "analyse",
        prompt: "Summarise this filing",
      });
    });
    await panelScreen();

    await waitFor(() =>
      expect(fakeController.seedInput).toHaveBeenCalledWith("Summarise this filing"),
    );
  });

  test("closing and reopening through the viewer's own button does not replay a stale request", async () => {
    // The bug this guards: the viewer's plain header CTA (AgentTrigger,
    // below) opens a slot with NO prefill at all — it is not an open
    // REQUEST — so a request left over from an earlier artifact-triggered
    // open must not resurface on a later, unrelated open of the same slot.
    show({ slots: [SLOT_ANALYSE] });

    act(() => {
      capturedOnOpenRequest?.({
        type: "exulu:panel:open",
        v: 2,
        slot: "analyse",
        prompt: "Summarise this filing",
      });
    });
    await panelScreen();
    await waitFor(() => expect(fakeController.seedInput).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByLabelText(enMessages.common.close));
    expect(screen.queryByTestId("session-screen")).toBeNull();

    // Reopen the SAME slot through the viewer's own button — never through
    // onOpenRequest.
    fireEvent.click(screen.getByTestId(CTA));
    await panelScreen();

    // Give any (wrongly) re-queued application a chance to run before
    // asserting its absence.
    await act(async () => {
      await Promise.resolve();
    });
    expect(fakeController.seedInput).toHaveBeenCalledTimes(1);
  });

  test("a rail-style session change after a request has been applied does not replay it", async () => {
    // A different door to the SAME bug: the in-panel history rail (and "New
    // chat") navigate WITHIN this route (`?session=<id>`), which this page
    // re-renders with a new `initialSession` prop — never unmounting
    // `ArtifactViewer`. `panelSession` (derived from it) is in `AgentPanel`'s
    // own key, so this alone remounts the panel, resetting its internal
    // `appliedNonceRef` — the CTA-click guard above does not cover this path
    // at all, since neither `chooseSlot` nor `closePanel` run here.
    const { rerenderWith } = show({ slots: [SLOT_ANALYSE], initialSession: null });

    act(() => {
      capturedOnOpenRequest?.({
        type: "exulu:panel:open",
        v: 2,
        slot: "analyse",
        prompt: "Summarise this filing",
      });
    });
    await panelScreen();
    await waitFor(() => expect(fakeController.seedInput).toHaveBeenCalledTimes(1));

    // Same slot, a DIFFERENT session of the same agent — exactly what
    // clicking a rail row (or "New chat", landing on a fresh session once
    // one exists) produces.
    act(() => {
      rerenderWith({ initialSession: ANALYST_SESSION });
    });
    await panelScreen();

    await act(async () => {
      await Promise.resolve();
    });
    expect(fakeController.seedInput).toHaveBeenCalledTimes(1);
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
    // validation must degrade, not crash the page. Cast because the point is
    // input that is NOT a valid AgentSlot.
    const malformed = [{ key: "", agentId: ANALYST.id }, { key: "ok", agentId: "" }] as AgentSlot[];

    expect(resolveSlots(malformed, [ANALYST])).toEqual([]);
  });
});

describe("choosePanelState", () => {
  const SLOTS = [SLOT_ANALYSE, SLOT_REVIEW];

  test("?agent= addresses a slot by key", () => {
    expect(choosePanelState({ slots: SLOTS, session: null, urlAgent: "review" })).toEqual({
      initialSlotKey: "review",
      keep: false,
    });
  });

  test("?agent= naming no offered slot opens nothing", () => {
    expect(choosePanelState({ slots: SLOTS, session: null, urlAgent: "ghost" })).toEqual({
      initialSlotKey: null,
      keep: false,
    });
  });

  test("a session alone finds its own slot, so a reload of ?session= reopens the panel", () => {
    // The history rail's rows and the lazy session create both land on
    // `?session=<id>` with no `?agent=`.
    expect(choosePanelState({ slots: SLOTS, session: ANALYST_SESSION, urlAgent: undefined })).toEqual({
      initialSlotKey: "analyse",
      keep: true,
    });
  });

  test("a session of another agent is not kept, and the addressed slot still opens", () => {
    // Review Focus 4: a new chat on the slot the URL asked for, never the
    // other agent's conversation.
    expect(choosePanelState({ slots: SLOTS, session: REVIEWER_SESSION, urlAgent: "analyse" })).toEqual({
      initialSlotKey: "analyse",
      keep: false,
    });
  });

  test("a session is kept when another slot points at the same agent", () => {
    // Two slots may legitimately share one agent — the assignment UI rejects
    // a duplicate KEY, not a duplicate agent. Comparing slot keys would find
    // "deep" as the session's owner, decide it is not "analyse", and throw
    // away the user's own conversation. The predicate is agent identity.
    const deep: ResolvedSlot = { key: "deep", label: ANALYST.name, agent: ANALYST };

    expect(choosePanelState({ slots: [deep, SLOT_ANALYSE], session: ANALYST_SESSION, urlAgent: "analyse" })).toEqual({
      initialSlotKey: "analyse",
      keep: true,
    });
  });

  test("a session whose agent has no slot at all opens nothing", () => {
    expect(choosePanelState({ slots: [SLOT_REVIEW], session: ANALYST_SESSION, urlAgent: undefined })).toEqual({
      initialSlotKey: null,
      keep: false,
    });
  });

  test("a session that did not load leaves the addressed slot on a new chat", () => {
    // Another user's session comes back null from the RBAC-scoped query.
    expect(choosePanelState({ slots: SLOTS, session: null, urlAgent: "analyse" })).toEqual({
      initialSlotKey: "analyse",
      keep: false,
    });
  });

  test("nothing in the URL opens nothing", () => {
    expect(choosePanelState({ slots: SLOTS, session: null, urlAgent: undefined })).toEqual({
      initialSlotKey: null,
      keep: false,
    });
  });
});

describe("ArtifactViewer host height", () => {
  test("the viewer bounds itself to the viewport like the chat shell does", () => {
    // The app shell gives pages no definite height (SidebarProvider is
    // min-h-svh, the content column scrolls), so an `h-full` chain under it
    // resolves to auto and grows with the panel's conversation instead of
    // letting the message column scroll — the composer ends up below the
    // fold. The chat route owns a dvh-bounded host (chat-shell.tsx); the
    // viewer, which hosts the same SessionScreen beside the artifact, must too.
    show();
    const root = screen.getByTestId("artifact-viewer");
    expect(root.className).toContain("md:h-[calc(100dvh-3rem)]");
    expect(root.className).toContain("h-[calc(100dvh-3rem-env(safe-area-inset-top))]");
    expect(root.className).not.toMatch(/\bh-full\b/);
  });
});
