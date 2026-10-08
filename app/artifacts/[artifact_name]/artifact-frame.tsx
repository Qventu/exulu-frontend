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
}: {
  html: string;
  title: string;
  artifactName: string;
  grantIdentity: boolean;
}) {
  const ref = useRef<HTMLIFrameElement>(null);

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
        if (
          typeof body?.token !== "string" ||
          typeof body?.backendOrigin !== "string"
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
      if (event.data?.type !== "exulu:identity:request") return;
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
        if (portEvent.data?.type !== "exulu:identity:refresh") return;
        const fresh = await fetchGrant();
        channel.port1.postMessage(
          cancelled ? denied("unavailable") : (fresh ?? denied("unavailable")),
        );
      };
      target.postMessage({ type: "exulu:identity:channel", v: V }, "*", [
        channel.port2,
      ]);

      void (async () => {
        const grant = await fetchGrant();
        channel.port1.postMessage(
          cancelled ? denied("unavailable") : (grant ?? denied("unavailable")),
        );
      })();
    };

    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      for (const port of ports) port.close();
    };
  }, [grantIdentity, artifactName]);

  return (
    <iframe
      ref={ref}
      srcDoc={html}
      sandbox="allow-scripts allow-popups allow-forms"
      className="h-screen w-screen border-0"
      title={title}
    />
  );
}
