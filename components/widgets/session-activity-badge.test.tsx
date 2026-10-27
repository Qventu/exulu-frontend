// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import enMessages from "@/messages/en.json";

import { SessionActivityBadge } from "./session-activity-badge";

afterEach(cleanup);

const NOW = Date.parse("2026-10-27T12:00:00.000Z");
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const WORKING = enMessages.chat.history.working;
const UNREAD = enMessages.chat.history.unreadAnswer;

const show = (session: Record<string, unknown>, isOpen = false) =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SessionActivityBadge session={session as never} now={NOW} isOpen={isOpen} />
    </NextIntlClientProvider>,
  );

describe("SessionActivityBadge", () => {
  it("renders nothing for a conversation with nothing to report", () => {
    const { container } = show({ last_answer_at: at(-120_000), last_seen_at: at(-60_000) });

    expect(container.firstChild).toBeNull();
  });

  it("says in words that an answer is being written", () => {
    // A bare icon was not readable at a glance; the state is now spelled out.
    show({ generating_since: at(-5_000) });

    expect(screen.getByText(WORKING)).toBeTruthy();
  });

  it("says in words that an answer is waiting", () => {
    show({ last_answer_at: at(-60_000) });

    expect(screen.getByText(UNREAD)).toBeTruthy();
  });

  it("does not say both things at once while a follow-up is running", () => {
    show({ generating_since: at(-5_000), last_answer_at: at(-60_000) });

    expect(screen.getByText(WORKING)).toBeTruthy();
    expect(screen.queryByText(UNREAD)).toBeNull();
  });

  it("distinguishes the two states by more than colour", () => {
    const { container: working } = show({ generating_since: at(-5_000) });
    const { container: unread } = show({ last_answer_at: at(-60_000) });

    // A spinner for in-progress, a plain dot for waiting.
    expect(working.querySelector("svg")).toBeTruthy();
    expect(unread.querySelector("svg")).toBeNull();
  });

  it("keeps the spinner out of the accessible name, which the text already carries", () => {
    const { container } = show({ generating_since: at(-5_000) });

    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it.each([
    ["working", { generating_since: at(-5_000) }],
    ["unread", { last_answer_at: at(-60_000) }],
  ])("does not render the %s state in the muted colour it was lost in", (_name, session) => {
    const { container } = show(session);

    expect(container.innerHTML).not.toContain("text-muted-foreground");
  });

  describe("on the conversation you are reading", () => {
    it("never calls an open conversation unread", () => {
      show({ last_answer_at: at(-1_000) }, true);

      expect(screen.queryByText(UNREAD)).toBeNull();
    });

    it("still shows an open conversation as answering", () => {
      show({ generating_since: at(-5_000) }, true);

      expect(screen.getByText(WORKING)).toBeTruthy();
    });
  });
});
