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
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { UserContext } from "@/app/(application)/authenticated";
import { SidebarProvider } from "@/components/ui/sidebar";
import enMessages from "@/messages/en.json";

const toastSpies = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastSpies }));

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

// The minimal stand-in for a mounted `ChatSessionController` that task 9's
// openRequest wiring reads from — NOT a `ChatSessionController` fixture (the
// real interface has ~40 fields; this is only the 4 methods
// `applyOpenRequest` is ever handed), so it is typed to its own narrow shape
// rather than the production type or an `as never`/`as any` escape.
const fakeController = vi.hoisted(() => ({
  // The one non-method field the panel reads: the close affordances consult
  // it to decide whether an X/Escape means close or collapse. Mutable so a
  // test can put a turn in flight. Typed as the real ChatStatus union
  // (declared here rather than imported — the chat feature's types are behind
  // the cross-feature tier rule this file deliberately does not widen).
  status: "ready" as "ready" | "submitted" | "streaming" | "error",
  seedInput: vi.fn(),
  addSessionItems: vi.fn(async () => {}),
  addSessionFiles: vi.fn(async () => {}),
  setFilesPanelOpen: vi.fn(async () => {}),
}));

// Stands in for the chat surface AND probes the shell context from where the
// real SessionScreen's subtree reads it — ChatHeader's new-chat destination is
// delivered that way, not by prop. The context module is pulled in with a
// dynamic import because a static one would trip the cross-feature tier rule
// (agent-panel.tsx carries a narrow, documented disable for its own four
// imports; a test has no business widening that).
//
// Also simulates `onController` (task 9): the real SessionScreenInner calls
// it every render with the live controller it just instantiated — this stub
// does the same with `fakeController`, which is what lets this file prove
// AgentPanel's openRequest effect reaches an actual controller handle rather
// than asserting on its own internals.
vi.mock("@/app/(application)/chat/components/session-screen", async () => {
  const { useChatShell } =
    await import("@/app/(application)/chat/components/chat-shell");
  return {
    SessionScreen: (props: {
      sessionPath?: (id: string) => string;
      onController?: (controller: typeof fakeController) => void;
      onProgress?: (reason: "tool" | "turn") => void;
    }) => {
      const shell = useChatShell();
      React.useEffect(() => {
        props.onController?.(fakeController);
      });
      return (
        <div
          data-testid="session-screen"
          data-session-path={props.sessionPath?.("session-9") ?? "(none)"}
          data-new-chat-path={shell.newChatPath ?? "(none)"}
          // Task 10: the real SessionScreenInner derives the bump itself
          // and calls this; this stub has no controller to derive it from,
          // so it only proves AgentPanel handed the SAME function down —
          // the one concrete thing this host is responsible for getting
          // right (a dropped forward is a silent no-op, not a type error,
          // because the prop is optional on both ends).
          data-has-on-progress={props.onProgress ? "yes" : "no"}
        />
      );
    },
  };
});

import { AgentPanel } from "./agent-panel";

const AGENT = { id: "agent-1", name: "Pitch Analyst", type: "agent" as const };

/** Captured ResizeObserver callbacks, so a resize can be driven by hand. */
let resizeCallbacks: ResizeObserverCallback[] = [];
/** matchMedia change listeners, so a breakpoint flip can be driven by hand. */
let mediaListeners: Array<() => void> = [];
let desktopViewport = true;
/** The docked panel's width in the simulated layout below. */
let dockedWidth = 400;
/** The collapsed edge's width: the `w-8` its container carries. */
const EDGE_PX = 32;
const realGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

const flipViewport = (toDesktop: boolean) => {
  desktopViewport = toDesktop;
  for (const listener of mediaListeners) listener();
};

