// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ArtifactFrame } from "./artifact-frame";

// vitest.config.ts does not set test.globals, so testing-library's implicit
// afterEach(cleanup) never registers — unmount explicitly.
afterEach(cleanup);

const GRANT_BODY = {
  token: "jwt-abc",
  backendOrigin: "http://backend.test",
  user: { email: "a@b.test", name: "A B" },
};

function stubFetch(ok = true) {
  const fetchMock = vi.fn(async () => ({
    ok,
    status: ok ? 200 : 404,
    json: async () => GRANT_BODY,
  }) as any);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

type PanelProp = ComponentProps<typeof ArtifactFrame>["panel"];

function renderFrame(grantIdentity: boolean, panel?: PanelProp) {
  const frameFor = (nextPanel?: PanelProp) => (
    <ArtifactFrame
      html="<p>hi</p>"
      title="app.html"
      artifactName="my-artifact"
      grantIdentity={grantIdentity}
      panel={nextPanel}
    />
  );
  const result = render(frameFor(panel));
  const frame = result.container.querySelector("iframe") as HTMLIFrameElement;
  // The viewer builds the `panel` object inline, so every parent render hands
  // the frame a fresh object with unchanged values — which is exactly what
  // must put no traffic on the port.
  const rerenderWith = (nextPanel?: PanelProp) => result.rerender(frameFor(nextPanel));
  return { ...result, frame, rerenderWith };
}

/**
 * vitest's spyOn calls through by default, and a real postMessage would
 * actually transfer port2 — neutering it in this context so the refresh test
 * could not use it. Replace the implementation instead.
 */
function spyPost(frame: HTMLIFrameElement) {
  // Window.postMessage is overloaded — (message, targetOrigin, transfer?) and
  // (message, options?) — and TS's Parameters<> resolves an overloaded
  // method's spy to the *last* signature, which has no index-2 element. That
  // breaks the 3-arg destructuring/indexing below at the type level only (all
  // assertions here are unchanged in intent from the original helper; this is
  // purely to satisfy tsc). Narrow the object to the single signature
  // actually used before spying so the mock is typed against the right
  // overload.
  const win = frame.contentWindow as unknown as {
    postMessage(message: any, targetOrigin: string, transfer?: Transferable[]): void;
  };
  return vi.spyOn(win, "postMessage").mockImplementation(() => {});
}

/** A request as the artifact would post it. */
const request = (source: MessageEventSource | null, v: number = 1) =>
  new MessageEvent("message", {
    data: { type: "exulu:identity:request", v },
    source,
  });

/** Port delivery is queued, never synchronous — let the queue drain. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The frame's own genuine load event — never a synthesised one. */
const loadOnce = (frame: HTMLIFrameElement) =>
  new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));

/**
 * Drains the loop long enough to catch a message that should not arrive.
 *
 * A retired port is answered with silence by design, so assertions about one
 * have no in-band barrier to wait on and have to settle instead. Every test
 * that uses this first exercises the same path on the *live* port as a
 * positive control, which both proves the path works and shows how few turns
 * it actually needs — far fewer than this.
 */
const settle = async (turns = 40) => {
  for (let turn = 0; turn < turns; turn += 1) await flush();
};

/**
 * Resolves on the first port message of a given type.
 *
 * The port carries two protocols, and the host's panel announcements are
 * queued on it ahead of the identity grant, so a test waiting for an identity
 * answer has to name the message it wants rather than take whatever arrives
 * first.
 */
function nextOfType(port: MessagePort, type: string) {
  return new Promise<any>((resolve) => {
    port.onmessage = (event) => {
      if (event.data?.type === type) resolve(event.data);
    };
  });
}

/**
 * Drives the handshake the way the artifact does and returns the artifact's
 * end of the channel, with everything the host posts over it collected in
 * arrival order.
 */
