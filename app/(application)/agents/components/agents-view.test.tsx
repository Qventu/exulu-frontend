// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserContext } from "@/app/(application)/authenticated";
import enMessages from "@/messages/en.json";
import type { Agent } from "@/types/models/agent";

/**
 * The index's grouping: favourites as cards on top, then the Active section,
 * then the Inactive one. The data layer is mocked — these are the layout
 * rules, not Apollo — and the Lottie avatar is a marker (it needs a canvas).
 */

const nav = vi.hoisted(() => {
  const replace = vi.fn();
  const push = vi.fn();
  return { replace, push, router: { replace, push }, search: "" };
});

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => "/agents",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/components/lottie", () => ({
  default: () => <span data-testid="agent-visual" />,
}));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

vi.mock("./agent-detail-panel", () => ({
  AgentDetailPanel: () => <div data-testid="detail-panel" />,
}));
vi.mock("./create-agent-dialog", () => ({ CreateAgentDialog: () => null }));

const data = vi.hoisted(() => ({
  active: [] as Agent[],
  inactive: [] as Agent[],
  search: "",
  status: "all" as "all" | "active" | "inactive",
  favouriteIds: [] as string[],
  favourites: [] as Agent[],
  toggleFavourite: vi.fn(async () => {}),
}));

vi.mock("../hooks", () => {
  const section = (agents: Agent[]) => ({
    agents,
    pageInfo: {
      pageCount: 1,
      itemCount: agents.length,
      currentPage: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    },
    loading: false,
    error: undefined,
    refetch: vi.fn(),
    page: 1,
    setPage: vi.fn(),
  });
  return {
    DEFAULT_AGENTS_SORT: { field: "updatedAt", direction: "DESC" },
    useAgentsIndex: () => ({
      active: section(data.active),
      inactive: section(data.inactive),
      search: data.search,
      setSearch: vi.fn(),
      status: data.status,
      setStatus: vi.fn(),
      sort: { field: "updatedAt", direction: "DESC" },
      setSort: vi.fn(),
    }),
    useFavouriteAgents: () => ({
      favouriteIds: data.favouriteIds,
      favourites: data.favourites,
      loading: false,
      toggleFavourite: data.toggleFavourite,
    }),
    useDuplicateAgent: () => ({ duplicate: vi.fn(), duplicating: false }),
  };
});

// Imported after the mocks (vi.mock is hoisted) so the view picks them up.
import { AgentsView } from "./agents-view";

const agent = (id: string, name: string, active: boolean): Agent => ({
  id,
  name,
  type: "agent",
  active,
  modelName: "gpt-5",
  updatedAt: "2026-10-01T10:00:00.000Z",
});

const NEWTON = agent("a1", "Newton", true);
const SUPPORT = agent("a2", "Support desk", true);
const DRAFT = agent("a3", "Draft bot", false);

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <UserContext.Provider
        value={{
          user: { id: 7, super_admin: true, role: { agents: "write" } },
        }}
      >
        <AgentsView />
      </UserContext.Provider>
    </NextIntlClientProvider>,
  );
}

/** True when `a` comes before `b` in document order. */
function precedes(a: Element, b: Element): boolean {
  return (
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  );
}

describe("Agents index grouping", () => {
  beforeEach(() => {
    data.active = [NEWTON, SUPPORT];
    data.inactive = [DRAFT];
    data.search = "";
    data.status = "all";
    data.favouriteIds = [];
    data.favourites = [];
    data.toggleFavourite.mockClear();
    nav.search = "";
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    class RO {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
  });

  afterEach(cleanup);

  it("lists active agents under Active and inactive agents under Inactive, active first", () => {
    renderView();
    const active = screen.getByRole("region", { name: "Active" });
    const inactive = screen.getByRole("region", { name: "Inactive" });
    expect(within(active).getByText("Newton")).toBeTruthy();
    expect(within(active).getByText("Support desk")).toBeTruthy();
    expect(within(inactive).getByText("Draft bot")).toBeTruthy();
    expect(within(active).queryByText("Draft bot")).toBeNull();
    expect(precedes(active, inactive)).toBe(true);
  });

  it("shows no section headings while every agent is active", () => {
    data.inactive = [];
    renderView();
    expect(screen.queryByRole("heading", { name: "Active" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Inactive" })).toBeNull();
    expect(screen.getByText("Newton")).toBeTruthy();
  });

  it("renders favourited agents as cards in a Favourites section above the list", () => {
    data.favouriteIds = ["a3", "a1"];
    data.favourites = [NEWTON, DRAFT];
    renderView();
    const favourites = screen.getByRole("region", { name: "Favourites" });
    const names = within(favourites)
      .getAllByRole("button", { name: /Newton|Draft bot/ })
      .map((card) => card.textContent);
    // Star order, not list order.
    expect(names[0]).toContain("Draft bot");
    expect(names[1]).toContain("Newton");
    const active = screen.getByRole("region", { name: "Active" });
    expect(precedes(favourites, active)).toBe(true);
    // Favourites remain in their section's list too (cards are a shortcut).
    expect(within(active).getByText("Newton")).toBeTruthy();
  });

  it("hides the Favourites section while a search is active", () => {
    data.favouriteIds = ["a1"];
    data.favourites = [NEWTON];
    data.search = "new";
    renderView();
    expect(screen.queryByRole("region", { name: "Favourites" })).toBeNull();
    expect(screen.getByText("Newton")).toBeTruthy();
  });

  it("toggles an agent's favourite from its row star", () => {
    renderView();
    const active = screen.getByRole("region", { name: "Active" });
    const row = within(active).getByText("Support desk").closest("li");
    expect(row).not.toBeNull();
    fireEvent.click(
      within(row as HTMLElement).getByRole("button", {
        name: "Add to favourites",
      }),
    );
    expect(data.toggleFavourite).toHaveBeenCalledWith("a2");
  });

  it("marks a favourited row's star as pressed", () => {
    data.favouriteIds = ["a2"];
    data.favourites = [SUPPORT];
    renderView();
    const active = screen.getByRole("region", { name: "Active" });
    const row = within(active).getByText("Support desk").closest("li");
    const star = within(row as HTMLElement).getByRole("button", {
      name: "Remove from favourites",
    });
    expect(star.getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the empty state when there are no agents at all", () => {
    data.active = [];
    data.inactive = [];
    renderView();
    expect(screen.getByText("No agents yet")).toBeTruthy();
  });

  it("shows the search empty state when a search matches nothing", () => {
    data.active = [];
    data.inactive = [];
    data.search = "zzz";
    renderView();
    expect(screen.getByText("No agents match your search")).toBeTruthy();
  });
});
