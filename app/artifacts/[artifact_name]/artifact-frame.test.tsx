// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
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
      artifactName="cockpit"
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
  // assertions here are unchanged from the brief; this is purely to satisfy
  // tsc). Narrow the object to the single signature actually used before
  // spying so the mock is typed against the right overload.
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

  test("grants identity to its own frame", async () => {
    const fetchMock = stubFetch();
    const { frame } = renderFrame(true);
    const post = spyPost(frame);

    window.dispatchEvent(request(frame.contentWindow));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/artifacts/cockpit/identity",
      expect.objectContaining({ cache: "no-store" }),
    );
    const [message, targetOrigin, transfer] = post.mock.calls[0]!;
    expect(message).toMatchObject({
      type: "exulu:identity:grant",
      v: 1,
      ...GRANT_BODY,
    });
    // Mandatory: the frame's origin is opaque and "null" is not a valid
    // targetOrigin. Delivery is targeted by contentWindow, not by origin.
    expect(targetOrigin).toBe("*");
    expect((transfer as Transferable[])[0]).toBeInstanceOf(MessagePort);
  });

  // Review Focus 3: a second iframe, a nested frame, or the page itself.
  test("ignores a request from a window that is not its frame", async () => {
    const fetchMock = stubFetch();
    renderFrame(true);

    window.dispatchEvent(request(window));
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).not.toHaveBeenCalled();
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

  test("grants nothing when the capability is off", async () => {
    const fetchMock = stubFetch();
    const { frame } = renderFrame(false);

    window.dispatchEvent(request(frame.contentWindow));
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("denies instead of granting when the identity route refuses", async () => {
    stubFetch(false);
    const { frame } = renderFrame(true);
    const post = spyPost(frame);

    window.dispatchEvent(request(frame.contentWindow));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]![0]).toMatchObject({
      type: "exulu:identity:denied",
      v: 1,
    });
  });

  test("answers a refresh over the transferred port", async () => {
    const fetchMock = stubFetch();
    const { frame } = renderFrame(true);
    const post = spyPost(frame);

    window.dispatchEvent(request(frame.contentWindow));
    await waitFor(() => expect(post).toHaveBeenCalled());

    const port = (post.mock.calls[0]![2] as Transferable[])[0] as MessagePort;
    const answered = new Promise<any>((resolve) => {
      port.onmessage = (e) => resolve(e.data);
    });
    port.start();
    port.postMessage({ type: "exulu:identity:refresh", v: 1 });

    expect(await answered).toMatchObject({
      type: "exulu:identity:grant",
      v: 1,
      token: "jwt-abc",
    });
    // A refresh re-reads the identity route; it does not replay a cached grant.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // Review Focus 5: the fetch is async; unmounting mid-handshake must not post
  // into a dead frame.
  test("does not post a grant that resolves after unmount", async () => {
    let release: (value: any) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise((resolve) => { release = resolve; })),
    );
    const { frame, unmount } = renderFrame(true);
    const post = spyPost(frame);

    window.dispatchEvent(request(frame.contentWindow));
    unmount();
    release({ ok: true, status: 200, json: async () => GRANT_BODY });
    await new Promise((r) => setTimeout(r, 0));

    expect(post).not.toHaveBeenCalled();
  });
});
