// @vitest-environment jsdom
import { ApolloLink, InMemoryCache } from "@apollo/client";
import {
  MockedProvider,
  MockLink,
  type MockedResponse,
} from "@apollo/client/testing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { print } from "graphql";
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  GET_CONTEXT_MAP_EDGES,
  GET_CONTEXT_MAP_ITEM,
  GET_CONTEXT_MAP_POINTS,
  GET_CONTEXT_MAP_TOPICS,
  GET_CONTEXT_PROJECTION_STATUS,
} from "@/lib/graphql/operations/context-map";
import enMessages from "@/messages/en.json";

import { PALETTE_TOKENS } from "./map-data";

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
  // Radix's slider observes its own size, and jsdom 26 has no ResizeObserver.
  // The map canvas is mocked here, so nothing else in this tree needs one and
  // a no-op is enough: the slider still responds to keyboard events, which is
  // how these tests drive it.
  if (!("ResizeObserver" in window)) {
    Object.defineProperty(window, "ResizeObserver", {
      writable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
  }
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
  document.documentElement.removeAttribute("data-theme");
  asked.length = 0;
  askedWith.length = 0;
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
  // What a reader calls the document this passage came from. The passage's
  // own opening is no longer requested at all: it was the injected document
  // header on a real base, and once nothing rendered it, it was 2.4 MB of
  // payload at the cap serving nobody.
  itemName: `the item of ${id}`,
  group: "fact",
  chunks: 1,
  createdAtMs: null,
});

/** A passage on the x axis, so which region is nearest is arithmetic. */
const placed = (id: string, x: number) => ({ ...passage(id), x, y: 0, z: 0 });

