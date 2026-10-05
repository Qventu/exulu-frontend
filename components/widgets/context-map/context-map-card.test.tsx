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
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  GET_CONTEXT_MAP_EDGES,
  GET_CONTEXT_MAP_POINTS,
  GET_CONTEXT_MAP_TOPICS,
  GET_CONTEXT_PROJECTION_STATUS,
} from "@/lib/graphql/operations/context-map";
import enMessages from "@/messages/en.json";

/**
 * The renderer opens a WebGL context, which jsdom has none of, so the dynamic
 * import is replaced by a marker. Everything asserted below is the card's own
 * behaviour: which queries it issues, which state it shows and what the panel
 * says — never markup.
 */
const nav = vi.hoisted(() => {
  const replace = vi.fn();
  // One object for the life of the suite: `useRouter()` reads a context value
  // in the app router, so a fresh object per render would be the mock's
  // invention and would hide a callback that churns.
  return { replace, router: { replace }, search: "" };
});
/** Every set of props the renderer was handed, newest last. */
const canvas = vi.hoisted(() => ({ renders: [] as Record<string, unknown>[] }));

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockMapCanvas(props: Record<string, unknown>) {
      canvas.renders.push(props);
      return <div data-testid="canvas" />;
    },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => "/memory/base-1",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

// Imported after the mocks so the card picks them up (vi.mock is hoisted).
import { ContextMapCard } from "./context-map-card";

/**
 * jsdom 26 has no `window.matchMedia` at all, so the panel's breakpoint hook
 * needs one. `viewport.large` is what the lg query answers; everything else
 * (reduced motion, the md query) answers false, which is this suite's point of
 * view: a small screen unless a test says otherwise.
 */
const viewport = { large: false };

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("1024") ? viewport.large : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

// vitest.config.ts does not set `test.globals: true`, so testing-library's
// implicit afterEach(cleanup) never registers — unmount explicitly or renders
// pile up in the same jsdom document.
afterEach(() => {
  cleanup();
  nav.search = "";
  nav.replace.mockClear();
  viewport.large = false;
  asked.length = 0;
  canvas.renders.length = 0;
  // The card mirrors its selection with history.replaceState, which outlives a
  // render in the one jsdom document this file shares.
  window.history.replaceState(null, "", "/");
});

const CONTEXT = "base-1";

const passage = (id: string) => ({
  id,
  itemId: `item-${id}`,
  x: 0.1,
  y: 0.2,
  z: 0.3,
  label: `the text of ${id}`,
  group: "fact",
  chunks: 1,
});

/** A passage on the x axis, so which region is nearest is arithmetic. */
const placed = (id: string, x: number) => ({ ...passage(id), x, y: 0, z: 0 });

const pointsRequest = {
  query: GET_CONTEXT_MAP_POINTS,
  variables: {
    contextId: CONTEXT,
    mode: "PASSAGES",
    groupField: null,
    limit: 20000,
  },
};

const pointsMock = {
  request: pointsRequest,
  result: {
    data: {
      contextMapPoints: {
        points: [passage("chunk-1"), passage("chunk-2")],
        total: 2,
        sampled: false,
      },
    },
  },
};

const sampledPointsMock = {
  request: pointsRequest,
  result: {
    data: {
      contextMapPoints: {
        points: [passage("chunk-1")],
        total: 54321,
        sampled: true,
      },
    },
  },
};

const emptyPointsMock = {
  request: pointsRequest,
  result: { data: { contextMapPoints: null } },
};

const placedPointsMock = {
  request: pointsRequest,
  // Nearest centre: a -> "0" (1 vs 81), b -> "0" (16 vs 36), c -> "1" (81 vs 1).
  result: {
    data: {
      contextMapPoints: {
        points: [placed("a", 1), placed("b", 4), placed("c", 9)],
        total: 3,
        sampled: false,
      },
    },
  },
};

