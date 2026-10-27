// @vitest-environment jsdom
/**
 * The history row has to say what a conversation is doing, because the whole
 * point of the activity stamps is being readable without opening the chat.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/chat/agent-1/other-session",
}));

vi.mock("./chat-shell", () => ({
  useChatShell: () => ({ startNewChat: vi.fn() }),
}));

import { UserContext } from "@/app/(application)/authenticated";

import { SessionRow } from "./session-row";

afterEach(cleanup);

const NOW = Date.parse("2026-10-27T12:00:00.000Z");
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const mutations: any = {
  createNamedSession: vi.fn(),
  renameSession: vi.fn(),
  deleteSession: vi.fn(),
  deleteSessions: vi.fn(),
  creating: false,
  renaming: false,
  deleting: false,
};

const show = (session: Record<string, unknown>) =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <UserContext.Provider value={{ user: { id: 7 } }}>
        <SessionRow
          session={
            {
              id: "session-1",
              title: "Spare parts",
              agent: "agent-1",
              updatedAt: at(-60_000),
              created_by: 7,
              rights_mode: "private",
              ...session,
            } as never
          }
          agentId="agent-1"
          mutations={mutations}
          now={NOW}
        />
      </UserContext.Provider>
    </NextIntlClientProvider>,
  );

describe("SessionRow activity", () => {
  it("marks a row whose agent is still working", () => {
    show({ generating_since: at(-5_000) });

    expect(screen.getByLabelText(enMessages.chat.history.working)).toBeTruthy();
  });

  it("marks a row holding an answer nobody has read", () => {
    show({ last_answer_at: at(-60_000) });

    expect(screen.getByLabelText(enMessages.chat.history.unreadAnswer)).toBeTruthy();
  });

  it("leaves a read, idle row unmarked", () => {
    show({ last_answer_at: at(-120_000), last_seen_at: at(-60_000) });

    expect(screen.queryByLabelText(enMessages.chat.history.working)).toBeNull();
    expect(screen.queryByLabelText(enMessages.chat.history.unreadAnswer)).toBeNull();
  });

  it("still shows the conversation title alongside the marker", () => {
    show({ last_answer_at: at(-60_000) });

    expect(screen.getByText("Spare parts")).toBeTruthy();
  });
});
