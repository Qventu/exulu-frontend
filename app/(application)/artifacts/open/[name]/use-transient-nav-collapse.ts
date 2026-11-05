"use client";

/**
 * useTransientNavCollapse — collapse the app nav while the agent panel is
 * open, WITHOUT touching the user's stored sidebar preference.
 *
 * The artifact panel docks beside the artifact and takes real width from it
 * (spec §"Layout: docked split"), so the app nav has to stand down while it is
 * open. The obvious implementation is the wrong one:
 * `SidebarProvider.setOpen` writes the `sidebar_state` cookie on EVERY call
 * (components/ui/sidebar.tsx:92) — in the controlled branch and the
 * uncontrolled one alike — and the app shell mounts the provider uncontrolled
 * (app/(application)/authenticated.tsx), so there is no `onOpenChange` to
 * intercept and no non-persisting path through its API. Calling it plainly
 * would overwrite the user's GLOBAL nav preference for every page in the IMP
 * because they opened an agent beside an artifact once.
 *
 * So this hook takes the second option the spec allows: capture the cookie,
 * drive the real provider API, and put the cookie back in the same
 * synchronous turn, so nothing — not a reload, not the next page, not a
 * `document.cookie` reader — ever observes a changed `sidebar_state`.
 */

import * as React from "react";

import { useSidebar } from "@/components/ui/sidebar";

/** Mirrors components/ui/sidebar.tsx — the cookie this hook must not change. */
const SIDEBAR_COOKIE_NAME = "sidebar_state";
/** Mirrors SIDEBAR_COOKIE_MAX_AGE there: a restore must not shorten its life. */
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function readSidebarCookie(): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${SIDEBAR_COOKIE_NAME}=([^;]*)`),
  );
  return match ? match[1] : null;
}

/**
 * Runs `mutate` and leaves `sidebar_state` exactly as it found it — same value
 * and same `path=/` scope, so the provider's own write is overwritten rather
 * than shadowed by a second cookie at a narrower path. A user who had no
 * sidebar cookie keeps having none.
 */
function withoutPersisting(mutate: () => void) {
  const prior = readSidebarCookie();
  mutate();
  document.cookie =
    prior === null
      ? `${SIDEBAR_COOKIE_NAME}=; path=/; max-age=0`
      : `${SIDEBAR_COOKIE_NAME}=${prior}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
}

/**
 * While `active`, the app nav is collapsed; when it goes false (or the caller
 * unmounts) the nav goes back to what it was. A nav the user had already
 * collapsed is never touched, and a nav the user re-opened BY HAND while the
 * panel was up is left alone on the way out — an explicit action beats this
 * hook's restore.
 */
export function useTransientNavCollapse(active: boolean) {
  const { open, setOpen } = useSidebar();

  // Latest-value mirrors. `setOpen` is a useCallback over [setOpenProp, open],
  // so its identity changes every time the nav moves: as an effect dependency
  // it would re-run this effect on its own state change, and the cleanup would
  // immediately expand what the effect just collapsed (an endless flap). The
  // effect below therefore depends on `active` ALONE and reads both values
  // through refs.
  const openRef = React.useRef(open);
  const setOpenRef = React.useRef(setOpen);
  React.useEffect(() => {
    openRef.current = open;
    setOpenRef.current = setOpen;
  }, [open, setOpen]);

  React.useEffect(() => {
    if (!active) return;
    // Already collapsed — nothing to collapse, and so nothing to restore.
    if (!openRef.current) return;

    withoutPersisting(() => setOpenRef.current(false));

    return () => {
      // The nav is expanded again, which this hook did not do: the user did.
      // Leave it.
      if (openRef.current) return;
      withoutPersisting(() => setOpenRef.current(true));
    };
  }, [active]);
}