const topicsMock = {
  request: { query: GET_CONTEXT_MAP_TOPICS, variables: { contextId: CONTEXT } },
  result: {
    data: {
      contextMapTopics: [
        { id: "0", label: "Valves & Blocks", count: 2, x: 0, y: 0, z: 0 },
        { id: "1", label: "Pricing", count: 1, x: 10, y: 0, z: 0 },
      ],
    },
  },
};

const emptyTopicsMock = {
  request: { query: GET_CONTEXT_MAP_TOPICS, variables: { contextId: CONTEXT } },
  result: { data: { contextMapTopics: [] } },
};

const status = (fitted: boolean) => ({
  request: {
    query: GET_CONTEXT_PROJECTION_STATUS,
    variables: { contextId: CONTEXT },
  },
  result: {
    data: {
      contextProjectionStatus: {
        fitted,
        fittedAt: fitted ? "2026-10-05T00:00:00.000Z" : null,
        residual: 0.1,
        mappedChunks: fitted ? 2 : 0,
        totalChunks: 2,
      },
    },
  },
});
const statusMock = status(true);
const statusErrorMock = {
  request: {
    query: GET_CONTEXT_PROJECTION_STATUS,
    variables: { contextId: CONTEXT },
  },
  error: new Error("the status query is down"),
};
const notFittedStatusMock = status(false);

const edgesRequest = (nodeId: string) => ({
  query: GET_CONTEXT_MAP_EDGES,
  variables: { contextId: CONTEXT, nodeId, mode: "PASSAGES" },
});

const edgesMock = {
  request: edgesRequest("chunk-1"),
  result: {
    data: {
      contextMapEdges: [
        { source: "chunk-1", target: "chunk-2", score: 0.8 },
        { source: "chunk-1", target: "chunk-404", score: 0.4 },
      ],
    },
  },
};

const placedEdgesMock = {
  request: edgesRequest("a"),
  result: {
    data: { contextMapEdges: [{ source: "a", target: "b", score: 0.8 }] },
  },
};

const edgesErrorMock = {
  request: edgesRequest("chunk-1"),
  error: new Error("edges are down"),
};

/**
 * Every operation the card actually sent, by name. A mock that simply goes
 * unused proves nothing — an unmatched request is swallowed by MockLink as a
 * network error, so a spy on a mock's result would stay silent even when the
 * query was issued.
 */
const asked: string[] = [];

function withProviders(
  mocks: MockedResponse[],
  params: {
    selected?: string;
    topic?: string;
    /** Items in a conflict group, as the surfaces above actually know them. */
    ringedItemIds?: Set<string>;
  } = {},
) {
  const search = new URLSearchParams();
  if (params.selected !== undefined) search.set("selected", params.selected);
  if (params.topic !== undefined) search.set("topic", params.topic);
  nav.search = search.toString();
  const recorder = new ApolloLink((operation, forward) => {
    asked.push(operation.operationName);
    return forward(operation);
  });
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <MockedProvider
        addTypename={false}
        link={ApolloLink.from([recorder, new MockLink(mocks, false)])}
      >
        <ContextMapCard
          contextId={CONTEXT}
          groups={["fact", "preference"]}
          groupField={null}
          ringedItemIds={params.ringedItemIds}
          itemHref={(itemId) => `/memory/${CONTEXT}/${itemId}`}
          titleKey="memory"
        />
      </MockedProvider>
    </NextIntlClientProvider>
  );
}

/** Re-renders the card with a *fresh* `groups` array holding the same values. */
function Harness() {
  const [, bump] = React.useState(0);
  return (
    <>
      <button type="button" onClick={() => bump((n) => n + 1)}>
        {/* The namespace is the product's; a test harness label is not copy. */}
        {"bump"}
      </button>
      <ContextMapCard
        contextId={CONTEXT}
        groups={["fact", "preference"]}
        groupField={null}
        itemHref={(itemId) => `/memory/${CONTEXT}/${itemId}`}
        titleKey="memory"
      />
    </>
  );
}

