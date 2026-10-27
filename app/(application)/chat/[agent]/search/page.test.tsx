// @vitest-environment jsdom
/**
 * The "See all" list is the same chat history as the rail, so it has to carry
 * the same activity markers — a conversation that looks busy in the rail and
 * idle here would just read as a bug.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

const list = vi.hoisted(() => ({ sessions: [] as Record<string, unknown>[] }));

vi.mock("../../hooks", () => ({
  useChatSessions: () => ({
    sessions: list.sessions,
    itemCount: list.sessions.length,
    loading: false,
    initialLoading: false,
    refetch: vi.fn(),
  }),
  useSessionMutations: () => ({
    createNamedSession: vi.fn(),
    renameSession: vi.fn(),
    deleteSession: vi.fn(),
    deleteSessions: vi.fn(),
    creating: false,
    renaming: false,
    deleting: false,
  }),
}));

vi.mock("../../components/chat-shell", () => ({
  useChatShell: () => ({ agent: { id: "a1", name: "Agent" } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/chat/a1/search",
}));

import { UserContext } from "@/app/(application)/authenticated";

import SearchPage from "./page";

// The real clock, not a fixed instant: the badge on this page takes no `now`
// prop, so a timestamp pinned to a date in the past reads as stale.
const NOW = Date.now();
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const row = (overrides: Record<string, unknown>) => ({
  id: "s1",
  title: "Spare parts",
  agent: "a1",
  updatedAt: at(-60_000),
  created_by: 7,
  rights_mode: "private",
  ...overrides,
});

// A pre-settled thenable, the shape React.use() can read without suspending
// (status/value is React's own convention for one, and what Next hands a page
// whose params are already known). A bare Promise.resolve suspends on first
// use, so only the cases AFTER the first would have rendered.
const PARAMS = Object.assign(Promise.resolve({ agent: "a1" }), {
  status: "fulfilled",
  value: { agent: "a1" },
});

const show = () =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <UserContext.Provider value={{ user: { id: 7 } }}>
        <React.Suspense fallback={<div>loading</div>}>
          <SearchPage params={PARAMS as never} />
        </React.Suspense>
      </UserContext.Provider>
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  list.sessions = [];
});
afterEach(cleanup);

describe("chat search page activity markers", () => {
  // The page reads its route params with React.use(), so it suspends on the
  // first render — every case has to await the resolved tree.
  it("marks a conversation still being answered", async () => {
    list.sessions = [row({ generating_since: at(-5_000) })];

    show();

    expect(await screen.findByLabelText(enMessages.chat.history.working)).toBeTruthy();
  });

  it("marks a conversation holding an unread answer", async () => {
    list.sessions = [row({ last_answer_at: at(-60_000) })];

    show();

    expect(await screen.findByLabelText(enMessages.chat.history.unreadAnswer)).toBeTruthy();
  });

  it("leaves a read, idle conversation unmarked", async () => {
    list.sessions = [row({ last_answer_at: at(-120_000), last_seen_at: at(-60_000) })];

    show();
    await screen.findByText("Spare parts");

    expect(screen.queryByLabelText(enMessages.chat.history.working)).toBeNull();
    expect(screen.queryByLabelText(enMessages.chat.history.unreadAnswer)).toBeNull();
  });
});
