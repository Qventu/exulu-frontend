"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import {
  hostInfo,
  openPanelAck,
  panelViewport,
  parseOpenPanelRequest,
  turnProgress,
  type HostInfo,
  type OpenPanelAck,
  type OpenPanelRequest,
  type PanelSlot,
  type PanelViewport,
  type TurnProgress,
} from "@/lib/artifacts/agent-panel-protocol";

/**
 * The identity handshake's own version. The agent-panel channel that shares
 * the same port is versioned separately (`CHANNEL_V`), so a message belongs
 * to exactly one of the two protocols and neither can be read as the other.
 */
const V = 1;

type Grant = {
  type: "exulu:identity:grant";
  v: number;
  token: string;
  backendOrigin: string;
  user: { email: string | null; name: string | null };
};

type Denied = { type: "exulu:identity:denied"; v: number; reason: string };

const denied = (reason: string): Denied => ({
  type: "exulu:identity:denied",
  v: V,
  reason,
});

/**
 * Posts one agent-panel message, tolerating a channel that is already gone.
 *
 * These messages are fire-and-forget announcements, and the port may have no
 * peer left — the frame navigated and dropped its end, or was never handed
 * one at all. A dead channel is not a condition the host can act on, so the
 * failure is swallowed rather than surfaced, and never retried: the artifact
 * re-reads host info and the viewport on its next connect anyway.
 */
function announce(
  port: MessagePort | null,
  message: HostInfo | PanelViewport | TurnProgress | OpenPanelAck,
) {
  if (!port) return;
  try {
    port.postMessage(message);
  } catch (error) {
    // Expected for a closed or neutered port, and nothing the host can act
    // on. But this catch is wide — a non-cloneable value in a slot would
    // land here too and leave the artifact silently believing it has no
    // panel — so leave a trace to find it by. `console.debug` is not an
    // option: no-console allows only warn/error.
    console.warn("artifact channel: announcement not delivered", error);
  }
}

/**
 * Renders a shared artifact, and — only when a platform administrator has
 * granted the capability — answers the artifact's identity handshake.
 *
 * The artifact runs in an opaque origin (no allow-same-origin), so it has no
 * cookie, no localStorage and no parent access. This component is the only
 * path by which it can learn who is viewing and where to send requests.
 *
 * The handshake is port-first and never posts a credential at a window.
 * `frame.contentWindow` is a WindowProxy whose identity survives a
 * navigation of the frame — a sandboxed frame with allow-scripts (but no
 * allow-top-navigation, which governs only the top-level context) can
 * navigate itself. If the token were posted straight at `contentWindow`
 * after an await, an artifact could request identity, navigate itself to an
 * attacker-controlled document, and have the credential delivered into
 * whatever now occupies the frame. So the channel handoff — carrying no
 * credential — happens synchronously, in the same task as the sender check,
 * before any await can let a navigation intervene. Only the MessagePort
 * transferred over that handoff ever carries the token, and a MessagePort is
 * bound to (and destroyed with) the document that received it.
 *
 * That same port then carries the agent-panel channel (see
 * lib/artifacts/agent-panel-protocol.ts), on its own version: the host
 * announces whether it has a panel, which slots are assigned, how wide the
 * artifact's viewport is and when an agent turn made progress, and the
 * artifact asks for a panel to be opened. Those messages carry no credential
 * either, and the port stays the only channel — nothing new is aimed at the
 * window.
 */