function handshake(frame: HTMLIFrameElement) {
  const post = spyPost(frame);
  window.dispatchEvent(request(frame.contentWindow));
  const port = (post.mock.calls[0]![2] as Transferable[])[0] as MessagePort;
  const received: any[] = [];
  port.onmessage = (event) => received.push(event.data);
  port.start();
  const ofType = (type: string) => received.filter((message) => message?.type === type);
  /**
   * Waits until at least `count` messages of `type` have arrived.
   *
   * Port delivery is not bounded to one turn of the loop: under jsdom
   * MessagePort is Node's, whose delivery is scheduled on the event loop, so
   * a single flush races under load. Negative assertions ("nothing was sent")
   * therefore wait on a *later* message as a barrier — the queue is FIFO, so
   * if that one arrived, anything queued before it has too.
   */
  const until = async (type: string, count = 1) => {
    for (let turn = 0; turn < 200 && ofType(type).length < count; turn += 1) {
      await flush();
    }
    return ofType(type);
  };
  return { post, port, received, ofType, until };
}

// The agent-panel channel is versioned separately from the identity
// handshake (CHANNEL_V = 2 vs. v: 1). Spelled out literally here rather than
// imported: these tests speak the wire as a third-party artifact sees it, and
// a test that imported the constant could not catch a version change.
const SLOTS = [{ key: "analyse", label: "Pitch-Agent" }];
const openRequest = (slot: string, extra: Record<string, unknown> = {}) => ({
  type: "exulu:panel:open",
  v: 2,
  slot,
  ...extra,
});

