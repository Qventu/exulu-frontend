"use client";

import { useSyncExternalStore } from "react";

import { isDemoMode } from "@/lib/demo/flag";

/**
 * Catches a demo image whose browser bundle was built without the flag.
 *
 * The layout mounts this only when the SERVER says demo (it reads
 * NEXT_PUBLIC_DEMO_MODE at runtime). In the browser, isDemoMode() returns
 * what `next build` inlined — nothing, if the build arg was missing. That
 * split is a half demo: tour chrome and German from the server, "AI Studio",
 * the full nav and "No valid session token available." from the browser
 * (imp-demo, 2026-10-16). Rather than leave a prospect with that, say what
 * is wrong and where it is fixed.
 *
 * useSyncExternalStore with a server snapshot of "no mismatch": the server
 * renders this with the flag true, so a render-time check would hydrate into
 * a mismatch; this way hydration keeps the server's answer and the client's
 * follows in its own render.
 */
const subscribe = () => () => {};
const clientMismatch = () => !isDemoMode();
const serverMismatch = () => false;

export function DemoBuildGuard() {
  const mismatch = useSyncExternalStore(subscribe, clientMismatch, serverMismatch);
  if (!mismatch) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[100] bg-destructive px-4 py-2 text-center text-sm font-medium text-destructive-foreground"
    >
      Demo-Build unvollständig: NEXT_PUBLIC_DEMO_MODE war beim Build nicht gesetzt. Der Server läuft im Demo-Modus, der
      Browser-Code nicht. Das Image mit dem Build-Arg NEXT_PUBLIC_DEMO_MODE=true neu bauen (siehe Dockerfile).
    </div>
  );
}
