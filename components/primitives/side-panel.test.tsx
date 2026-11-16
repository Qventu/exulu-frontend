// @vitest-environment jsdom
/**
 * SidePanel's `dock` escape hatch.
 *
 * The primitive picks docked-vs-Sheet off the VIEWPORT alone (`LG_QUERY`),
 * which is the right call for a full-page ListDetail: at ≥lg there is room
 * for both halves. It is the wrong call inside a host column that is itself
 * only a few hundred px wide — the artifact viewer's agent panel — where a
 * docked panel squeezes the conversation it sits next to down to an
 * unreadable sliver while the window stays "desktop". `dock={false}` is how
 * such a host says "never dock me, regardless of the window".
 *
 * matchMedia is mocked desktop-true here (jsdom implements none), following
 * agent-panel.test.tsx: every min-width query matches, so the UNSET-`dock`
 * case really does take the docked branch and the `dock={false}` case is
 * proven to override a viewport that would otherwise dock.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import enMessages from "@/messages/en.json";

import { SidePanel } from "./side-panel";

const BODY = "panel body";

function show(props: Partial<React.ComponentProps<typeof SidePanel>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SidePanel open onOpenChange={() => {}} title="Session files" {...props}>
        <p>{BODY}</p>
      </SidePanel>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: !query.includes("max-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(cleanup);

describe("SidePanel — dock", () => {
  test("docks on a desktop viewport when `dock` is unset", () => {
    const { container, baseElement } = show();

    expect(container.querySelector("aside[role='complementary']")).not.toBeNull();
    // Radix portals the Sheet to document.body, so look at the whole tree.
    expect(baseElement.querySelector("[role='dialog']")).toBeNull();
  });

  test("renders the Sheet on the same desktop viewport when dock={false}", () => {
    const { container, baseElement } = show({ dock: false });

    expect(container.querySelector("aside[role='complementary']")).toBeNull();
    const dialog = baseElement.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    // Same content, same accessible name — only the presentation changes.
    expect(screen.getByText(BODY)).toBeTruthy();
    expect(dialog?.textContent).toContain("Session files");
  });

  test("dock={true} is the explicit form of the default", () => {
    const { container } = show({ dock: true });

    expect(container.querySelector("aside[role='complementary']")).not.toBeNull();
  });
});
