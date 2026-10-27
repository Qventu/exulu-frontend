// @vitest-environment jsdom
/**
 * Home's "Pick up where you left off" is the first thing a returning viewer
 * sees, so it carries the same activity markers as the chat history: an answer
 * finished while they were away, or still being written.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

import type { ResumeSession } from "../hooks";

import { ResumeStrip } from "./resume-strip";

afterEach(cleanup);

const NOW = Date.now();
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const card = (overrides: Partial<ResumeSession>): ResumeSession => ({
  id: "s1",
  agentId: "a1",
  agentName: "Spare parts agent",
  title: "Spare parts",
  updatedAt: at(-60_000),
  ...overrides,
});

const show = (sessions: ResumeSession[]) =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ResumeStrip sessions={sessions} loading={false} error={false} />
    </NextIntlClientProvider>,
  );

describe("ResumeStrip activity markers", () => {
  it("marks a conversation still being answered", () => {
    show([card({ generating_since: at(-5_000) })]);

    expect(screen.getByText(enMessages.chat.history.working)).toBeTruthy();
  });

  it("marks a conversation holding an answer nobody has read", () => {
    show([card({ last_answer_at: at(-60_000) })]);

    expect(screen.getByText(enMessages.chat.history.unreadAnswer)).toBeTruthy();
  });

  it("leaves a read, idle conversation unmarked", () => {
    show([card({ last_answer_at: at(-120_000), last_seen_at: at(-60_000) })]);

    expect(screen.queryByText(enMessages.chat.history.working)).toBeNull();
    expect(screen.queryByText(enMessages.chat.history.unreadAnswer)).toBeNull();
  });

  it("still shows the conversation title", () => {
    show([card({ last_answer_at: at(-60_000) })]);

    expect(screen.getByText("Spare parts")).toBeTruthy();
  });
});

describe("ResumeStrip meta line", () => {
  it("gives the status the timestamp's place while a turn runs", () => {
    const { container } = show([card({ generating_since: at(-5_000) })]);

    expect(screen.getByText(enMessages.chat.history.working)).toBeTruthy();
    expect(container.querySelector("time")).toBeNull();
  });

  it("gives the timestamp back on a quiet card", () => {
    const { container } = show([
      card({ last_answer_at: at(-120_000), last_seen_at: at(-60_000) }),
    ]);

    expect(container.querySelector("time")).toBeTruthy();
  });
});
