import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Reads the media query synchronously via useSyncExternalStore instead of the
 * old undefined-then-effect dance, fixing the desktop-first flash on mobile
 * (shell audit L4): the client snapshot is correct on the very first
 * post-hydration render, before paint. SSR renders the desktop layout
 * (server snapshot `false`).
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}