export function ArtifactFrame({
  html,
  title,
  artifactName,
  grantIdentity,
  panel,
  className = "h-screen w-screen border-0",
}: {
  html: string;
  title: string;
  artifactName: string;
  grantIdentity: boolean;
  /**
   * Present only on a host that actually has an agent panel: the in-shell
   * viewer (/artifacts/open/[name]) passes it, the published share route has
   * its own root layout with none of the app providers and passes nothing. An
   * absent prop is announced as `panel: false` with no slots, which is how an
   * artifact knows to hide a trigger that could never work there.
   *
   * `slots` carries only {key,label} — agent ids never cross this channel —
   * and doubles as the allowlist every open request is checked against.
   */
  panel?: {
    slots: PanelSlot[];
    onOpenRequest: (req: OpenPanelRequest) => void;
    viewport?: { width: number; open: boolean };
    progressNonce?: number;
    progressReason?: "tool" | "turn";
  };
  /**
   * The share route renders the frame full-screen (the default); the
   * in-shell viewer under /artifacts/open passes "h-full w-full border-0"
   * to fill the content region instead.
   */
  className?: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  // At most one request per frame load is answered — a buggy artifact
  // re-posting on every render must not drive unbounded identity-route calls
  // (two backend fetches plus a getServerSession each) or unbounded retained
  // ports. Reset by the iframe's own `load` event, which fires again on any
  // navigation (including a re-navigation to the same srcDoc).
  const handledRef = useRef(false);
  // The viewer rebuilds the `panel` object on every render, so the port
  // handlers read it off a ref instead of closing over it: the identity
  // effect must not re-subscribe — and so re-arm the handshake — merely
  // because the parent rendered.
  //
  // Synced in a layout effect, not a passive one: a port message delivered
  // between a commit that shrank `panel.slots` and a passive flush would be
  // validated against the previous, wider list.
  const panelRef = useRef(panel);
  useLayoutEffect(() => {
    panelRef.current = panel;
  }, [panel]);
  // The artifact's end of the channel, established by the handshake below.
  // Until it exists there is nobody to announce anything to.
  const portRef = useRef<MessagePort | null>(null);
  // A port belongs to the document that was handed it, and the frame's own
  // `load` event is not that port's death notice: an artifact's script runs
  // during parsing, so the FIRST load always arrives *after* the handoff it
  // belongs to (verified — see the test), and retiring the port there would
  // kill the live document's channel. The load after that one is a
  // self-navigation, and it does retire the port: port2 can outlive the
  // document that received it (allow-popups is on, and a transferred port
  // lives with whatever document holds it), while announcements carry slot
  // keys, viewport and progress — host state a finished document must stop
  // receiving.
  const portSawLoadRef = useRef(false);

  useEffect(() => {
    if (!grantIdentity) return;
    let cancelled = false;
    const ports: MessagePort[] = [];

    const fetchGrant = async (): Promise<Grant | null> => {
      try {
        const res = await fetch(
          `/artifacts/${encodeURIComponent(artifactName)}/identity`,
          { cache: "no-store" },
        );
        if (!res.ok) return null;
        const body = await res.json();
        // Fail closed against a route regression: a 200 with a malformed or
        // empty body must not be read by the artifact as a usable grant.
        // `user` must be an object — the Grant type declares it as one, and
        // a malformed route response must not silently pass `undefined`
        // through to the artifact.
        if (
          typeof body?.token !== "string" ||
          typeof body?.backendOrigin !== "string" ||
          typeof body?.user !== "object" ||
          body?.user === null
        ) {
          return null;
        }
        return {
          type: "exulu:identity:grant",
          v: V,
          token: body.token,
          backendOrigin: body.backendOrigin,
          user: body.user,
        };
      } catch {
        return null;
      }
    };

    /**
     * Answers one `exulu:panel:open` request from the artifact.
     *
     * The slot allowlist is the trust boundary and it is checked here, in the
     * frame, rather than left to the host: any code inside the artifact
     * bundle can post on this port — a compromised dependency included — so a
     * slot nobody assigned must never reach `onOpenRequest`.
     *
     * Every request is acked, accepted or not. Unlike the identity request,
     * an open request has no retry, and the artifact's button re-enables on
     * the ack, so a silently dropped request would hang its UI for good.
     */
    const answerOpenRequest = (port: MessagePort, req: OpenPanelRequest) => {
      const host = panelRef.current;
      if (!host) {
        announce(port, openPanelAck(req.slot, false, "no-panel"));
        return;
      }
      if (!host.slots.some((slot) => slot.key === req.slot)) {
        announce(port, openPanelAck(req.slot, false, "unknown-slot"));
        return;
      }
      // Ack before handing over: the artifact's UI waits on it, and it must
      // not be lost to a throw from the host's own handler.
      announce(port, openPanelAck(req.slot, true));
      host.onOpenRequest(req);
    };

    const onMessage = (event: MessageEvent) => {
      const frame = ref.current;
      // Verification is by window identity, not origin: a sandboxed frame's
      // origin is the string "null" and proves nothing, whereas a window
      // reference is the frame itself.
      if (!frame || event.source !== frame.contentWindow) return;
      if (event.data?.v !== V) return;
      if (event.data?.type !== "exulu:identity:request") return;
      // Answer at most one request per frame load.
      if (handledRef.current) return;
      handledRef.current = true;
      const target = frame.contentWindow;
      if (!target) return;

      // Synchronous from here through the handoff and the host
      // announcements below — same task as the verification above, so no
      // navigation of the frame can intervene between checking the sender
      // and hitting the wire. The handoff is the only message ever aimed at
      // the window, and it carries no credential.
      const channel = new MessageChannel();
      ports.push(channel.port1);
      channel.port1.onmessage = async (portEvent: MessageEvent) => {
        // Nothing is served to a port that is no longer the live document's.
        // A navigation retires the port (see portSawLoadRef) while its port2
        // can live on in, say, a popup the artifact transferred it to before
        // navigating — a document the host never vetted. Such a port must not
        // be able to mint a fresh token through the refresh branch, which is
        // why this sits above the dispatch: `fetchGrant()` is never reached,
        // so no token is minted at all rather than minted and then dropped.
        // It must not be able to drive a panel open either. One gate for the
        // whole handler, so a later branch cannot forget it; the answer to a
        // retired port is silence, not a denial, because the document that
        // could act on one is gone. Unmount is covered separately — cleanup
        // closes the ports — so this covers navigation without unmount.
        if (portRef.current !== channel.port1) return;
        // Two protocols share this port, so dispatch by shape — and try the
        // panel channel first, since the identity branch below rejects
        // anything not stamped v: 1 and a panel message could never survive
        // it. A message that is neither falls through and is ignored.
        const open = parseOpenPanelRequest(portEvent.data);
        if (open) {
          answerOpenRequest(channel.port1, open);
          return;
        }
        if (portEvent.data?.v !== V) return;
        if (portEvent.data?.type !== "exulu:identity:refresh") return;
        const fresh = await fetchGrant();
        // Cleanup both sets `cancelled` and closes this port, so a denial
        // posted here could never be delivered anyway — the page is gone by
        // the time cleanup has run, so there is no consumer to inform.
        if (cancelled) return;
        channel.port1.postMessage(fresh ?? denied("unavailable"));
      };
      target.postMessage({ type: "exulu:identity:channel", v: V }, "*", [
        channel.port2,
      ]);
      portRef.current = channel.port1;
      portSawLoadRef.current = false;

      // The agent-panel channel's opening statement, queued on the port with
      // the handoff rather than sent from an effect: the artifact resolves
      // its connect on the grant and reads the host it is running in off
      // these, so they have to be on the wire before the grant it waits for.
      // The viewport is seeded here for the same reason the host info is —
      // the change-keyed effect below only carries later changes, so a frame
      // that loads while the panel is already open would otherwise never
      // learn its width.
      const host = panelRef.current;
      // Project every slot down to {key,label} here rather than forwarding
      // the caller's array: `hostInfo` copies by reference, and TypeScript's
      // excess-property check does not fire for an array built from a wider
      // type — so without this, a caller passing its own joined slot shape
      // would push a whole Agent object into a third-party iframe. The
      // invariant has to hold regardless of the call site.
      announce(
        channel.port1,
        hostInfo(
          Boolean(host),
          (host?.slots ?? []).map((slot) => ({ key: slot.key, label: slot.label })),
        ),
      );
      if (host?.viewport) {
        announce(
          channel.port1,
          panelViewport(host.viewport.width, host.viewport.open),
        );
      }

      void (async () => {
        const grant = await fetchGrant();
        if (cancelled) return;
        channel.port1.postMessage(grant ?? denied("unavailable"));
      })();
    };

    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      portRef.current = null;
      for (const port of ports) port.close();
    };
  }, [grantIdentity, artifactName]);

  // Both panel effects are keyed on the values that changed, never on the
  // `panel` object — the viewer builds a fresh one every render, and a bare
  // re-render must put nothing on the port. One message per actual change.
  const viewportWidth = panel?.viewport?.width;
  const viewportOpen = panel?.viewport?.open;
  useEffect(() => {
    if (viewportWidth === undefined || viewportOpen === undefined) return;
    // No port yet means the artifact has not connected; the handoff above
    // announces the viewport it finds at that point, so nothing is missed.
    announce(portRef.current, panelViewport(viewportWidth, viewportOpen));
  }, [viewportWidth, viewportOpen]);

  const progressNonce = panel?.progressNonce;
  useEffect(() => {
    if (progressNonce === undefined) return;
    // Progress is an event, not state: it is announced on a bump and never
    // replayed to a newly connected artifact. The reason rides along with the
    // nonce rather than being keyed on — a reason that changes without a bump
    // describes no new event — so it is read off the ref.
    announce(
      portRef.current,
      turnProgress(panelRef.current?.progressReason ?? "turn"),
    );
  }, [progressNonce]);

  // `allow-popups-to-escape-sandbox`: a popup opened from a sandboxed frame
  // otherwise inherits the sandbox — opaque origin, no cookies — so an
  // artifact linking into the IMP itself (e.g. /chat/<agent>/new?q=…) lands on
  // a page that cannot read its own session. The popup is a separate top-level
  // browsing context; it gains nothing over the embedding page, and
  // `allow-same-origin` stays deliberately absent (see the test).
  const ARTIFACT_SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms";

  return (
    <iframe
      ref={ref}
      srcDoc={html}
      sandbox={ARTIFACT_SANDBOX}
      className={className}
      title={title}
      onLoad={() => {
        handledRef.current = false;
        // The second load since the handoff is a navigation: retire the port
        // (see portSawLoadRef). The first is this document's own.
        if (portSawLoadRef.current) {
          portRef.current = null;
        } else {
          portSawLoadRef.current = true;
        }
      }}
    />
  );
}
