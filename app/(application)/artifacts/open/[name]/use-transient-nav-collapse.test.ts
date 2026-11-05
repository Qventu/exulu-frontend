// @vitest-environment jsdom
/**
 * `useTransientNavCollapse` — the artifact panel squeezes the page, so the app
 * nav has to give up its width while the panel is open.
 *
 * Why a dedicated hook with a dedicated test: `SidebarProvider.setOpen` writes
 * the `sidebar_state` cookie on EVERY call (components/ui/sidebar.tsx:92), in
 * both the controlled and the uncontrolled branch, and the app shell mounts the
 * provider uncontrolled (app/(application)/authenticated.tsx) — so its API has
 * no non-persisting path. Collapsing the nav the obvious way would overwrite
 * the user's GLOBAL sidebar preference for every page in the IMP. The contract
 * pinned down here is therefore the cookie, not the collapse: `document.cookie`
 * must come out of an activate/deactivate cycle byte-identical.
 *
 * jsdom (not node) because the hook reads the sidebar context, which means
 * mounting `SidebarProvider`; the wrapper is built with `React.createElement`
 * so this file stays the `.ts` the plan names.
 */
import { cleanup, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";

import { useTransientNavCollapse } from "./use-transient-nav-collapse";

/** Expire every cookie jsdom is holding, so tests cannot leak into each other. */
function clearCookies() {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
}

beforeEach(() => {
  // SidebarProvider → useIsMobile → window.matchMedia, which jsdom does not
  // implement. Desktop: every min-width query matches, no max-width one does.
  window.matchMedia = ((query: string) => ({
    matches: !query.includes("max-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  clearCookies();
});

afterEach(() => {
  cleanup();
  clearCookies();
});

/** The hook under test, plus the sidebar state it is supposed to move. */
const mount = (active: boolean, navOpen = true) =>
  renderHook(
    (props: { active: boolean }) => {
      useTransientNavCollapse(props.active);
      return useSidebar();
    },
    {
      initialProps: { active },
      wrapper: ({ children }) =>
        React.createElement(
          SidebarProvider,
          { defaultOpen: navOpen },
          children,
        ),
    },
  );

describe("useTransientNavCollapse", () => {
  test("collapses the nav while active", () => {
    const { result, rerender } = mount(false);
    expect(result.current.open).toBe(true);

    rerender({ active: true });

    expect(result.current.open).toBe(false);
    expect(result.current.state).toBe("collapsed");
  });

  test("restores the previous state on deactivate", () => {
    const { result, rerender } = mount(false);

    rerender({ active: true });
    expect(result.current.open).toBe(false);

    rerender({ active: false });

    expect(result.current.open).toBe(true);
    expect(result.current.state).toBe("expanded");
  });

  test("leaves a nav the user had already collapsed collapsed", () => {
    // "Previous state" cuts both ways: a user who works with the nav closed
    // must not find it expanded when they close the panel.
    const { result, rerender } = mount(false, false);
    expect(result.current.open).toBe(false);

    rerender({ active: true });
    expect(result.current.open).toBe(false);

    rerender({ active: false });

    expect(result.current.open).toBe(false);
  });

  test("never writes the sidebar_state cookie", () => {
    document.cookie = "sidebar_state=true; path=/";
    const before = document.cookie;
    expect(before).toContain("sidebar_state=true");

    const { result, rerender } = mount(false);

    rerender({ active: true });
    // The nav really did collapse — this is not a pass by doing nothing.
    expect(result.current.open).toBe(false);
    expect(document.cookie).toBe(before);

    rerender({ active: false });
    expect(result.current.open).toBe(true);
    expect(document.cookie).toBe(before);
  });

  test("does not create the cookie for a user who has none", () => {
    expect(document.cookie).toBe("");

    const { result, rerender } = mount(false);
    rerender({ active: true });
    expect(result.current.open).toBe(false);

    expect(document.cookie).toBe("");

    rerender({ active: false });
    expect(document.cookie).toBe("");
  });
});
