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

    const fetchGrant = async (): Promise<Grant | null> => {
      try {
        const res = await fetch(
          `/artifacts/${encodeURIComponent(artifactName)}/identity`,
          { cache: "no-store" },
        );
        if (!res.ok) return null;
        const body = await res.json();
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

    const onMessage = async (event: MessageEvent) => {
      const frame = ref.current;
      // Verification is by window identity, not origin: a sandboxed frame's
      // origin is the string "null" and proves nothing, whereas a window
      // reference is the frame itself.
      if (!frame || event.source !== frame.contentWindow) return;
      if (event.data?.type !== "exulu:identity:request") return;

      const grant = await fetchGrant();
      const target = ref.current?.contentWindow;
      if (cancelled || !target) return;

      if (!grant) {
        // targetOrigin "*" is mandatory: the frame's origin is opaque and
        // "null" is not a valid targetOrigin. Delivery is still targeted,
        // because it goes to this one contentWindow.
        target.postMessage(denied("unavailable"), "*");
        return;
      }

      const channel = new MessageChannel();
      channel.port1.onmessage = async (portEvent: MessageEvent) => {
        if (portEvent.data?.type !== "exulu:identity:refresh") return;
        const fresh = await fetchGrant();
        if (cancelled) return;
        channel.port1.postMessage(fresh ?? denied("unavailable"));
      };

      target.postMessage(grant, "*", [channel.port2]);
    };

    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
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