describe("ArtifactFrame", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  test("keeps the sandbox flags and never adds allow-same-origin", () => {
    const { frame } = renderFrame(true);
    expect(frame.getAttribute("sandbox")).toBe(
      "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms",
    );
    expect(frame.getAttribute("sandbox")).not.toContain("allow-same-origin");
  });

  // Regression test for the finding: contentWindow is a WindowProxy whose
  // identity survives a navigation of the frame, so the credential must never
  // be posted at the window after an await (a navigated-then-malicious
  // artifact could intercept it). The channel handoff must happen
  // synchronously, in the same task as dispatching the request, and must
  // carry no credential. Stubbing fetch to never resolve means that if this
  // assertion is reached at all, the post already happened before any await.
  test("hands the channel over synchronously, before the identity fetch resolves", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { frame } = renderFrame(true);
    const post = spyPost(frame);

    window.dispatchEvent(request(frame.contentWindow));

    expect(post).toHaveBeenCalledTimes(1);
    const [message, targetOrigin, transfer] = post.mock.calls[0]!;
    expect(message).toEqual({ type: "exulu:identity:channel", v: 1 });
    expect(JSON.stringify(message)).not.toContain("token");
    expect(targetOrigin).toBe("*");
    expect((transfer as Transferable[])[0]).toBeInstanceOf(MessagePort);
  });

  test("delivers the grant over the port, not the window", async () => {
    const fetchMock = stubFetch();
    const { frame } = renderFrame(true);
    const post = spyPost(frame);

    window.dispatchEvent(request(frame.contentWindow));

    const port = (post.mock.calls[0]![2] as Transferable[])[0] as MessagePort;
    const granted = nextOfType(port, "exulu:identity:grant");
    port.start();

    expect(await granted).toMatchObject({
      type: "exulu:identity:grant",
      v: 1,
      ...GRANT_BODY,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/artifacts/my-artifact/identity",
      expect.objectContaining({ cache: "no-store" }),
    );
    // Only the channel handoff ever reaches contentWindow.postMessage; the
    // credential never does.
    expect(post).toHaveBeenCalledTimes(1);
  });

  // Review Focus 3: a second iframe, a nested frame, or the page itself.
  test("ignores a request from a window that is not its frame", async () => {
    const fetchMock = stubFetch();
    const { frame } = renderFrame(true);
    const post = spyPost(frame);

    window.dispatchEvent(request(window));
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  test("ignores a message of an unknown type from its own frame", async () => {
    const fetchMock = stubFetch();
    const { frame } = renderFrame(true);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "something:else" },
        source: frame.contentWindow,
      }),
    );
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("attaches no message listener when the capability is off", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const fetchMock = stubFetch();
    try {
      renderFrame(false);
      expect(
        addSpy.mock.calls.some(([type]) => type === "message"),
      ).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      addSpy.mockRestore();
    }
  });

  test("denies instead of granting when the identity route refuses", async () => {
    stubFetch(false);
    const { frame } = renderFrame(true);
    const post = spyPost(frame);

    window.dispatchEvent(request(frame.contentWindow));

    const port = (post.mock.calls[0]![2] as Transferable[])[0] as MessagePort;
    const answer = nextOfType(port, "exulu:identity:denied");
    port.start();

    expect(await answer).toMatchObject({
      type: "exulu:identity:denied",
      v: 1,
    });
  });

  test("answers a refresh over the port with a fresh grant", async () => {
    const fetchMock = stubFetch();
    const { frame } = renderFrame(true);
    const post = spyPost(frame);

    window.dispatchEvent(request(frame.contentWindow));
    const port = (post.mock.calls[0]![2] as Transferable[])[0] as MessagePort;

    const first = nextOfType(port, "exulu:identity:grant");
    port.start();
    await first;

    const refreshed = nextOfType(port, "exulu:identity:grant");
    port.postMessage({ type: "exulu:identity:refresh", v: 1 });

    expect(await refreshed).toMatchObject({
      type: "exulu:identity:grant",
      v: 1,
      token: "jwt-abc",
    });
    // A refresh re-reads the identity route; it does not replay a cached grant.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // Review Focus 5: the fetch is async; unmounting mid-handshake must not
  // deliver a credential onto the port.
  test("does not deliver a grant over the port that resolves after unmount", async () => {
    let release: (value: any) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise((resolve) => { release = resolve; })),
    );
    const { frame, unmount } = renderFrame(true);
    const post = spyPost(frame);

    window.dispatchEvent(request(frame.contentWindow));
    const port = (post.mock.calls[0]![2] as Transferable[])[0] as MessagePort;
    const received: any[] = [];
    port.onmessage = (e) => received.push(e.data);
    port.start();

    unmount();
    release({ ok: true, status: 200, json: async () => GRANT_BODY });
    await new Promise((r) => setTimeout(r, 0));

    expect(received.find((m) => "token" in m)).toBeUndefined();
  });

  // The refresh path resolves independently of the initial grant; it has its
  // own fetch and must honor the same post-unmount guard, or a token could be
  // posted onto a still-open port after the component is gone.
  test("does not deliver a credential when a refresh resolves after unmount", async () => {
    stubFetch();
    const { frame, unmount } = renderFrame(true);
    const post = spyPost(frame);

    window.dispatchEvent(request(frame.contentWindow));
    const port = (post.mock.calls[0]![2] as Transferable[])[0] as MessagePort;

    const first = nextOfType(port, "exulu:identity:grant");
    port.start();
    await first;

    let release: (value: any) => void = () => {};
    const fetchMock = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const received: any[] = [];
    port.onmessage = (e) => received.push(e.data);
    port.postMessage({ type: "exulu:identity:refresh", v: 1 });

    // Delivery over a MessagePort is queued, not synchronous: posting the
    // refresh request does not synchronously invoke the component's
    // fetchGrant(). Wait until the refresh's fetch is actually in flight
    // before unmounting and releasing it — otherwise `release` below would
    // still be the stale no-op and this test would pass vacuously without
    // ever exercising the post-unmount path.
    while (fetchMock.mock.calls.length === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }

    unmount();
    release({ ok: true, status: 200, json: async () => GRANT_BODY });
    await new Promise((r) => setTimeout(r, 0));

    expect(received.find((m) => "token" in m)).toBeUndefined();
  });

  // F5: the Global Constraint says every message carries v: 1. A v: 2
  // artifact must not silently receive a v1 answer.
  test("ignores a request whose v is not 1", async () => {
    const fetchMock = stubFetch();
    const { frame } = renderFrame(true);
    const post = spyPost(frame);

    window.dispatchEvent(request(frame.contentWindow, 2));
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  // F7: a buggy artifact re-posting on every render must not drive unbounded
  // identity-route calls or unbounded retained ports. At most one request is
  // answered per frame load.
  test("ignores a second request from the same frame load", async () => {
    const fetchMock = stubFetch();
    const { frame } = renderFrame(true);
    const post = spyPost(frame);

    window.dispatchEvent(request(frame.contentWindow));
    window.dispatchEvent(request(frame.contentWindow));
    await new Promise((r) => setTimeout(r, 0));

    expect(post).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // The iframe's own `load` event is the reset boundary: after it fires
  // again (a navigation of the frame), a new request is answered.
  test("answers a new request once the iframe's load event fires again", async () => {
    const fetchMock = stubFetch();
    const { frame } = renderFrame(true);
    const post = spyPost(frame);

    window.dispatchEvent(request(frame.contentWindow));
    await new Promise((r) => setTimeout(r, 0));
    expect(post).toHaveBeenCalledTimes(1);

    fireEvent.load(frame);
    window.dispatchEvent(request(frame.contentWindow));
    await new Promise((r) => setTimeout(r, 0));

    expect(post).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // F4: a malformed route response (user missing or not an object) must not
  // be read by the artifact as a usable grant — the denial path must run
  // instead of handing over a Grant with user: undefined.
  test("denies when the identity route's user is not an object", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ...GRANT_BODY, user: undefined }),
      }) as any),
    );
    const { frame } = renderFrame(true);
    const post = spyPost(frame);

    window.dispatchEvent(request(frame.contentWindow));

    const port = (post.mock.calls[0]![2] as Transferable[])[0] as MessagePort;
    const answer = nextOfType(port, "exulu:identity:denied");
    port.start();

    expect(await answer).toMatchObject({
      type: "exulu:identity:denied",
      v: 1,
    });
  });

  /* ---------------------------------------------------------------------
   * The agent-panel channel (CHANNEL_V = 2), riding the same port.
   * ------------------------------------------------------------------ */

  test("announces host info with panel:false and no slots when no panel prop is given", async () => {
    stubFetch();
    const { frame } = renderFrame(true);
    const { received, ofType, until } = handshake(frame);
    await until("exulu:identity:grant");

    // The published share route has its own root layout with none of the app
    // providers, so it has no panel at all — the artifact must be told, or it
    // would offer a button that can never work.
    expect(ofType("exulu:host:info")).toEqual([
      { type: "exulu:host:info", v: 2, panel: false, slots: [] },
    ]);
    // And it has to be on the wire BEFORE the grant: the artifact-side client
    // resolves its connect on the grant and reads the host off this message,
    // so announcing it from an effect (or after the awaited fetch) would
    // leave that client with no host at all.
    expect(received.findIndex((m) => m.type === "exulu:host:info")).toBeLessThan(
      received.findIndex((m) => m.type === "exulu:identity:grant"),
    );
  });

  test("announces the assigned slots when a panel is present", async () => {
    stubFetch();
    const { frame } = renderFrame(true, { slots: SLOTS, onOpenRequest: vi.fn() });
    const { ofType, until } = handshake(frame);
    await until("exulu:identity:grant");

    expect(ofType("exulu:host:info")).toEqual([
      {
        type: "exulu:host:info",
        v: 2,
        panel: true,
        slots: [{ key: "analyse", label: "Pitch-Agent" }],
      },
    ]);
  });

  // Agent ids never cross this channel; the frame only ever learns {key,label}.
  // The fixture is deliberately WIDER than PanelSlot — the viewer's own join
  // carries the whole Agent, and TypeScript's excess-property check does not
  // fire for an array built from a wider type, so the frame has to project
  // rather than trust its caller.
  test("never puts an agent id on the channel", async () => {
    stubFetch();
    const joined = [
      { key: "analyse", label: "Pitch-Agent", agent: { id: "agent-1", name: "Pitch" } },
    ];
    const { frame } = renderFrame(true, { slots: joined, onOpenRequest: vi.fn() });
    const { ofType, until } = handshake(frame);
    await until("exulu:identity:grant");

    const info = ofType("exulu:host:info")[0];
    expect(info.slots).toEqual([{ key: "analyse", label: "Pitch-Agent" }]);
    expect(Object.keys(info.slots[0])).toEqual(["key", "label"]);
    expect(JSON.stringify(info)).not.toContain("agent-1");
  });

  test("announces the current viewport alongside host info at the handoff", async () => {
    stubFetch();
    // A frame that loads while the panel is already open (the artifact
    // reloaded itself, say) would otherwise never learn its width: the
    // change-keyed effect only fires on a later change.
    const { frame } = renderFrame(true, {
      slots: SLOTS,
      onOpenRequest: vi.fn(),
      viewport: { width: 360, open: true },
    });
    const { ofType, until } = handshake(frame);
    await until("exulu:identity:grant");

    expect(ofType("exulu:panel:viewport")).toEqual([
      { type: "exulu:panel:viewport", v: 2, width: 360, open: true },
    ]);
  });

  test("an open request for an assigned slot reaches onOpenRequest and is acked accepted", async () => {
    stubFetch();
    const onOpenRequest = vi.fn();
    const { frame } = renderFrame(true, { slots: SLOTS, onOpenRequest });
    const { port, until } = handshake(frame);
    await until("exulu:identity:grant");

    port.postMessage(openRequest("analyse", { prompt: "Summarise the pitch", files: ["f-1"] }));

    expect(await until("exulu:panel:open:ack")).toEqual([
      { type: "exulu:panel:open:ack", v: 2, slot: "analyse", accepted: true },
    ]);
    expect(onOpenRequest).toHaveBeenCalledTimes(1);
    expect(onOpenRequest).toHaveBeenCalledWith({
      type: "exulu:panel:open",
      v: 2,
      slot: "analyse",
      prompt: "Summarise the pitch",
      files: ["f-1"],
    });
  });

  // Review Focus 1: the slot allowlist is the trust boundary. Any code inside
  // the artifact bundle can post on this port, a compromised dependency
  // included, so a slot nobody assigned must never reach the host.
  test("an open request for an unassigned slot is NOT forwarded and is acked rejected", async () => {
    stubFetch();
    const onOpenRequest = vi.fn();
    const { frame } = renderFrame(true, { slots: SLOTS, onOpenRequest });
    const { port, until } = handshake(frame);
    await until("exulu:identity:grant");

    port.postMessage(openRequest("some-other-agent", { prompt: "exfiltrate" }));
    const acks = await until("exulu:panel:open:ack");

    expect(onOpenRequest).not.toHaveBeenCalled();
    expect(acks).toHaveLength(1);
    expect(acks[0]).toMatchObject({ slot: "some-other-agent", accepted: false });
    expect(typeof acks[0].reason).toBe("string");
    expect(acks[0].reason.length).toBeGreaterThan(0);
  });

  // Review Focus 5: an open request has no retry, and the artifact's button
  // re-enables on the ack — a dropped request would hang its UI forever.
  test("an open request that arrives before the panel prop exists is acked rejected, never left pending", async () => {
    stubFetch();
    const { frame } = renderFrame(true);
    const { port, until } = handshake(frame);
    await until("exulu:identity:grant");

    port.postMessage(openRequest("analyse"));
    const acks = await until("exulu:panel:open:ack");

    expect(acks).toHaveLength(1);
    expect(acks[0]).toMatchObject({ slot: "analyse", accepted: false });
    expect(typeof acks[0].reason).toBe("string");
  });

  test("a malformed open request is ignored entirely — no ack, no call", async () => {
    const fetchMock = stubFetch();
    const onOpenRequest = vi.fn();
    const { frame } = renderFrame(true, { slots: SLOTS, onOpenRequest });
    const { port, ofType, until } = handshake(frame);
    await until("exulu:identity:grant");

    port.postMessage({ type: "exulu:panel:open", v: 1, slot: "analyse" });
    port.postMessage({ type: "exulu:panel:openz", v: 2, slot: "analyse" });
    port.postMessage({ type: "exulu:panel:open", v: 2, slot: 7 });
    port.postMessage({ type: "exulu:panel:open", v: 2 });
    // A well-formed request last: port delivery is FIFO, so its ack arriving
    // proves all four above were handled — and ignored.
    port.postMessage(openRequest("analyse"));

    expect(await until("exulu:panel:open:ack")).toEqual([
      { type: "exulu:panel:open:ack", v: 2, slot: "analyse", accepted: true },
    ]);
    expect(onOpenRequest).toHaveBeenCalledTimes(1);
    // The identity branch shares this port: a malformed v: 1 message must not
    // be mistaken for a refresh either.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("open requests arriving over the window instead of the port are ignored", async () => {
    const fetchMock = stubFetch();
    const onOpenRequest = vi.fn();
    const { frame } = renderFrame(true, { slots: SLOTS, onOpenRequest });
    const post = spyPost(frame);

    // dispatchEvent runs the listener synchronously, so everything the frame
    // would do about this message has already happened on the next line.
    window.dispatchEvent(
      new MessageEvent("message", {
        data: openRequest("analyse"),
        source: frame.contentWindow,
      }),
    );
    await flush();

    // Only exulu:identity:request is answered at the window, and the answer
    // is the credential-free channel handoff. Nothing else is posted there.
    expect(onOpenRequest).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a viewport change posts panelViewport over the port", async () => {
    stubFetch();
    const panel = { slots: SLOTS, onOpenRequest: vi.fn(), viewport: { width: 0, open: false } };
    const { frame, rerenderWith } = renderFrame(true, panel);
    const { port, ofType, until } = handshake(frame);
    await until("exulu:identity:grant");
    const seeded = ofType("exulu:panel:viewport").length;

    rerenderWith({ ...panel, viewport: { width: 420, open: true } });

    expect((await until("exulu:panel:viewport", seeded + 1)).slice(seeded)).toEqual([
      { type: "exulu:panel:viewport", v: 2, width: 420, open: true },
    ]);

    // A re-render with the same values — a fresh object, as the viewer builds
    // one every render — must put nothing on the port. The open request is a
    // FIFO barrier: its ack cannot arrive before a viewport message queued by
    // the re-render would have.
    rerenderWith({ ...panel, viewport: { width: 420, open: true } });
    port.postMessage(openRequest("analyse"));
    expect(await until("exulu:panel:open:ack")).toHaveLength(1);
    expect(ofType("exulu:panel:viewport")).toHaveLength(seeded + 1);
  });

  test("a progressNonce bump posts turnProgress once per bump", async () => {
    stubFetch();
    const panel = {
      slots: SLOTS,
      onOpenRequest: vi.fn(),
      progressNonce: 0,
      progressReason: "tool" as const,
    };
    const { frame, rerenderWith } = renderFrame(true, panel);
    const { port, ofType, until } = handshake(frame);
    expect(await until("exulu:identity:grant")).toHaveLength(1);

    // The handshake itself is not a bump — progress is an event, not state.
    expect(ofType("exulu:session:progress")).toEqual([]);

    rerenderWith({ ...panel, progressNonce: 1 });
    expect(await until("exulu:session:progress")).toEqual([
      { type: "exulu:session:progress", v: 2, reason: "tool" },
    ]);

    // Same nonce, new object: a re-render alone sends nothing. Barrier as above.
    rerenderWith({ ...panel, progressNonce: 1 });
    port.postMessage(openRequest("analyse"));
    expect(await until("exulu:panel:open:ack")).toHaveLength(1);
    expect(ofType("exulu:session:progress")).toHaveLength(1);

    // The reason rides along with the nonce.
    rerenderWith({ ...panel, progressNonce: 2, progressReason: "turn" });
    expect(await until("exulu:session:progress", 2)).toEqual([
      { type: "exulu:session:progress", v: 2, reason: "tool" },
      { type: "exulu:session:progress", v: 2, reason: "turn" },
    ]);
  });

  // The port's own document loads AFTER it handshakes — an artifact's script
  // runs during parsing, and the frame really does fire `load` later (this
  // test waits for the genuine event, it does not synthesise one) — so the
  // first load must not retire the port, or every announcement after it would
  // silently go nowhere.
  test("keeps announcing after the frame's own first load event", async () => {
    stubFetch();
    const panel = { slots: SLOTS, onOpenRequest: vi.fn(), viewport: { width: 0, open: false } };
    const { frame, rerenderWith } = renderFrame(true, panel);
    const loaded = loadOnce(frame);
    const { ofType, until } = handshake(frame);
    await until("exulu:identity:grant");
    const seeded = ofType("exulu:panel:viewport").length;

    await loaded;
    rerenderWith({ ...panel, viewport: { width: 420, open: true } });

    expect((await until("exulu:panel:viewport", seeded + 1)).slice(seeded)).toEqual([
      { type: "exulu:panel:viewport", v: 2, width: 420, open: true },
    ]);
  });

  test("announcements stop reaching the previous load's port once the frame navigates", async () => {
    stubFetch();
    const panel = { slots: SLOTS, onOpenRequest: vi.fn(), viewport: { width: 0, open: false } };
    const { frame, rerenderWith } = renderFrame(true, panel);
    const loaded = loadOnce(frame);
    const { ofType, until } = handshake(frame);
    await until("exulu:identity:grant");
    await loaded; // this document's own load

    // Positive control: the live document's port is receiving (the seed plus
    // this change).
    rerenderWith({ ...panel, viewport: { width: 420, open: true } });
    expect(await until("exulu:panel:viewport", 2)).toHaveLength(2);

    // A self-navigation. The old port2 can outlive the document that was
    // handed it (allow-popups is on), so host state — slot keys, viewport,
    // progress — must stop flowing to a finished load's port.
    fireEvent.load(frame);
    rerenderWith({ ...panel, viewport: { width: 500, open: true } });
    rerenderWith({ ...panel, viewport: { width: 500, open: true }, progressNonce: 1 });
    await settle();

    expect(ofType("exulu:panel:viewport")).toHaveLength(2);
    expect(ofType("exulu:session:progress")).toEqual([]);
  });

  /* ---------------------------------------------------------------------
   * A retired port is served nothing at all — not host state, not a token,
   * not a panel open. Pre-existing for the refresh branch (the identity
   * flow predates this work), fixed here because it is one line in the same
   * handler as the new code and it is the credential that is at stake.
   * ------------------------------------------------------------------ */

  test("a port retired by a navigation gets no fresh grant, and no token is minted for it", async () => {
    const fetchMock = stubFetch();
    const { frame } = renderFrame(true);
    const loaded = loadOnce(frame);
    const { port, ofType, until } = handshake(frame);
    await until("exulu:identity:grant");
    await loaded; // this document's own load
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Positive control: while this document is live, a refresh is answered.
    port.postMessage({ type: "exulu:identity:refresh", v: 1 });
    expect(await until("exulu:identity:grant", 2)).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // The artifact navigates itself. Its port2 may live on in a popup it was
    // transferred to before navigating — a document the host never vetted —
    // and a short-lived grant must not become a renewable one in its hands.
    fireEvent.load(frame);

    port.postMessage({ type: "exulu:identity:refresh", v: 1 });
    await settle();

    // The point is that no token is minted at all, not that one is minted and
    // discarded: the identity route is never called for this port.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(ofType("exulu:identity:grant")).toHaveLength(2);
    // Not even a denial: the document that could act on one is gone.
    expect(ofType("exulu:identity:denied")).toEqual([]);
  });

  test("a port retired by a navigation cannot open the panel", async () => {
    stubFetch();
    const onOpenRequest = vi.fn();
    const { frame } = renderFrame(true, { slots: SLOTS, onOpenRequest });
    const loaded = loadOnce(frame);
    const { port, ofType, until } = handshake(frame);
    await until("exulu:identity:grant");
    await loaded;

    // Positive control: the live document's request is accepted.
    port.postMessage(openRequest("analyse"));
    expect(await until("exulu:panel:open:ack")).toHaveLength(1);
    expect(onOpenRequest).toHaveBeenCalledTimes(1);

    fireEvent.load(frame); // a self-navigation: the port is retired
    port.postMessage(openRequest("analyse", { prompt: "from a stale popup" }));
    await settle();

    expect(onOpenRequest).toHaveBeenCalledTimes(1);
    expect(ofType("exulu:panel:open:ack")).toHaveLength(1);
  });

  // The port may already be closed — the frame unmounted, or navigated and
  // dropped port2 — and an announcement is fire-and-forget: it must not
  // surface an error and must not be retried.
  test("a progress bump the port can no longer accept does not throw and is not retried", async () => {
    // Never resolves, so the identity flow's own posts stay out of this.
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const postMessage = vi.fn(() => {
      throw new DOMException("InvalidStateError");
    });
    vi.stubGlobal(
      "MessageChannel",
      class {
        port1 = { postMessage, close: vi.fn(), onmessage: null };
        port2 = {};
      },
    );
    const panel = { slots: SLOTS, onOpenRequest: vi.fn(), progressNonce: 0 };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { frame, rerenderWith } = renderFrame(true, panel);
      spyPost(frame);

      expect(() => window.dispatchEvent(request(frame.contentWindow))).not.toThrow();
      expect(() => rerenderWith({ ...panel, progressNonce: 1 })).not.toThrow();

      expect(postMessage).toHaveBeenCalled();
      const attempts = postMessage.mock.calls.length;
      await flush();
      expect(postMessage.mock.calls.length).toBe(attempts);
      // Swallowed, but not invisible: the catch is wider than the dead-port
      // case it exists for, so it has to leave something to find.
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
