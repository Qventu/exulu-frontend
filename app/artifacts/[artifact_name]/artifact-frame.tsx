"use client";

import { useEffect, useRef } from "react";

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
 */
export function ArtifactFrame({
  html,
  title,
  artifactName,
  grantIdentity,
  className = "h-screen w-screen border-0",
}: {
  html: string;
  title: string;
  artifactName: string;
  grantIdentity: boolean;
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

      // Synchronous from here through the postMessage call below — same
      // task as the verification above, so no navigation of the frame can
      // intervene between checking the sender and hitting the wire. This
      // message is the only one ever aimed at the window, and it carries no
      // credential.
      const channel = new MessageChannel();
      ports.push(channel.port1);
      channel.port1.onmessage = async (portEvent: MessageEvent) => {
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
      for (const port of ports) port.close();
    };
  }, [grantIdentity, artifactName]);

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
      }}
    />
  );
}