const pointsRequest = {
  query: GET_CONTEXT_MAP_POINTS,
  variables: {
    contextId: CONTEXT,
    mode: "PASSAGES",
    groupField: null,
    // The API's default, not its cap. An unmatched request is a network error
    // MockLink swallows, so a card that asked for anything else would show no
    // cloud at all and every test below would say so.
    limit: 5000,
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

const pointsErrorMock = {
  request: pointsRequest,
  error: new Error("the points query is down"),
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

/**
 * Two passages of one document and one of another, all nearest the region at
 * x = 0. The shared itemId is the point of the fixture: a region panel that
 * lists passages instead of items shows three rows here, not two.
 */
const sharedItemPointsMock = {
  request: pointsRequest,
  result: {
    data: {
      contextMapPoints: {
        points: [
          { ...placed("p1", 1), itemId: "item-manual", itemName: "Manual" },
          { ...placed("p2", 2), itemId: "item-manual", itemName: "Manual" },
          { ...placed("p3", 0), itemId: "item-datasheet", itemName: "Datasheet" },
        ],
        total: 3,
        sampled: false,
      },
    },
  },
};

const DAY = 86_400_000;
const AUG14 = Date.UTC(2026, 7, 14, 9, 0);

/** Three memories a fortnight apart, so the filter has a span to work on. */
const datedPointsMock = {
  request: pointsRequest,
  result: {
    data: {
      contextMapPoints: {
        points: [
          { ...placed("old", 0), createdAtMs: AUG14 },
          { ...placed("mid", 1), createdAtMs: AUG14 + 14 * DAY },
          { ...placed("new", 2), createdAtMs: AUG14 + 28 * DAY },
        ],
        total: 3,
        sampled: false,
      },
    },
  },
};

/** The shape every knowledge base here actually has: one ingestion batch. */
const sameDayPointsMock = {
  request: pointsRequest,
  result: {
    data: {
      contextMapPoints: {
        points: [
          { ...placed("a", 0), createdAtMs: AUG14 },
          { ...placed("b", 1), createdAtMs: AUG14 + 3600_000 },
        ],
        total: 2,
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

/**
 * Three regions, arranged so that the chip row's own render order cannot be
 * mistaken for the palette index.
 *
 * They are deliberately NOT in count order: a row sorted by count would
 * render Pricing first and hand it the first palette entry, while the
 * renderer would still colour its dots with the third — and `topicsMock`,
 * already count-descending, could not tell the two apart.
 *
 * And the first of the three holds nothing, which is the plausible reason to
 * *filter* a chip row. Dropping it renumbers every chip after it, so a swatch
 * read from a render position would recolour two regions that the renderer
 * still colours by their position in this array.
 */
const unsortedTopicsMock = {
  request: { query: GET_CONTEXT_MAP_TOPICS, variables: { contextId: CONTEXT } },
  result: {
    data: {
      contextMapTopics: [
        { id: "2", label: "Fittings", count: 0, x: 100, y: 0, z: 0 },
        { id: "0", label: "Valves & Blocks", count: 1, x: 0, y: 0, z: 0 },
        { id: "1", label: "Pricing", count: 9, x: 10, y: 0, z: 0 },
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

/**
 * The selected point's item. Its `chunks` is deliberately NOT 1: a passage
 * point carries chunks: 1, so a panel reading the count off the point instead
 * of off this answer shows 1 and fails the assertion.
 */
const itemMock = {
  request: {
    query: GET_CONTEXT_MAP_ITEM,
    variables: { contextId: CONTEXT, itemId: "item-chunk-1" },
  },
  result: {
    data: {
      contextMapItem: {
        id: "item-chunk-1",
        name: "the item of chunk-1",
        chunks: 42,
        textLength: 81233,
        source: "upload",
        createdAt: "2026-07-20T08:00:00.000Z",
        updatedAt: "2026-09-04T16:20:00.000Z",
      },
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
 * Three passages of one document plus the seed, which is what any chunked file
 * looks like on this map: four dots, one item, one name.
 */
const SHARED_ITEM = "Price list 2026";
const chunkedPointsMock = {
  request: pointsRequest,
  result: {
    data: {
      contextMapPoints: {
        points: [
          passage("chunk-1"),
          ...["chunk-2", "chunk-3", "chunk-4"].map((id) => ({
            ...passage(id),
            itemId: "item-shared",
            itemName: SHARED_ITEM,
          })),
        ],
        total: 4,
        sampled: false,
      },
    },
  },
};

/** Its three passages as neighbours, strongest in the middle of the answer. */
const chunkedEdgesMock = {
  request: edgesRequest("chunk-1"),
  result: {
    data: {
      contextMapEdges: [
        { source: "chunk-1", target: "chunk-2", score: 0.4 },
        { source: "chunk-1", target: "chunk-3", score: 0.9 },
        { source: "chunk-1", target: "chunk-4", score: 0.2 },
      ],
    },
  },
};

/**
 * Every operation the card actually sent, by name. A mock that simply goes
 * unused proves nothing — an unmatched request is swallowed by MockLink as a
 * network error, so a spy on a mock's result would stay silent even when the
 * query was issued.
 */
const asked: string[] = [];
/** The same operations with their variables, so a test can name a value. */
const askedWith: { name: string; variables: Record<string, unknown> }[] = [];

function withProviders(
  mocks: MockedResponse[],
  params: {
    selected?: string;
    topic?: string;
    /** Items in a conflict group, as the surfaces above actually know them. */
    ringedItemIds?: Set<string>;
    /** A pre-populated cache, for the one test that needs an answer already in hand. */
    cache?: InMemoryCache;
    /** Offer the time filter, as the memory page does. */
    timeline?: boolean;
  } = {},
) {
  // Selecting a point issues ContextMapItem. Without a mock, MockLink errors
  // that observable and warns on every one of the ~18 selection tests that do
  // not care about metadata - noise that would hide a real missing mock. Tests
  // that DO care pass their own, which matches first.
  const all =
    params.selected === undefined ||
    mocks.some((m) => (m.request.query as unknown) === GET_CONTEXT_MAP_ITEM)
      ? mocks
      : [...mocks, itemMock];

  const search = new URLSearchParams();
  if (params.selected !== undefined) search.set("selected", params.selected);
  if (params.topic !== undefined) search.set("topic", params.topic);
  nav.search = search.toString();
  const recorder = new ApolloLink((operation, forward) => {
    asked.push(operation.operationName);
    askedWith.push({
      name: operation.operationName,
      variables: operation.variables,
    });
    return forward(operation);
  });
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <MockedProvider
        addTypename={false}
        cache={params.cache}
        link={ApolloLink.from([recorder, new MockLink(all, false)])}
      >
        <ContextMapCard
          contextId={CONTEXT}
          groupField={null}
          ringedItemIds={params.ringedItemIds}
          itemHref={(itemId) => `/memory/${CONTEXT}/${itemId}`}
          titleKey="memory"
          timeline={params.timeline}
        />
      </MockedProvider>
    </NextIntlClientProvider>
  );
}

/** Re-renders the card from a surface above it, props unchanged. */
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
    expect(screen.queryByRole("group", { name: /regions/i })).toBeNull();
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

  it("leaves a small screen's sheet shut until a passage is selected", async () => {
    // Below lg the panel is a full-height sheet: open from first paint it
    // would cover the map on a phone.
    render(withProviders([pointsMock, emptyTopicsMock, statusMock]));
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    expect(screen.queryByRole("dialog")).toBeNull();

    // The other half, so the assertion above cannot pass on a sheet that
    // never opens at all.
    cleanup();
    canvas.renders.length = 0;
    render(
      withProviders([pointsMock, emptyTopicsMock, statusMock, edgesMock], {
        selected: "chunk-1",
      }),
    );
    expect(await screen.findByRole("dialog")).toBeDefined();
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
      await screen.findByRole("button", { name: /the item of chunk-2/i }),
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
      name: /the item of chunk-2/i,
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

  it("colours every dot by the region nearest it", async () => {
    // The resolver is the whole of the colour wiring: a point's own grouping
    // value ("fact" for all three) says nothing about its region, so this is
    // the only thing that can separate a and b from c.
    render(withProviders([placedPointsMock, topicsMock, statusMock]));
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    const regionOf = canvas.renders.at(-1)!.regionOf as (
      point: { x: number; y: number; z: number },
    ) => number;
    expect(regionOf(placed("a", 1))).toBe(0);
    expect(regionOf(placed("b", 4))).toBe(0);
    expect(regionOf(placed("c", 9))).toBe(1);
  });

  it("answers -1 for every dot when the base has no regions to colour by", async () => {
    // Nothing to colour by means the palette's reserved grey, which only -1
    // asks for: an index of 0 would paint the blob one real colour instead.
    render(withProviders([pointsMock, emptyTopicsMock, statusMock]));
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    const regionOf = canvas.renders.at(-1)!.regionOf as (
      point: { x: number; y: number; z: number },
    ) => number;
    expect(regionOf(passage("chunk-1"))).toBe(-1);
  });

  it("hands the renderer the same region resolver when the surface re-renders with a new array", async () => {
    // The resolver colours every dot, and the renderer rebuilds and re-uploads
    // its whole colour buffer when this identity changes — a fresh arrow per
    // render would do that on every pointer move.
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
    // Without this the assertion below would hold on two undefineds, which is
    // how a prop that quietly stopped being passed goes unnoticed.
    expect(typeof before.regionOf).toBe("function");
    const renders = canvas.renders.length;
    fireEvent.click(screen.getByRole("button", { name: "bump" }));
    await waitFor(() => expect(canvas.renders.length).toBeGreaterThan(renders));
    expect(canvas.renders.at(-1)!.regionOf).toBe(before.regionOf);
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
      name: /the item of b/i,
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
      name: /the item of chunk-2/i,
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
    // And the panel really is showing that passage's item, not just the
    // renderer prop.
    expect(
      await screen.findByRole("heading", { name: "the item of chunk-1" }),
    ).toBeDefined();
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

  it("opens the panel on a region's unique items when a chip is chosen", async () => {
    viewport.large = true;
    render(withProviders([sharedItemPointsMock, topicsMock, statusMock]));
    const chip = await screen.findByRole("button", { name: /valves/i });
    fireEvent.click(chip);

    const panel = await screen.findByRole("complementary", { name: "Region" });
    expect(within(panel).getByRole("heading", { name: "Valves & Blocks" })).toBeDefined();
    // Two rows, not three: the two passages of one document fold into it.
    const rows = within(panel).getAllByRole("link");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("Manual");
    expect(rows[0]!.getAttribute("href")).toBe(`/memory/${CONTEXT}/item-manual`);
    // Most-present first, and the count is passages in THIS region.
    expect(rows[0]!.textContent).toContain("2");
    expect(rows[1]!.textContent).toContain("Datasheet");
    // No item query is issued: a region's items come from the points already
    // drawn, so choosing a chip fetches nothing.
    expect(askedWith.some((o) => o.name === "ContextMapItem")).toBe(false);
  });

  it("closes the region panel and clears the chip when the panel is dismissed", async () => {
    viewport.large = true;
    render(withProviders([sharedItemPointsMock, topicsMock, statusMock]));
    fireEvent.click(await screen.findByRole("button", { name: /valves/i }));
    await screen.findByRole("complementary", { name: "Region" });

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    await waitFor(() =>
      expect(screen.queryByRole("complementary", { name: "Region" })).toBeNull(),
    );
    // The chip is released too, or the cloud would stay dim with a panel that
    // is gone and nothing to explain it.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /valves/i }).getAttribute("aria-pressed"),
      ).toBe("false"),
    );
  });

  describe("the time filter", () => {
    it("names both thumbs and announces dates, not epoch numbers", async () => {
      render(
        withProviders([datedPointsMock, emptyTopicsMock, statusMock], {
          timeline: true,
        }),
      );
      await screen.findByTestId("canvas");
      // Radix names an unlabelled thumb from a hardcoded English
      // ["Minimum", "Maximum"] and announces the raw value, so without the
      // per-thumb props a German reader hears "Minimum, 1786752000000".
      const lower = screen.getByRole("slider", { name: "Earliest" });
      const upper = screen.getByRole("slider", { name: "Latest" });
      for (const thumb of [lower, upper]) {
        const spoken = thumb.getAttribute("aria-valuetext");
        expect(spoken).not.toBeNull();
        expect(spoken).not.toMatch(/^\d+$/);
        expect(spoken).toMatch(/2026/);
      }
    });

    it("is absent on a base that does not offer it", async () => {
      render(withProviders([datedPointsMock, emptyTopicsMock, statusMock]));
      await screen.findByTestId("canvas");
      expect(screen.queryByRole("slider")).toBeNull();
    });

    /**
     * The honest refusal, and the reason this is gated on the data rather than
     * only on the page: measured on a restored production copy, three of four
     * knowledge bases have every item on a single day, and the largest has 65
     * of 67 on one. A slider there would imply a dimension the data lacks.
     */
    it("is absent when every item landed on the same day, even where it is offered", async () => {
      render(
        withProviders([sameDayPointsMock, emptyTopicsMock, statusMock], {
          timeline: true,
        }),
      );
      await screen.findByTestId("canvas");
      expect(screen.queryByRole("slider")).toBeNull();
    });

    it("offers a span once the base covers more than a day", async () => {
      render(
        withProviders([datedPointsMock, emptyTopicsMock, statusMock], {
          timeline: true,
        }),
      );
      await screen.findByTestId("canvas");
      // Two thumbs: a window has two ends.
      expect(screen.getAllByRole("slider")).toHaveLength(2);
      expect(canvas.renders.at(-1)!.timeWindow).toBeNull();
    });

    it("clears the window when the slider is returned to its full span", async () => {
      render(
        withProviders([datedPointsMock, emptyTopicsMock, statusMock], {
          timeline: true,
        }),
      );
      await screen.findByTestId("canvas");
      const [lower] = screen.getAllByRole("slider");
      lower!.focus();
      fireEvent.keyDown(lower!, { key: "ArrowRight" });
      await waitFor(() =>
        expect(canvas.renders.at(-1)!.timeWindow).not.toBeNull(),
      );

      fireEvent.keyDown(lower!, { key: "ArrowLeft" });
      // Null, not a window that happens to span everything: undated points
      // are dropped by any window at all, so they only come back when the
      // filter is released outright.
      await waitFor(() =>
        expect(canvas.renders.at(-1)!.timeWindow).toBeNull(),
      );
    });

    it("hands the renderer a window when the span is narrowed", async () => {
      render(
        withProviders([datedPointsMock, emptyTopicsMock, statusMock], {
          timeline: true,
        }),
      );
      await screen.findByTestId("canvas");
      const [lower] = screen.getAllByRole("slider");
      // Radix sliders move on keyboard, which jsdom can drive; a pointer drag
      // needs layout it has not got.
      lower!.focus();
      fireEvent.keyDown(lower!, { key: "ArrowRight" });

      await waitFor(() => {
        const window = canvas.renders.at(-1)!.timeWindow as {
          from: number;
          to: number;
        } | null;
        expect(window).not.toBeNull();
        // Moved off the earliest day, so the oldest memory is now outside it.
        expect(window!.from).toBeGreaterThan(AUG14 - DAY);
      });
    });
  });

  it("shows one row of chips carrying their region's colour, and no separate legend", async () => {
    render(withProviders([pointsMock, topicsMock, statusMock]));
    const chips = await screen.findAllByRole("button", { name: /valves/i });
    expect(chips).toHaveLength(1);
    // The chip row IS the legend: every swatch on screen sits inside a chip,
    // so a second row naming the same colours fails this.
    const swatches = screen
      .getByTestId("context-map-card")
      .querySelectorAll("[data-region-swatch]");
    expect(swatches).toHaveLength(2);
    for (const swatch of swatches) {
      expect(swatch.closest("button")).not.toBeNull();
    }
    expect(screen.getByRole("group", { name: /regions/i })).toBeDefined();
  });

  it("paints a chip's swatch from the palette entry its region's dots take", async () => {
    render(withProviders([placedPointsMock, unsortedTopicsMock, statusMock]));
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    const root = screen.getByTestId("context-map-card");
    // jsdom resolves a custom property only on the element that declares it —
    // a browser inherits these from `:root` — so the card's own host carries
    // them here. The palette's first three entries are --chart-4, --chart-1
    // and --chart-8.
    root.style.setProperty(PALETTE_TOKENS[0], "217 76% 54%");
    root.style.setProperty(PALETTE_TOKENS[1], "0 0% 0%");
    root.style.setProperty(PALETTE_TOKENS[2], "120 100% 50%");
    // The card re-reads the theme exactly as the renderer does.
    document.documentElement.setAttribute("data-theme", "dark");

    const swatchOf = (name: RegExp) =>
      screen
        .getByRole("button", { name })
        .querySelector("[data-region-swatch]") as HTMLElement | null;
    // Resolved through the same parse as the dots rather than left as a raw
    // token: an unparseable token greys a dot, while `hsl(var(--chart-4))` on
    // a swatch paints nothing at all, so the two would disagree exactly where
    // nobody would look.
    // Each region keeps the palette entry its OWN position in the regions
    // array names — not the one its place in this row would name, and not the
    // one its count would. These two are asserted first on purpose: they are
    // the chips that survive a filtered row, so a row that dropped the empty
    // region and renumbered the rest fails here, on the colour, rather than
    // on the chip that went missing.
    await waitFor(() =>
      expect(swatchOf(/valves/i)?.style.backgroundColor).toBe("rgb(0, 0, 0)"),
    );
    expect(swatchOf(/pricing/i)?.style.backgroundColor).toBe("rgb(0, 255, 0)");
    expect(swatchOf(/fittings/i)?.style.backgroundColor).toBe(
      "rgb(49, 117, 227)",
    );
    // And that is the position the renderer colours by, so a chip and its
    // dots cannot drift apart.
    const regionOf = canvas.renders.at(-1)!.regionOf as (point: {
      x: number;
      y: number;
      z: number;
    }) => number;
    expect(swatchOf(/valves/i)?.dataset.regionSwatch).toBe(
      String(regionOf(placed("a", 1))),
    );
    expect(swatchOf(/pricing/i)?.dataset.regionSwatch).toBe(
      String(regionOf(placed("c", 9))),
    );
  });

  it("keeps the docked panel shut until a passage is selected", async () => {
    viewport.large = true;
    render(withProviders([pointsMock, topicsMock, statusMock]));
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    // With nothing selected it has nothing to say.
    expect(screen.queryByRole("complementary")).toBeNull();

    // The other half, so the assertion above cannot pass on a panel that
    // never opens at all.
    cleanup();
    canvas.renders.length = 0;
    render(
      withProviders([pointsMock, topicsMock, statusMock, edgesMock], {
        selected: "chunk-1",
      }),
    );
    expect(await screen.findByRole("complementary")).toBeDefined();
  });

  it("hides the links control until a passage is selected", async () => {
    viewport.large = true;
    render(withProviders([pointsMock, topicsMock, statusMock]));
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    expect(screen.queryByRole("tab", { name: /links/i })).toBeNull();
    // Pause and reset are not in that class: both do something the moment the
    // cloud is drawn, so they stay — in the canvas corner, not the header.
    expect(screen.getByRole("button", { name: /pause/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /reset/i })).toBeDefined();

    cleanup();
    canvas.renders.length = 0;
    render(
      withProviders([pointsMock, topicsMock, statusMock, edgesMock], {
        selected: "chunk-1",
      }),
    );
    expect(await screen.findByRole("tab", { name: /links/i })).toBeDefined();
  });

  it("stops drawing the whole-cloud web when the control that governs it goes", async () => {
    // "All links" draws a web over every passage, and it outlives the
    // selection — but its control does not, so with the control hidden
    // nothing on screen could turn the web off again.
    viewport.large = true;
    render(
      withProviders([pointsMock, topicsMock, statusMock, edgesMock], {
        selected: "chunk-1",
      }),
    );
    // Radix activates a tab on mousedown, never on click.
    fireEvent.mouseDown(
      await screen.findByRole("tab", { name: /all links/i }),
      { button: 0 },
    );
    await waitFor(() => expect(canvas.renders.at(-1)!.allLinks).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    await waitFor(() => expect(canvas.renders.at(-1)!.selectedId).toBeNull());
    expect(canvas.renders.at(-1)!.allLinks).toBe(false);
  });

  it("states once what a dot is and what a count counts", async () => {
    render(withProviders([pointsMock, topicsMock, statusMock]));
    // One line, not two, and it names the dot, the count, and the items the
    // count includes but the cloud never draws.
    const explained = await screen.findAllByText(/each dot is one passage/i);
    expect(explained).toHaveLength(1);
    expect(screen.queryAllByText(/counted but never shown/i)).toHaveLength(1);
  });

  it("takes the cloud off screen when the points query fails on a cached answer", async () => {
    // The links control and the web it governs read one value, `drawn`, and
    // that is only safe while a cloud which is not `drawn` cannot be on
    // screen. This is the state where it might not have been: `drawn` is
    // false because the query failed, while the points are still in hand from
    // the cache. ChartCard replaces its children with the error pane, so the
    // renderer goes with them — and the day that stops being true, the web
    // could stay on with no control to turn it off, and this fails.
    const cache = new InMemoryCache({ addTypename: false });
    cache.writeQuery({
      query: GET_CONTEXT_MAP_POINTS,
      variables: pointsRequest.variables,
      data: pointsMock.result.data,
    });
    render(
      withProviders([pointsErrorMock, emptyTopicsMock, statusMock], { cache }),
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    // The cloud really was painted first, from the cache — otherwise this
    // would be the ordinary "no points" state and would prove nothing.
    expect(canvas.renders.length).toBeGreaterThan(0);
    expect(screen.queryByTestId("canvas")).toBeNull();
    expect(screen.queryByRole("tab", { name: /links/i })).toBeNull();
  });

  it("asks for the default number of passages, not the cap", async () => {
    // 20,000 rows measured at about 5.8 MB uncompressed when the passage
    // opening was still requested; it no longer is, and the caption already
    // says how many of how many are drawn.
    render(withProviders([pointsMock, emptyTopicsMock, statusMock]));
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    const points = askedWith.find((o) => o.name === "ContextMapPoints");
    expect(points?.variables.limit).toBe(5000);
  });

  it("names the selected point by its item, and shows no passage text at all", async () => {
    // Every "passage opening" on this map begins with an injected document
    // header on the real corpus, so neither a heading nor a body taken from
    // it tells a reader anything. The item's own metadata replaced it.
    viewport.large = true;
    render(
      withProviders([pointsMock, emptyTopicsMock, statusMock, edgesMock, itemMock], {
        selected: "chunk-1",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "the item of chunk-1" }),
    ).toBeDefined();
    // The section is titled Item, which is the panel's own accessible name.
    expect(screen.getByRole("complementary", { name: "Item" })).toBeDefined();
    expect(screen.queryByRole("complementary", { name: /passage/i })).toBeNull();
    expect(screen.queryByText(/matched text/i)).toBeNull();
    // The real guard, and the one the fixture cannot give: the opening is no
    // longer requested at all. Asserting it is not rendered proves nothing
    // once the fixture stops carrying it.
    const asked = askedWith.find((o) => o.name === "ContextMapPoints");
    expect(asked).toBeDefined();
    const selection = print(GET_CONTEXT_MAP_POINTS);
    expect(selection).not.toMatch(/\blabel\b/);
    expect(selection).toMatch(/\bitemName\b/);
  });

  it("shows the selected item's metadata, which the points answer does not carry", async () => {
    viewport.large = true;
    render(
      withProviders([pointsMock, emptyTopicsMock, statusMock, edgesMock, itemMock], {
        selected: "chunk-1",
      }),
    );
    // Scoped to the panel: the caption under the cloud also says "passages".
    const panel = await screen.findByRole("complementary", { name: "Item" });
    // Fails against a panel that never issues the second query, and against
    // one that reads `chunks` off the point - which is 1 for every passage.
    expect(await within(panel).findByText("42")).toBeDefined();
    expect(within(panel).getByText("Passages")).toBeDefined();
    expect(within(panel).getByText("81,233 characters")).toBeDefined();
    const asked = askedWith.find((o) => o.name === "ContextMapItem");
    expect(asked?.variables).toEqual({ contextId: CONTEXT, itemId: "item-chunk-1" });
  });

  /**
   * Found against a restored production copy, not against a fixture: every
   * item on the base this map was built for carries textlength = 0, while
   * another base populates it for 1,263 of 1,299. Zero is "never measured".
   */
  it("omits a metadata row the base never recorded, rather than showing zero", async () => {
    viewport.large = true;
    const unmeasured = {
      request: {
        query: GET_CONTEXT_MAP_ITEM,
        variables: { contextId: CONTEXT, itemId: "item-chunk-1" },
      },
      result: {
        data: {
          contextMapItem: {
            id: "item-chunk-1",
            name: "the item of chunk-1",
            chunks: 7,
            textLength: 0,
            source: null,
            createdAt: null,
            updatedAt: null,
          },
        },
      },
    };
    render(
      withProviders([pointsMock, emptyTopicsMock, statusMock, edgesMock, unmeasured], {
        selected: "chunk-1",
      }),
    );
    const panel = await screen.findByRole("complementary", { name: "Item" });
    // The count it does have is shown...
    expect(await within(panel).findByText("7")).toBeDefined();
    // ...and the ones it does not are absent entirely, not rendered as zero
    // or as an empty row.
    expect(within(panel).queryByText(/characters/i)).toBeNull();
    expect(within(panel).queryByText("Text length")).toBeNull();
    expect(within(panel).queryByText("Source")).toBeNull();
    expect(within(panel).queryByText("Added")).toBeNull();
  });

  it("lists an item once in the neighbours, keeping its strongest passage", async () => {
    // Daniel's screenshot: the same document four times, because those were
    // four chunks of it.
    viewport.large = true;
    render(
      withProviders(
        [chunkedPointsMock, emptyTopicsMock, statusMock, chunkedEdgesMock],
        { selected: "chunk-1" },
      ),
    );
    const rows = await screen.findAllByRole("button", {
      name: new RegExp(SHARED_ITEM, "i"),
    });
    expect(rows).toHaveLength(1);
    // And the one it kept is the strongest of the three, not the first the
    // answer happened to carry.
    fireEvent.mouseEnter(rows[0]!);
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.hoverNeighbourId).toBe("chunk-3"),
    );
  });

  it("dims the other regions while a chip is hovered, choosing nothing", async () => {
    // The same effect selecting a chip has, and none of its consequences: a
    // hover is a look, not a choice.
    viewport.large = true;
    render(withProviders([placedPointsMock, topicsMock, statusMock]));
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    expect(canvas.renders.at(-1)!.highlightTopic).toBeNull();

    const chip = screen.getByRole("button", { name: /pricing/i });
    fireEvent.mouseEnter(chip);
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.highlightTopic).toBe("1"),
    );
    // Dimmed against the region's real members, the same set a selected chip
    // dims against.
    expect(canvas.renders.at(-1)!.topicMemberIds).toEqual(new Set(["c"]));
    // Nothing was chosen: the chip is not pressed, the URL is untouched, and
    // no navigation happened.
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    expect(new URLSearchParams(window.location.search).has("topic")).toBe(false);
    expect(nav.replace).not.toHaveBeenCalled();

    fireEvent.mouseLeave(chip);
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.highlightTopic).toBeNull(),
    );
    // And the keyboard reaches it the same way.
    fireEvent.focus(chip);
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.highlightTopic).toBe("1"),
    );
    fireEvent.blur(chip);
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.highlightTopic).toBeNull(),
    );
  });

  it("leaves a selected chip highlighted while another is hovered and let go", async () => {
    // The hover is a preview over the choice, not a replacement for it: when
    // the pointer leaves, the chosen region is still the one that is dim.
    viewport.large = true;
    render(
      withProviders([placedPointsMock, topicsMock, statusMock], {
        topic: "1",
      }),
    );
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.highlightTopic).toBe("1"),
    );
    const other = screen.getByRole("button", { name: /valves/i });
    fireEvent.mouseEnter(other);
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.highlightTopic).toBe("0"),
    );
    fireEvent.mouseLeave(other);
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.highlightTopic).toBe("1"),
    );
    expect(new URLSearchParams(window.location.search).get("topic")).toBe("1");
  });

  it("clears the hover preview when a click deselects a chip, so the cloud stops dimming", async () => {
    // fireEvent.click does not focus an element the way a real click does,
    // so the chip is focused explicitly first. That is also exactly what
    // lets this bug persist indefinitely from the keyboard: focus never
    // moves away on its own the way a pointer leaving the chip does.
    viewport.large = true;
    render(
      withProviders([placedPointsMock, topicsMock, statusMock], {
        topic: "1",
      }),
    );
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.highlightTopic).toBe("1"),
    );
    // Establish the precondition on a chip that is NOT the selected one:
    // asserting the preview is "1" after focusing the already-selected chip
    // proves nothing, because the render selected "1" to begin with.
    const other = screen.getByRole("button", { name: /valves/i });
    fireEvent.focus(other);
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.highlightTopic).toBe("0"),
    );
    fireEvent.blur(other);
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.highlightTopic).toBe("1"),
    );

    // Focus now demonstrably sets hoverTopic, so the chip below really does
    // carry a hover preview into its own deselecting click.
    const chip = screen.getByRole("button", { name: /pricing/i });
    fireEvent.focus(chip);
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.highlightTopic).toBe("1"),
    );

    fireEvent.click(chip);
    await waitFor(() =>
      expect(chip.getAttribute("aria-pressed")).toBe("false"),
    );
    // The bug: activeTopic = hoverTopic ?? highlightTopic, and onFocus set
    // hoverTopic to this chip above. Without clearing it on a deselecting
    // click, the chip says "not chosen" while activeTopic — and the cloud —
    // stayed this one.
    expect(canvas.renders.at(-1)!.highlightTopic).toBeNull();
    expect(new URLSearchParams(window.location.search).has("topic")).toBe(
      false,
    );

    // Nothing about the hover mechanism itself was lost: re-entering the
    // chip still previews it.
    fireEvent.mouseEnter(chip);
    await waitFor(() =>
      expect(canvas.renders.at(-1)!.highlightTopic).toBe("1"),
    );
  });

  it("asks the API for the item's name, not only the passage's opening", async () => {
    // The name is what every surface showing a point calls it, and the items
    // table is already joined for the access-control gate.
    render(withProviders([pointsMock, emptyTopicsMock, statusMock]));
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    expect(canvas.renders.at(-1)!.points).toEqual([
      expect.objectContaining({ itemName: "the item of chunk-1" }),
      expect.objectContaining({ itemName: "the item of chunk-2" }),
    ]);
  });

  it("asks for edges only once a passage is selected", async () => {
    render(withProviders([pointsMock, emptyTopicsMock, statusMock]));
    await waitFor(() => expect(screen.getByTestId("canvas")).toBeDefined());
    expect(asked).toContain("ContextMapPoints");
    expect(asked).not.toContain("ContextMapEdges");
  });
});