describe("ContextMapCard", () => {
  it("draws without labels or chips when the base has points but no topics", async () => {
    // A base fitted before topics existed. The cloud must still render.
    render(withProviders([pointsMock, emptyTopicsMock, statusMock]));
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    expect(screen.queryByRole("group", { name: /topics/i })).toBeNull();
  });

  it("shows the not-mapped state, and no canvas, when the base was never fitted", async () => {
    render(
      withProviders([emptyPointsMock, emptyTopicsMock, notFittedStatusMock]),
    );
    await waitFor(() =>
      expect(screen.getByText(/not been mapped/i)).toBeDefined(),
    );
    expect(screen.queryByTestId("canvas")).toBeNull();
  });

  it("says how many of how many it is drawing when the answer was sampled", async () => {
    render(withProviders([sampledPointsMock, emptyTopicsMock, statusMock]));
    await waitFor(() => expect(screen.getByText(/1 of 54,321/)).toBeDefined());
  });

  it("tells the viewer when a linked passage is not one they can read", async () => {
    // ?selected= from a shared link, pointing at a passage absent from the
    // access-scoped points answer.
    render(
      withProviders([pointsMock, emptyTopicsMock, statusMock], {
        selected: "not-mine",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText(/not available/i)).toBeDefined(),
    );
  });

  it("keeps the cloud when the edges query fails, and says so in the panel", async () => {
    // Spec §5: an edges failure surfaces on that query only.
    render(
      withProviders([pointsMock, emptyTopicsMock, statusMock, edgesErrorMock], {
        selected: "chunk-1",
      }),
    );
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    expect(await screen.findByText(/could not load/i)).toBeDefined();
  });

  it("leaves a small screen's panel shut until a passage is selected", async () => {
    // Below lg the panel is a full-height sheet: open from first paint it
    // would cover the map on a phone.
    render(withProviders([pointsMock, emptyTopicsMock, statusMock]));
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    expect(screen.queryByText(/what is on the map/i)).toBeNull();
  });

  it("docks the panel from the start on a large screen", async () => {
    viewport.large = true;
    render(withProviders([pointsMock, emptyTopicsMock, statusMock]));
    await waitFor(() =>
      expect(
        screen.getByRole("complementary", { name: /what is on the map/i }),
      ).toBeDefined(),
    );
  });

  it("renders a relation whose target is not on the map, without pointing at it", async () => {
    // The relations query does not filter to passages that have a position,
    // and the cloud is capped anyway: chunk-404 is a real relation that simply
    // has no dot.
    render(
      withProviders([pointsMock, emptyTopicsMock, statusMock, edgesMock], {
        selected: "chunk-1",
      }),
    );
    expect(
      await screen.findByRole("button", { name: /the text of chunk-2/i }),
    ).toBeDefined();
    expect(await screen.findByText(/not on the map/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /chunk-404/ })).toBeNull();
  });

  it("hands the renderer the same passages and relations when only the hover changes", async () => {
    // The renderer rebuilds its buffers when these change identity, and this
    // card re-renders on every pointer move over the neighbour list.
    render(
      withProviders([pointsMock, emptyTopicsMock, statusMock, edgesMock], {
        selected: "chunk-1",
      }),
    );
    const neighbour = await screen.findByRole("button", {
      name: /the text of chunk-2/i,
    });
    const before = canvas.renders.at(-1)!;
    fireEvent.mouseEnter(neighbour);
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.hoverNeighbourId).toBe("chunk-2"),
    );
    const after = canvas.renders.at(-1)!;
    expect(after.points).toBe(before.points);
    expect(after.edges).toBe(before.edges);
    expect(after.topics).toBe(before.topics);
    expect(after.topicMemberIds).toBe(before.topicMemberIds);
    expect(after.ringedIds).toBe(before.ringedIds);
  });

  it("hands the renderer the same empty answers when a control is toggled", async () => {
    // The emptiness itself is the trap: `data?.x ?? []` is a new array on
    // every render, and this base has neither topics nor a selection.
    render(withProviders([pointsMock, emptyTopicsMock, statusMock]));
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    const before = canvas.renders.at(-1)!;
    fireEvent.click(screen.getByRole("button", { name: /pause/i }));
    await waitFor(() => expect(canvas.renders.at(-1)!.paused).toBe(true));
    const after = canvas.renders.at(-1)!;
    expect(after.topics).toBe(before.topics);
    expect(after.edges).toBe(before.edges);
    expect(after.topicMemberIds).toBe(before.topicMemberIds);
    expect(after.ringedIds).toBe(before.ringedIds);
  });

  it("hands the renderer the same groups when the surface re-renders with a new array", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MockedProvider
          addTypename={false}
          link={ApolloLink.from([
            new MockLink([pointsMock, emptyTopicsMock, statusMock], false),
          ])}
        >
          <Harness />
        </MockedProvider>
      </NextIntlClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    const before = canvas.renders.at(-1)!;
    const renders = canvas.renders.length;
    fireEvent.click(screen.getByRole("button", { name: "bump" }));
    await waitFor(() => expect(canvas.renders.length).toBeGreaterThan(renders));
    expect(canvas.renders.at(-1)!.groups).toBe(before.groups);
  });

  it("ties a chip to the region parameter, its members and one stable set", async () => {
    // The whole chip path in one go: the parameter resolves to a region, the
    // region resolves to its nearest-centre members, that set is what the
    // renderer dims against, and it survives an unrelated re-render.
    //
    // On a large screen, because below lg the panel is a modal sheet and Radix
    // marks the rest of the document aria-hidden while it is open — the chips
    // are then genuinely unreachable, which is the sheet's business and not
    // this test's subject.
    viewport.large = true;
    render(
      withProviders(
        [placedPointsMock, topicsMock, statusMock, placedEdgesMock],
        { selected: "a", topic: "1" },
      ),
    );
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.topicMemberIds).toEqual(new Set(["c"])),
    );
    const before = canvas.renders.at(-1)!;

    const neighbour = await screen.findByRole("button", {
      name: /the text of b/i,
    });
    fireEvent.mouseEnter(neighbour);
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.hoverNeighbourId).toBe("b"),
    );
    const after = canvas.renders.at(-1)!;
    expect(after.topicMemberIds).toBe(before.topicMemberIds);
    // The renderer reads these through a ref today; that is its choice, not a
    // licence for this card to hand it a new function sixty times a second.
    expect(after.onSelect).toBe(before.onSelect);
    expect(after.onUnsupported).toBe(before.onUnsupported);

    fireEvent.click(screen.getByRole("button", { name: /valves/i }));
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.highlightTopic).toBe("0"),
    );
    // Mirrored, never navigated: this page is dynamic, so a router write costs
    // a server round-trip before the chip lights up, and if the route's loading
    // state swaps in the canvas unmounts — camera reset, context recreated,
    // cloud refetched.
    expect(nav.replace).not.toHaveBeenCalled();
    const mirrored = new URLSearchParams(window.location.search);
    expect(mirrored.get("topic")).toBe("0");
    expect(mirrored.get("selected")).toBe("a");
  });

  it("selects a passage without navigating, keeping the page's own parameters", async () => {
    // The memory base page drives its tabs from ?tab=, so the mirror has to
    // leave every parameter it does not own alone.
    window.history.replaceState(null, "", "/memory/base-1?tab=overview");
    render(
      withProviders([pointsMock, emptyTopicsMock, statusMock, edgesMock], {
        selected: "chunk-1",
      }),
    );
    const neighbour = await screen.findByRole("button", {
      name: /the text of chunk-2/i,
    });
    fireEvent.click(neighbour);
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.selectedId).toBe("chunk-2"),
    );
    expect(nav.replace).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/memory/base-1");
    const mirrored = new URLSearchParams(window.location.search);
    expect(mirrored.get("selected")).toBe("chunk-2");
    expect(mirrored.get("tab")).toBe("overview");
  });

  it("restores the selection a shared link names", async () => {
    render(
      withProviders([pointsMock, emptyTopicsMock, statusMock, edgesMock], {
        selected: "chunk-1",
      }),
    );
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.selectedId).toBe("chunk-1"),
    );
    // And the panel really is showing that passage, not just the renderer prop.
    expect(await screen.findByText(/the text of chunk-1/i)).toBeDefined();
    expect(new URLSearchParams(window.location.search).get("selected")).toBe(
      "chunk-1",
    );
  });

  it("drops the selection from the URL when the panel is closed", async () => {
    viewport.large = true;
    render(
      withProviders([pointsMock, emptyTopicsMock, statusMock, edgesMock], {
        selected: "chunk-1",
      }),
    );
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.selectedId).toBe("chunk-1"),
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    await waitFor(() => expect(canvas.renders.at(-1)!.selectedId).toBeNull());
    expect(nav.replace).not.toHaveBeenCalled();
    expect(new URLSearchParams(window.location.search).has("selected")).toBe(
      false,
    );
  });

  it("dims nothing while the region parameter names no region it loaded", async () => {
    // A refit renumbers regions, so a shared ?topic= can name one that is
    // gone — and the regions arrive from their own query, so for a moment
    // every parameter names nothing. Either way the cloud must not go dim
    // with no chip to explain it.
    render(
      withProviders([placedPointsMock, topicsMock, statusMock], {
        topic: "99",
      }),
    );
    await waitFor(() => expect(canvas.renders.at(-1)!.topics).toHaveLength(2));
    expect(canvas.renders.at(-1)!.highlightTopic).toBeNull();
    expect(canvas.renders.at(-1)!.topicMemberIds).toEqual(new Set());
  });

  it("does not call an unfitted base unreadable when the status query failed", async () => {
    // Without the status there is no telling whether the base was never
    // mapped or whether this viewer may read none of it.
    render(withProviders([emptyPointsMock, emptyTopicsMock, statusErrorMock]));
    await waitFor(() =>
      expect(screen.getByText(/could not tell/i)).toBeDefined(),
    );
    expect(screen.queryByText(/available to you/i)).toBeNull();
    expect(screen.queryByTestId("canvas")).toBeNull();
  });

  it("turns conflicted items into the passages it rings, and one stable set", async () => {
    // The whole ring path. The surfaces above know which ITEMS are in a
    // conflict group — that is the id their conflicts data carries — and only
    // this card holds the points answer, which records both ids per passage.
    // So the translation has to happen here, it must survive an unrelated
    // re-render, and the legend must not announce an entry the cloud does not
    // actually carry.
    render(
      withProviders([pointsMock, emptyTopicsMock, statusMock], {
        ringedItemIds: new Set(["item-chunk-1"]),
      }),
    );
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.ringedIds).toEqual(new Set(["chunk-1"])),
    );
    expect(screen.getByText(/in a conflict/i)).toBeDefined();

    const before = canvas.renders.at(-1)!;
    fireEvent.click(screen.getByRole("button", { name: /pause/i }));
    await waitFor(() => expect(canvas.renders.at(-1)!.paused).toBe(true));
    expect(canvas.renders.at(-1)!.ringedIds).toBe(before.ringedIds);

    // A conflicted item this viewer may not read, or one with no position
    // yet: it is simply not among the points.
    cleanup();
    canvas.renders.length = 0;
    render(
      withProviders([pointsMock, emptyTopicsMock, statusMock], {
        ringedItemIds: new Set(["item-not-mine"]),
      }),
    );
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    expect(canvas.renders.at(-1)!.ringedIds).toEqual(new Set());
    expect(screen.queryByText(/in a conflict/i)).toBeNull();
  });

  it("asks for edges only once a passage is selected", async () => {
    render(withProviders([pointsMock, emptyTopicsMock, statusMock]));
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    expect(asked).toContain("ContextMapPoints");
    expect(asked).not.toContain("ContextMapEdges");
  });
});
