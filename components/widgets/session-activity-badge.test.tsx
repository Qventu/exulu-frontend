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

const show = (session: Record<string, unknown>) =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SessionActivityBadge session={session as never} now={NOW} />
    </NextIntlClientProvider>,
  );

describe("SessionActivityBadge", () => {
  it("renders nothing for a conversation with nothing to report", () => {
    const { container } = show({ last_answer_at: at(-120_000), last_seen_at: at(-60_000) });

    expect(container.firstChild).toBeNull();
  });

  it("tells the reader an answer is being written", () => {
    show({ generating_since: at(-5_000) });

    expect(screen.getByLabelText(enMessages.chat.history.working)).toBeTruthy();
  });

  it("tells the reader an answer is waiting to be read", () => {
    show({ last_answer_at: at(-60_000) });

    expect(screen.getByLabelText(enMessages.chat.history.unreadAnswer)).toBeTruthy();
  });

  it("does not say both things at once while a follow-up is running", () => {
    show({ generating_since: at(-5_000), last_answer_at: at(-60_000) });

    expect(screen.getByLabelText(enMessages.chat.history.working)).toBeTruthy();
    expect(screen.queryByLabelText(enMessages.chat.history.unreadAnswer)).toBeNull();
  });

  it("distinguishes the two states by more than colour", () => {
    const { container: working } = show({ generating_since: at(-5_000) });
    const { container: unread } = show({ last_answer_at: at(-60_000) });

    // A spinner for in-progress, a plain dot for waiting — a reader who cannot
    // tell blue from grey can still tell these apart.
    expect(working.querySelector("svg")).toBeTruthy();
    expect(unread.querySelector("svg")).toBeNull();
  });
});
