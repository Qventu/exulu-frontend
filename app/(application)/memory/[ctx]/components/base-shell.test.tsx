// @vitest-environment jsdom
import { ApolloLink } from "@apollo/client";
import {
  MockedProvider,
  MockLink,
  type MockedResponse,
} from "@apollo/client/testing";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

import {
  GET_MEMORY_BASES,
  GET_MEMORY_BASE_USAGE,
  GET_MEMORY_CONFLICT_COUNTS,
  GET_MEMORY_CONFLICTS,
} from "../../queries";

/**
 * The shell's own behaviour: which body a tab mounts, what the tab bar writes
 * into the URL, and what the map card is handed. Both bodies are replaced by
 * markers — the table has its own coverage and the card has a whole suite,
 * and mounting either here would drag in their query surfaces (and, for the
 * card, three.js and a WebGL context jsdom has none of).
 */
const nav = vi.hoisted(() => {
  const replace = vi.fn();
  const push = vi.fn();
  // One router object for the life of the suite: `useRouter()` reads a context
  // value in the app router, so a fresh object per render would be the mock's
  // invention.
  return { replace, push, router: { replace, push }, search: "" };
});

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => "/memory/base-1",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("./memory-table", () => ({
  MemoryTable: () => <div data-testid="memory-table" />,
}));

/** Every set of props the card was handed, newest last — identities included. */
const card = vi.hoisted(() => ({ renders: [] as Record<string, unknown>[] }));

vi.mock("@/components/widgets/context-map/context-map-card", () => ({
  ContextMapCard: (props: Record<string, unknown>) => {
    card.renders.push(props);
    return <div data-testid="context-map-card" />;
  },
}));

// Imported after the mocks so the shell picks them up (vi.mock is hoisted).
import { BaseShell } from "./base-shell";

const CONTEXT = "base-1";

const validContext = {
  id: CONTEXT,
  name: "Client preferences",
  description: null,
  fields: [
    { name: "information", type: "longText" },
    { name: "type", type: "enum", enumValues: ["fact", "preference", "rule"] },
  ],
  memoryBase: { ok: true, missing: [] },
};

const invalidContext = {
  ...validContext,
  fields: [{ name: "information", type: "longText" }],
  memoryBase: { ok: false, missing: ["type"] },
};

const basesMock = {
  request: { query: GET_MEMORY_BASES },
  result: {
    data: {
      memoryBases: [
        {
          id: CONTEXT,
          name: "Client preferences",
          description: null,
          valid: true,
          missing: [],
          missingFromCode: false,
          agents: [{ id: "agent-1", name: "Support" }],
          stats: {
            total: 4,
            public: 3,
            private: 1,
            contributors: 2,
            visible: 4,
            lastSavedAt: "2026-10-01T00:00:00.000Z",
            lastSavedBy: { id: 9, name: "Sara Kraus" },
          },
        },
      ],
    },
  },
};

const usageMock = {
  request: {
    query: GET_MEMORY_BASE_USAGE,
    variables: { contextId: CONTEXT, staleDays: 90 },
  },
  result: {
    data: {
      memoryBaseUsage: {
        used: 3,
        neverUsed: 1,
        stale: 0,
        mostUsed: [],
        newPerWeek: [],
      },
    },
  },
};

const countsMock = {
  request: {
    query: GET_MEMORY_CONFLICT_COUNTS,
    variables: { contextId: CONTEXT },
  },
  result: {
    data: {
      memoryConflictCounts: {
        open: 1,
        memoriesInvolved: 2,
        lastScanAt: "2026-10-04T00:00:00.000Z",
      },
    },
  },
};

/** One unresolved duplicate group — `memoryConflicts` is server-side scoped
 * to unresolved groups, which is why the Conflicts route filters nothing. */
const conflictsMock = {
  request: {
    query: GET_MEMORY_CONFLICTS,
    variables: { contextId: CONTEXT },
  },
  result: {
    data: {
      memoryConflicts: [
        {
          id: "group-1",
          kind: "duplicate",
          status: "open",
          similarity: 0.94,
          reason: null,
          members: [
            {
              id: "mem-1",
              information: "The client prefers morning calls",
              type: "preference",
              author: { id: 9, name: "Sara Kraus" },
              createdAt: "2026-09-30T00:00:00.000Z",
              usedCount: 2,
            },
            {
              id: "mem-2",
              information: "Client likes calls before noon",
              type: "preference",
              author: { id: 9, name: "Sara Kraus" },
              createdAt: "2026-10-01T00:00:00.000Z",
              usedCount: 0,
            },
          ],
          scannedAt: "2026-10-04T00:00:00.000Z",
          resolvedAt: null,
          resolution: null,
          mergedInto: null,
        },
      ],
    },
  },
};

