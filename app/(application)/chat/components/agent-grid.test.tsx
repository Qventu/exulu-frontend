// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import type { Agent } from "@/types/models/agent";

/**
 * The /chat picker (and the agent switcher) is the same grid: the user's
 * starred agents come first in their own section, the full roster follows.
 * Apollo is mocked at the hook — GET_AGENTS selects the whole AGENT_FIELDS
 * shape, which is not what this test is about.
 */

vi.mock("@/components/lottie", () => ({
  default: () => <span data-testid="visual" />,
}));

const grid = vi.hoisted(() => ({
  agents: [] as Agent[],
  favouriteIds: [] as string[],
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useQuery: () => ({
      data: { agentsPagination: { items: grid.agents } },
      loading: false,
    }),
  };
});

vi.mock("@/hooks/use-favourite-agents", () => ({
  useFavouriteAgents: () => ({
    favouriteIds: grid.favouriteIds,
    favourites: [],
    loading: false,
    toggleFavourite: vi.fn(),
  }),
}));

import { AgentGrid } from "./agent-grid";

const agent = (id: string, name: string): Agent => ({
  id,
  name,
  type: "agent",
  active: true,
  modelName: "gpt-5",
  description: `${name} helps.`,
});

const precedes = (a: Element, b: Element) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

function renderGrid() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <AgentGrid onSelect={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

describe("AgentGrid favourites", () => {
  beforeEach(() => {
    grid.agents = [
      agent("a1", "Newton"),
      agent("a2", "Support desk"),
      agent("a3", "Vertrieb"),
    ];
    grid.favouriteIds = [];
  });
  afterEach(cleanup);

  it("shows starred agents first in a Favourites section, then every agent", () => {
    grid.favouriteIds = ["a3", "a1"];
    renderGrid();
    const favourites = screen.getByRole("region", {
      name: enMessages.chat.agentSelect.favourites,
    });
    const all = screen.getByRole("region", {
      name: enMessages.chat.agentSelect.allAgents,
    });
    const starred = within(favourites)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(starred[0]).toContain("Vertrieb");
    expect(starred[1]).toContain("Newton");
    expect(starred).toHaveLength(2);
    expect(within(all).getAllByRole("button")).toHaveLength(3);
    expect(precedes(favourites, all)).toBe(true);
  });

  it("renders the plain grid without sections when nothing is starred", () => {
    renderGrid();
    expect(
      screen.queryByRole("region", {
        name: enMessages.chat.agentSelect.favourites,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("region", {
        name: enMessages.chat.agentSelect.allAgents,
      }),
    ).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("drops the sections while searching", async () => {
    grid.favouriteIds = ["a1"];
    renderGrid();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "sup" },
    });
    // The Toolbar hands the term over on its own tick even at debounceMs 0.
    await waitFor(() =>
      expect(
        screen.queryByRole("region", {
          name: enMessages.chat.agentSelect.favourites,
        }),
      ).toBeNull(),
    );
    const cards = screen
      .getAllByRole("button")
      .filter(
        (b) =>
          b.getAttribute("type") === "button" &&
          b.textContent?.includes("helps."),
      );
    expect(cards.map((b) => b.textContent?.includes("Support desk"))).toEqual([
      true,
    ]);
  });

  it("ignores starred ids the grid does not know (inactive or deleted agents)", () => {
    grid.favouriteIds = ["gone", "a2"];
    renderGrid();
    const favourites = screen.getByRole("region", {
      name: enMessages.chat.agentSelect.favourites,
    });
    expect(within(favourites).getAllByRole("button")).toHaveLength(1);
  });
});
