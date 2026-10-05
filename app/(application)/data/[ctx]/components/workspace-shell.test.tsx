// @vitest-environment jsdom
import { MockedProvider } from "@apollo/client/testing";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import type { Context } from "@/types/models/context";

/**
 * The shell's own behaviour: which body a tab mounts, what a switch writes
 * into the URL, and what the map card is handed. Every body is replaced by a
 * marker — each has its own coverage, and mounting them here would drag in
 * their query surfaces (and, for the map, three.js and a WebGL context jsdom
 * has none of).
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
  usePathname: () => "/data/ctx-1",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("./items-tab", () => ({
  ItemsTab: () => <div data-testid="items-tab" />,
}));
vi.mock("./pipeline-tab", () => ({
  PipelineTab: () => <div data-testid="pipeline-tab" />,
}));
vi.mock("../../components/entity-types", () => ({
  ContextEntityTypes: () => <div data-testid="entity-types" />,
}));
vi.mock("./new-item-dialog", () => ({ NewItemDialog: () => null }));
vi.mock("./import/import-wizard-dialog", () => ({
  ImportWizardDialog: () => null,
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
import { WorkspaceShell, type WorkspaceShellProps } from "./workspace-shell";

const CONTEXT = "ctx-1";

const base: Context = {
  id: CONTEXT,
  name: "Product manuals",
  description: "Everything the service team needs",
  active: true,
  slug: "product-manuals",
  configuration: { calculateVectors: "onCreate", defaultRightsMode: "public" },
  processor: {
    name: "default",
    description: "",
    queue: "default",
    trigger: "onCreate",
    timeoutInSeconds: 60,
    generateEmbeddings: true,
  },
  sources: [],
  fields: [
    { name: "title", type: "text", label: "Title" },
    { name: "status", type: "enum", label: "Status", enumValues: ["draft", "live"] },
    { name: "audience", type: "enum", label: "Audience", enumValues: ["staff"] },
  ],
};

const noEnum: Context = {
  ...base,
  fields: [
    { name: "title", type: "text", label: "Title" },
    { name: "body", type: "longText", label: "Body" },
  ],
};

afterEach(() => {
  cleanup();
  nav.search = "";
  nav.replace.mockClear();
  nav.push.mockClear();
  card.renders.length = 0;
});

function withProviders(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {/* `addTypename` is a no-op in Apollo 3.14 and only logs a deprecation. */}
      <MockedProvider mocks={[]}>{ui}</MockedProvider>
    </NextIntlClientProvider>
  );
}

const shell = (
  searchParams: WorkspaceShellProps["searchParams"],
  context: Context = base,
) => withProviders(<WorkspaceShell context={context} searchParams={searchParams} />);

/** Re-renders the shell with identical props, to catch churning callbacks. */
function Harness() {
  const [, bump] = React.useState(0);
  return (
    <>
      <button type="button" onClick={() => bump((n) => n + 1)}>
        {/* A harness label is not product copy. */}
        {"bump"}
      </button>
      <WorkspaceShell context={base} searchParams={{ tab: "map" }} />
    </>
  );
}

/**
 * Radix activates a tab on mousedown (and on focus in automatic mode), never
 * on `click` — a bare fireEvent.click on a trigger is silently inert.
 */
const clickTab = (name: RegExp) =>
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });

describe("WorkspaceShell", () => {
  it("adds a map tab that mounts only when it is active", async () => {
    render(shell({}));
    expect(screen.getByRole("tab", { name: /^map$/i }).getAttribute("data-state")).toBe("inactive");
    expect(screen.queryByTestId("context-map-card")).toBeNull();
    expect(screen.getByTestId("items-tab")).toBeDefined();

    cleanup();
    render(shell({ tab: "map" }));
    expect(screen.getByRole("tab", { name: /^map$/i }).getAttribute("data-state")).toBe("active");
    expect(await screen.findByTestId("context-map-card")).toBeDefined();
    expect(screen.queryByTestId("items-tab")).toBeNull();
  });

  it("colours by the first declared enum field, and by nothing when there is none", async () => {
    render(shell({ tab: "map" }));
    await screen.findByTestId("context-map-card");
    const withEnum = card.renders[card.renders.length - 1];
    // "audience" is an enum too; declaration order decides, not the name.
    expect(withEnum.groups).toEqual(["draft", "live"]);
    expect(withEnum.groupField).toBe("status");

    cleanup();
    card.renders.length = 0;
    render(shell({ tab: "map" }, noEnum));
    await screen.findByTestId("context-map-card");
    const without = card.renders[card.renders.length - 1];
    expect(without.groups).toEqual([]);
    expect(without.groupField).toBeNull();
  });

  it("hands the map the workspace's own item link", async () => {
    render(shell({ tab: "map" }));
    await screen.findByTestId("context-map-card");
    const props = card.renders[card.renders.length - 1];
    expect(props.contextId).toBe(CONTEXT);
    expect(props.titleKey).toBe("knowledge");
    expect((props.itemHref as (id: string) => string)("item-7")).toBe(
      "/data/ctx-1/items/item-7",
    );
  });

  it("drops the item panel and the map's selection and region on a switch", async () => {
    nav.search = "tab=map&selected=chunk-1&topic=2&item=i1&page=3";
    render(shell({ tab: "map", item: "i1", page: "3" }));
    await screen.findByTestId("context-map-card");
    clickTab(/^items$/i);
    // `page` is not this shell's to drop — only the parameters belonging to the
    // tab being left, which now includes the map's two.
    expect(nav.replace).toHaveBeenCalledWith("/data/ctx-1?page=3", {
      scroll: false,
    });
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
