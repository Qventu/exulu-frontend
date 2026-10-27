// @vitest-environment jsdom
/**
 * What the chat screen shows while a turn runs that this tab is not
 * receiving. Without it the screen looks like a finished conversation —
 * and on a session whose FIRST turn is still running it showed the
 * greeting empty state, inviting the viewer to start a conversation that
 * was already under way.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import enMessages from "@/messages/en.json";

import { CatchingUpNotice } from "./catching-up-notice";

afterEach(cleanup);

const show = () =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CatchingUpNotice />
    </NextIntlClientProvider>,
  );

describe("CatchingUpNotice", () => {
  it("says the agent is still writing", () => {
    show();

    expect(screen.getByText(enMessages.chat.catchingUp.title)).toBeTruthy();
  });

  it("sets the expectation that the answer arrives on its own", () => {
    // Without this the viewer waits for a stream that is never coming to
    // this tab — the answer appears complete when the turn ends.
    show();

    expect(screen.getByText(enMessages.chat.catchingUp.description)).toBeTruthy();
  });

  it("announces itself to assistive technology as a live status", () => {
    const { container } = show();

    expect(container.querySelector('[role="status"]')).toBeTruthy();
  });

  it("keeps its spinner out of the accessible name", () => {
    const { container } = show();

    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