const defaultMocks: MockedResponse[] = [
  basesMock,
  usageMock,
  countsMock,
  conflictsMock,
];

/**
 * Every operation the shell actually sent, by name. A mock that simply goes
 * unused proves nothing — an unmatched request is swallowed by MockLink as a
 * network error, so a spy on a mock's result would stay silent even when the
 * query was issued.
 */
const asked: string[] = [];

afterEach(() => {
  cleanup();
  nav.search = "";
  nav.replace.mockClear();
  nav.push.mockClear();
  card.renders.length = 0;
  asked.length = 0;
});

function withProviders(ui: React.ReactElement, mocks = defaultMocks) {
  const recorder = new ApolloLink((operation, forward) => {
    asked.push(operation.operationName);
    return forward(operation);
  });
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {/* `addTypename` is a no-op in Apollo 3.14 and only logs a deprecation. */}
      {/* MockLink's addTypename must agree with the cache's, and the cache
          here is MockedProvider's default (which adds it) — hand MockLink
          `false` and every mock silently becomes a network error. */}
      <MockedProvider
        link={ApolloLink.from([recorder, new MockLink(mocks)])}
      >
        {ui}
      </MockedProvider>
    </NextIntlClientProvider>
  );
}

/** Re-renders the shell with identical props, to catch churning callbacks. */
function Harness() {
  const [, bump] = React.useState(0);
  return (
    <>
      <button type="button" onClick={() => bump((n) => n + 1)}>
        {/* A harness label is not product copy. */}
        {"bump"}
      </button>
      <BaseShell context={validContext} initialMine={false} initialPage={1} />
    </>
  );
}

const state = (name: RegExp) =>
  screen.getByRole("tab", { name }).getAttribute("data-state");

/**
 * Radix activates a tab on mousedown (and on focus in automatic mode), never
 * on `click` — a bare fireEvent.click on a trigger is silently inert.
 */
const clickTab = (name: RegExp) =>
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });

describe("BaseShell", () => {
  it("defaults to the overview tab and renders the map there", async () => {
    render(
      withProviders(
        <BaseShell context={validContext} initialMine={false} initialPage={1} />,
      ),
    );
    expect(state(/overview/i)).toBe("active");
    expect(await screen.findByTestId("context-map-card")).toBeDefined();
    expect(screen.queryByTestId("memory-table")).toBeNull();
  });

  it("renders the table under the memories tab and not on overview", async () => {
    render(
      withProviders(
        <BaseShell
          context={validContext}
          initialMine={false}
          initialPage={1}
          initialTab="memories"
        />,
      ),
    );
    expect(state(/memories/i)).toBe("active");
    expect(await screen.findByTestId("memory-table")).toBeDefined();
    expect(screen.queryByTestId("context-map-card")).toBeNull();
  });

  it("keeps the stat cards visible on every tab", async () => {
    // Captions and labels only this row renders — the tab labels repeat two of
    // the card labels, so matching those would prove nothing.
    const row = [
      "3 public · 1 private",
      "Contributors",
      "Last saved",
      "candidates to archive",
      "2 memories involved",
    ];
    render(
      withProviders(
        <BaseShell context={validContext} initialMine={false} initialPage={1} />,
      ),
    );
    await screen.findByText("2 memories involved");
    // Without this the row would be found on a page that has no tabs at all,
    // which is what the page looked like before the tab bar existed.
    expect(state(/overview/i)).toBe("active");
    for (const text of row) expect(screen.getByText(text)).toBeDefined();

    cleanup();
    render(
      withProviders(
        <BaseShell
          context={validContext}
          initialMine={false}
          initialPage={1}
          initialTab="memories"
        />,
      ),
    );
    await screen.findByText("2 memories involved");
    expect(state(/memories/i)).toBe("active");
    for (const text of row) expect(screen.getByText(text)).toBeDefined();
  });

  it("shows the invalid-base empty state instead of tabs when the contract is not met", async () => {
    // "Instead of" is the claim, so the valid base has to prove there is a tab
    // list to withhold — otherwise this passes on a page with no tabs at all.
    render(
      withProviders(
        <BaseShell context={validContext} initialMine={false} initialPage={1} />,
      ),
    );
    expect(screen.queryAllByRole("tab")).toHaveLength(3);

    cleanup();
    render(
      withProviders(
        <BaseShell
          context={invalidContext}
          initialMine={false}
          initialPage={1}
        />,
      ),
    );
    expect(await screen.findByText(/must include the fields: type/i)).toBeDefined();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryByTestId("context-map-card")).toBeNull();
    expect(screen.queryByTestId("memory-table")).toBeNull();
  });

  it("writes the tab into the URL and drops the map's selection when leaving overview", async () => {
    nav.search = "selected=chunk-1&topic=2";
    render(
      withProviders(
        <BaseShell context={validContext} initialMine={false} initialPage={1} />,
      ),
    );
    await screen.findByTestId("context-map-card");
    clickTab(/memories/i);
    expect(nav.replace).toHaveBeenCalledWith("/memory/base-1?tab=memories", {
      scroll: false,
    });
  });

  it("drops the list's page and visibility when leaving the memories tab", async () => {
    nav.search = "tab=memories&page=3&mine=1";
    render(
      withProviders(
        <BaseShell
          context={validContext}
          initialMine
          initialPage={3}
          initialTab="memories"
        />,
      ),
    );
    await screen.findByTestId("memory-table");
    clickTab(/overview/i);
    // The default tab writes no parameter of its own, and the list's state
    // would otherwise be reapplied the next time the table mounts.
    expect(nav.replace).toHaveBeenCalledWith("/memory/base-1", {
      scroll: false,
    });
  });

  it("navigates to the conflicts route instead of switching a body", async () => {
    render(
      withProviders(
        <BaseShell context={validContext} initialMine={false} initialPage={1} />,
      ),
    );
    await screen.findByTestId("context-map-card");
    clickTab(/conflicts/i);
    expect(nav.push).toHaveBeenCalledWith("/memory/base-1/conflicts");
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("colours the map by the base's declared type values, in declared order", async () => {
    render(
      withProviders(
        <BaseShell context={validContext} initialMine={false} initialPage={1} />,
      ),
    );
    await screen.findByTestId("context-map-card");
    const props = card.renders[card.renders.length - 1];
    expect(props.contextId).toBe(CONTEXT);
    expect(props.groups).toEqual(["fact", "preference", "rule"]);
    expect(props.groupField).toBe("type");
    expect(props.titleKey).toBe("memory");
    expect((props.itemHref as (id: string) => string)("mem-7")).toBe(
      "/memory/base-1/mem-7",
    );
  });

  it("rings the memories in an unresolved conflict group", async () => {
    render(
      withProviders(
        <BaseShell context={validContext} initialMine={false} initialPage={1} />,
      ),
    );
    await screen.findByTestId("context-map-card");
    // ITEM ids: the card owns the translation to passages, because only it
    // holds the answer that carries both ids.
    await waitFor(() =>
      expect(card.renders.at(-1)!.ringedItemIds).toEqual(
        new Set(["mem-1", "mem-2"]),
      ),
    );
  });

  it("asks for the conflict groups on the overview tab only", async () => {
    render(
      withProviders(
        <BaseShell context={validContext} initialMine={false} initialPage={1} />,
      ),
    );
    await screen.findByTestId("context-map-card");
    // Paired with the negative half below: without this, "never asked" would
    // also pass on a shell that never asks at all.
    await waitFor(() => expect(asked).toContain("MemoryConflicts"));

    cleanup();
    asked.length = 0;
    render(
      withProviders(
        <BaseShell
          context={validContext}
          initialMine={false}
          initialPage={1}
          initialTab="memories"
        />,
      ),
    );
    await screen.findByTestId("memory-table");
    await waitFor(() => expect(asked).toContain("MemoryBaseUsage"));
    expect(asked).not.toContain("MemoryConflicts");
  });

  it("hands the map the same groups and itemHref across a re-render", async () => {
    render(withProviders(<Harness />));
    await screen.findByTestId("context-map-card");
    const before = card.renders.length;
    fireEvent.click(screen.getByRole("button", { name: "bump" }));
    // A fresh array or arrow here re-uploads every buffer in the renderer.
    expect(card.renders.length).toBeGreaterThan(before);
    const first = card.renders[0];
    const last = card.renders[card.renders.length - 1];
    expect(last.groups).toBe(first.groups);
    expect(last.itemHref).toBe(first.itemHref);
  });
});
