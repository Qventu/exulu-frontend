// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
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

function renderFrame(grantIdentity: boolean) {
  const result = render(
    <ArtifactFrame
      html="<p>hi</p>"
      title="app.html"
      artifactName="my-artifact"
      grantIdentity={grantIdentity}
    />,
  );
  const frame = result.container.querySelector("iframe") as HTMLIFrameElement;
  return { ...result, frame };
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
const request = (source: MessageEventSource | null) =>
  new MessageEvent("message", {
    data: { type: "exulu:identity:request", v: 1 },
    source,
  });

describe("ArtifactFrame", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  test("keeps the sandbox flags and never adds allow-same-origin", () => {
    const { frame } = renderFrame(true);
    expect(frame.getAttribute("sandbox")).toBe(
      "allow-scripts allow-popups allow-forms",
    );
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
    const granted = new Promise<any>((resolve) => {
      port.onmessage = (e) => resolve(e.data);
    });
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
    const answer = new Promise<any>((resolve) => {
      port.onmessage = (e) => resolve(e.data);
    });
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

    const first = new Promise<any>((resolve) => {
      port.onmessage = (e) => resolve(e.data);
    });
    port.start();
    await first;

    const refreshed = new Promise<any>((resolve) => {
      port.onmessage = (e) => resolve(e.data);
    });
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

    const first = new Promise<any>((resolve) => {
      port.onmessage = (e) => resolve(e.data);
    });
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
});