beforeEach(() => {
  resizeCallbacks = [];
  mediaListeners = [];
  desktopViewport = true;
  dockedWidth = 400;
  fakeController.status = "ready";
  fakeController.seedInput.mockClear();
  fakeController.addSessionItems.mockClear();
  fakeController.addSessionFiles.mockClear();
  fakeController.setFilesPanelOpen.mockClear();
  toastSpies.error.mockClear();
  toastSpies.info.mockClear();
  toastSpies.warning.mockClear();

  // SidebarProvider/useIsMobile and SidePanel/useMediaQuery both read
  // matchMedia, which jsdom does not implement. Desktop by default: every
  // min-width query matches, no max-width one does — so SidePanel renders its
  // DOCKED branch, the one that takes width away from the artifact. Listeners
  // are captured so a test can narrow the window mid-life (useMediaQuery
  // subscribes through useSyncExternalStore).
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query.includes("max-width") ? !desktopViewport : desktopViewport;
    },
    media: query,
    addEventListener: (_event: string, listener: () => void) => {
      mediaListeners.push(listener);
    },
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  class RO {
    constructor(callback: ResizeObserverCallback) {
      resizeCallbacks.push(callback);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

  // jsdom computes no layout: every box is 0×0, so the panel would report 0 in
  // every state and the three widths it contracts to deliver would all pass
  // vacuously. This stands in for flow layout, mapping each state onto the
  // geometry a browser would produce:
  //   - collapsed: only the thin edge is in the row;
  //   - docked:    the panel is in the row at its (dragged) width;
  //   - Sheet:     nothing is — Radix portals it out of this subtree.
  // State, not class names: the root declares it, and CSS is what turns it
  // into geometry.
  HTMLElement.prototype.getBoundingClientRect = function () {
    const element = this as HTMLElement;
    const width =
      element.dataset.state === "collapsed"
        ? EDGE_PX
        : element.querySelector("[role='complementary']")
          ? dockedWidth
          : 0;
    return {
      width,
      height: 600,
      top: 0,
      left: 0,
      right: width,
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
    openRequest: null,
    onRequestApplied: vi.fn(),
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

  test("sends the header's new chat to the artifact URL too", () => {
    // ChatHeader navigates by itself (its new-chat button, and the return to a
    // fresh chat after a delete); it reads the destination off the shell
    // context, so the panel has to put it there or the user is navigated off
    // the artifact page. See chat/components/chat-header-new-chat.test.tsx for
    // the header's own half of this contract.
    show();

    expect(
      screen.getByTestId("session-screen").getAttribute("data-new-chat-path"),
    ).toBe("/artifacts/open/pitch");
  });

  test("reports its width on mount and on resize", () => {
    const { props } = show();

    expect(props.onWidthChange).toHaveBeenCalledWith(400);

    // A resize drag: the box changes without this component knowing, which is
    // what the observer is for.
    dockedWidth = 640;
    act(() => {
      for (const callback of resizeCallbacks)
        callback([], {} as ResizeObserver);
    });

    expect(props.onWidthChange).toHaveBeenCalledWith(640);
  });

  test("reports the thin edge's width when it collapses", () => {
    // Task 8 turns these numbers into the artifact's viewport, so each state
    // this component contracts to report needs its own coverage. No observer
    // is fired here on purpose: a collapse is a change THIS component makes,
    // so it must report without waiting for the observer's next frame.
    // Own spy rather than the one `show` defaults in: this test clears it
    // between the mount report and the collapse, and `props` is a union once
    // overrides are spread in, so it has no mock type to clear.
    const onWidthChange = vi.fn();
    show({ onWidthChange });
    onWidthChange.mockClear();

    fireEvent.click(screen.getByLabelText(enMessages.artifacts.panelCollapse));

    expect(onWidthChange).toHaveBeenCalledWith(EDGE_PX);
    // Ties EDGE_PX to the production class: jsdom computes no layout, so the
    // `w-8` on the edge container IS its width.
    expect(
      screen.getByLabelText(enMessages.artifacts.panelExpand).parentElement
        ?.className,
    ).toContain("w-8");
  });

  test("reports zero below lg, where it overlays instead of squeezing", () => {
    desktopViewport = false;
    const { container, props } = show();

    expect(props.onWidthChange).toHaveBeenCalledWith(0);
    // Nothing of the panel is in the artifact's row — SidePanel's Sheet is
    // portalled to the body, which is why it costs the artifact no width...
    expect(container.querySelector("[role='complementary']")).toBeNull();
    // ...and the conversation is mounted all the same.
    expect(screen.getByTestId("session-screen")).toBeTruthy();
  });

  test("offers no collapse control below lg, where it would discard the chat", () => {
    // A Sheet's content is portalled out of the panel's subtree, so hiding
    // cannot reach it; collapsing could only close it, and Radix unmounts
    // closed sheet content — the conversation would vanish under a control
    // that promises to keep it. Close (the X) is the right affordance there.
    desktopViewport = false;
    show();

    expect(
      screen.queryByLabelText(enMessages.artifacts.panelCollapse),
    ).toBeNull();
    expect(
      screen.queryByLabelText(enMessages.artifacts.panelExpand),
    ).toBeNull();
    expect(screen.getByLabelText(enMessages.common.close)).toBeTruthy();
  });

  test("a collapsed panel narrowed past lg comes back as the sheet", () => {
    // Otherwise it would be stranded: the edge is not rendered below lg, so a
    // panel left collapsed would have no way back and the host would still
    // believe it was open.
    const { container, props } = show();
    fireEvent.click(screen.getByLabelText(enMessages.artifacts.panelCollapse));
    expect(container.querySelector("[data-state='collapsed']")).not.toBeNull();

    act(() => flipViewport(false));

    expect(container.querySelector("[data-state='collapsed']")).toBeNull();
    expect(screen.getByTestId("session-screen")).toBeTruthy();
    expect(
      screen.queryByLabelText(enMessages.artifacts.panelExpand),
    ).toBeNull();
    expect(props.onWidthChange).toHaveBeenLastCalledWith(0);
  });

  test("focus follows the collapse, in both directions", () => {
    // Both controls live in the subtree the other state removes, so without
    // this activeElement falls back to <body> — and SidePanel's own focus
    // management cannot help, because its `open` never changes.
    show();

    fireEvent.click(screen.getByLabelText(enMessages.artifacts.panelCollapse));
    expect(document.activeElement).toBe(
      screen.getByLabelText(enMessages.artifacts.panelExpand),
    );

    fireEvent.click(screen.getByLabelText(enMessages.artifacts.panelExpand));
    expect(document.activeElement).toBe(
      screen.getByLabelText(enMessages.artifacts.panelCollapse),
    );
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

  /**
   * Closing mid-turn is the spec's named anti-goal: unmounting this component
   * takes `useTurnProgress` with it while the backend's
   * persistThroughDisconnect keeps the turn running, so the agent finishes and
   * writes while the artifact goes on showing its load-time snapshot with
   * nothing on screen to say so. Collapse is the affordance that exists for
   * exactly this — and Escape is one stray keypress away from the trap.
   */
  describe("a close affordance used mid-turn", () => {
    /** The docked panel's root — where SidePanel binds its Escape handler. */
    const dockedPanel = (container: HTMLElement) =>
      container.querySelector("[role='complementary']") as HTMLElement;

    test.each(["streaming", "submitted"] as const)(
      "the X collapses rather than closes while the turn is %s",
      (status) => {
        fakeController.status = status;
        const { container, props } = show();

        fireEvent.click(screen.getByLabelText(enMessages.common.close));

        expect(props.onClose).not.toHaveBeenCalled();
        // The session — and so the progress feed the artifact refreshes off —
        // is still mounted.
        expect(screen.getByTestId("session-screen")).toBeTruthy();
        expect(dockedPanel(container)).not.toBeNull();
        expect(
          container.querySelector("[data-state='collapsed']"),
        ).not.toBeNull();
        expect(toastSpies.info).toHaveBeenCalledWith(
          enMessages.artifacts.panelCollapsedWhileWorking,
        );
      },
    );

    test("Escape collapses too — it must not be the quiet door out", () => {
      fakeController.status = "streaming";
      const { container, props } = show();

      fireEvent.keyDown(dockedPanel(container), { key: "Escape" });

      expect(props.onClose).not.toHaveBeenCalled();
      expect(
        container.querySelector("[data-state='collapsed']"),
      ).not.toBeNull();
      expect(screen.getByTestId("session-screen")).toBeTruthy();
    });

    test("once the turn settles, the X closes again", () => {
      fakeController.status = "streaming";
      const { props } = show();
      fireEvent.click(screen.getByLabelText(enMessages.common.close));
      expect(props.onClose).not.toHaveBeenCalled();

      // Expand, let the turn finish, close for real.
      fireEvent.click(screen.getByLabelText(enMessages.artifacts.panelExpand));
      fakeController.status = "ready";
      fireEvent.click(screen.getByLabelText(enMessages.common.close));

      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    test("below lg the close is honoured — but the user is told, never left guessing", () => {
      // There is no collapse to route to there (the panel is a Sheet Radix
      // portals out of this subtree, and it costs the artifact no width), and
      // refusing the close would trap the user behind a panel they cannot
      // dismiss for as long as the turn runs. So it closes — with a warning,
      // because the artifact will now stop updating.
      desktopViewport = false;
      fakeController.status = "streaming";
      const { props } = show();

      fireEvent.click(screen.getByLabelText(enMessages.common.close));

      expect(props.onClose).toHaveBeenCalledTimes(1);
      expect(toastSpies.warning).toHaveBeenCalledWith(
        enMessages.artifacts.panelClosedWhileWorking,
      );
      expect(toastSpies.info).not.toHaveBeenCalled();
    });

    test("a settled turn below lg closes with nothing to say", () => {
      desktopViewport = false;
      const { props } = show();

      fireEvent.click(screen.getByLabelText(enMessages.common.close));

      expect(props.onClose).toHaveBeenCalledTimes(1);
      expect(toastSpies.warning).not.toHaveBeenCalled();
      expect(toastSpies.info).not.toHaveBeenCalled();
    });
  });

  test("never calls onProgress itself — SessionScreenInner (chat feature) owns that derivation", () => {
    const { props } = show();

    expect(props.onProgress).not.toHaveBeenCalled();
  });

  test("forwards onProgress to SessionScreen, which owns the actual derivation", () => {
    // SessionScreenInner (the real component, stubbed here) is the one that
    // calls useTurnProgress over its own controller and invokes this — this
    // host's only job is to hand down the SAME callback it was given, the
    // same way it already does for sessionPath and onController.
    const { getByTestId } = show();

    expect(getByTestId("session-screen").dataset.hasOnProgress).toBe("yes");
  });

  describe("openRequest (task 9: apply against the mounted controller)", () => {
    test("seeds the prompt, opens the files panel, and adopts the files", async () => {
      show({
        openRequest: {
          nonce: 1,
          request: {
            type: "exulu:panel:open",
            v: 2,
            slot: "advisor",
            prompt: "Summarise this filing",
            items: ["ctx-1"],
            files: ["user_1/report.pdf"],
          },
        },
      });

      // seedInput is synchronous (applied before applyOpenRequest's first
      // await), so it is already visible; the rest runs after the effect's
      // fire-and-forget promise chain settles, hence waitFor.
      expect(fakeController.seedInput).toHaveBeenCalledWith(
        "Summarise this filing",
      );
      await waitFor(() => {
        expect(fakeController.addSessionItems).toHaveBeenCalledWith(["ctx-1"]);
        // `false`: a transient open — an artifact's attach must not flip
        // this user's GLOBAL "files panel open by default" preference for
        // every future, unrelated chat (ChatSessionController.
        // setFilesPanelOpen's `persist` param).
        expect(fakeController.setFilesPanelOpen).toHaveBeenCalledWith(true, false);
        expect(fakeController.addSessionFiles).toHaveBeenCalledWith([
          "user_1/report.pdf",
        ]);
      });
    });

    test("does not apply a null openRequest", () => {
      show({ openRequest: null });

      expect(fakeController.seedInput).not.toHaveBeenCalled();
    });

    test("reports the request applied the moment dispatch is committed to, not on completion", () => {
      // onRequestApplied is the viewer's cue to clear its own openRequest
      // state (see AgentPanelProps' doc comment) — it must fire even while
      // the orchestration is still in flight, so a remount that lands
      // before it settles still finds nothing stale to replay.
      const onRequestApplied = vi.fn();
      fakeController.addSessionItems.mockImplementationOnce(
        () => new Promise(() => {}), // never resolves in this test's lifetime
      );

      show({
        onRequestApplied,
        openRequest: {
          nonce: 1,
          request: { type: "exulu:panel:open", v: 2, slot: "advisor", items: ["ctx-1"] },
        },
      });

      expect(onRequestApplied).toHaveBeenCalledTimes(1);
    });

    test("surfaces a toast when applying the request fails, instead of an unhandled rejection", async () => {
      fakeController.addSessionItems.mockRejectedValueOnce(new Error("network error"));

      show({
        openRequest: {
          nonce: 1,
          request: { type: "exulu:panel:open", v: 2, slot: "advisor", items: ["ctx-1"] },
        },
      });

      await waitFor(() =>
        expect(toastSpies.error).toHaveBeenCalledWith(
          enMessages.artifacts.openRequestFailed,
          { description: "network error" },
        ),
      );
    });

    test("a second click on the ALREADY-mounted panel (new nonce) is applied again", () => {
      const { rerender, props } = show({
        openRequest: {
          nonce: 1,
          request: { type: "exulu:panel:open", v: 2, slot: "advisor", prompt: "First" },
        },
      });
      expect(fakeController.seedInput).toHaveBeenCalledWith("First");

      act(() => {
        rerender(
          <NextIntlClientProvider locale="en" messages={enMessages}>
            <UserContext.Provider value={{ user: { id: 7 } }}>
              <SidebarProvider>
                <AgentPanel
                  {...props}
                  openRequest={{
                    nonce: 2,
                    request: { type: "exulu:panel:open", v: 2, slot: "advisor", prompt: "Second" },
                  }}
                />
              </SidebarProvider>
            </UserContext.Provider>
          </NextIntlClientProvider>,
        );
      });

      expect(fakeController.seedInput).toHaveBeenCalledWith("Second");
      expect(fakeController.seedInput).toHaveBeenCalledTimes(2);
    });

    test("the SAME nonce is not re-applied on an unrelated re-render", () => {
      const openRequest = {
        nonce: 1,
        request: { type: "exulu:panel:open" as const, v: 2, slot: "advisor", prompt: "First" },
      };
      const { rerender, props } = show({ openRequest });
      expect(fakeController.seedInput).toHaveBeenCalledTimes(1);

      // A resize, a collapse toggle, anything — re-renders with the SAME
      // openRequest value must not re-seed.
      act(() => {
        rerender(
          <NextIntlClientProvider locale="en" messages={enMessages}>
            <UserContext.Provider value={{ user: { id: 7 } }}>
              <SidebarProvider>
                <AgentPanel {...props} openRequest={openRequest} />
              </SidebarProvider>
            </UserContext.Provider>
          </NextIntlClientProvider>,
        );
      });

      expect(fakeController.seedInput).toHaveBeenCalledTimes(1);
    });
  });
});
