// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserContext } from "@/app/(application)/authenticated";
import { COLLAPSED_STORAGE_KEY, type Folder } from "@/lib/knowledge/folders";
import enMessages from "@/messages/en.json";

/**
 * The folder sections the Knowledge list grows once an admin has created
 * folders: one header per folder with its count, a chevron that collapses the
 * section, the flat list search falls back to, and the two affordances only a
 * super admin gets. The data layer is mocked (this is the grouping and the
 * gating, not Apollo) and the favourites card is a marker — its hooks need a
 * client, and it has nothing to do with the sections.
 */

const data = vi.hoisted(() => ({
  rows: [
    { id: "c1", name: "Tender documents" },
    { id: "c2", name: "Pricing sheets" },
    { id: "c3", name: "Product manuals" },
  ],
  folders: [] as Folder[],
  moveContext: vi.fn(),
}));

vi.mock("../hooks", () => ({
  useContextLibrary: () => ({
    rows: data.rows,
    loading: false,
    error: undefined,
  }),
  useContextIcons: () => ({
    icons: {},
    loading: false,
    saving: false,
    setIcon: vi.fn(),
  }),
  useContextFolders: () => ({
    folders: data.folders,
    loading: false,
    error: undefined,
    refetch: vi.fn(),
    createFolder: vi.fn(),
    updateFolder: vi.fn(),
    deleteFolder: vi.fn(),
    moveContext: data.moveContext,
  }),
}));

vi.mock("./context-item-favourites", () => ({
  ContextItemFavourites: () => <div data-testid="favourites" />,
}));

// Imported after the mocks (vi.mock is hoisted) so the page picks them up.
import { ContextLibrary } from "./context-library";

const FOLDERS: Folder[] = [
  {
    id: "f1",
    name: "Tenders",
    description: "Everything we bid on",
    icon: "books",
    sort_order: 1,
    context_ids: ["c1", "c2"],
  },
  {
    id: "f2",
    name: "Products",
    description: null,
    icon: null,
    sort_order: 2,
    context_ids: ["c3"],
  },
];

function renderLibrary(user: { super_admin: boolean } = { super_admin: true }) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <UserContext.Provider value={{ user }}>
        <ContextLibrary />
      </UserContext.Provider>
    </NextIntlClientProvider>,
  );
}

describe("Knowledge folder sections", () => {
  beforeEach(() => {
    data.folders = FOLDERS;
    data.moveContext.mockReset();
    window.localStorage.clear();
  });

  afterEach(cleanup);

  it("renders one header per folder, with the folder's context count", () => {
    renderLibrary();

    expect(screen.getByRole("heading", { name: "Tenders" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Products" })).toBeTruthy();
    expect(screen.getByText("2 contexts")).toBeTruthy();
    expect(screen.getByText("1 context")).toBeTruthy();

    // Every context is in a folder, so there is no Ungrouped section.
    expect(screen.queryByRole("heading", { name: "Ungrouped" })).toBeNull();
    // The container (and its demo id) is unchanged.
    expect(
      document.querySelector('[data-demo-id="knowledge-contexts"]'),
    ).toBeTruthy();
  });

  it("collapses a section's rows behind its chevron, and leaves the others alone", () => {
    renderLibrary();

    const collapse = screen.getByRole("button", { name: "Collapse Tenders" });
    expect(collapse.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(collapse);

    expect(screen.queryByText("Tender documents")).toBeNull();
    expect(screen.queryByText("Pricing sheets")).toBeNull();
    const expand = screen.getByRole("button", { name: "Expand Tenders" });
    expect(expand.getAttribute("aria-expanded")).toBe("false");

    // Only the clicked section collapsed; its header (and count) stays.
    expect(screen.getByText("2 contexts")).toBeTruthy();
    expect(screen.getByText("Product manuals")).toBeTruthy();

    fireEvent.click(expand);
    expect(screen.getByText("Tender documents")).toBeTruthy();
  });

  it("remembers a collapsed section in this browser", () => {
    const first = renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Collapse Tenders" }));

    expect(
      JSON.parse(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) ?? "[]"),
    ).toEqual(["f1"]);

    // A fresh mount (a reload, as far as the page is concerned) reads it back.
    first.unmount();
    renderLibrary();

    expect(
      screen
        .getByRole("button", { name: "Expand Tenders" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(screen.queryByText("Tender documents")).toBeNull();
    expect(screen.getByText("Product manuals")).toBeTruthy();
  });

  it("falls back to the flat list while a search term is set", async () => {
    renderLibrary();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "manuals" },
    });

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Tenders" })).toBeNull();
    });
    expect(screen.queryByRole("heading", { name: "Products" })).toBeNull();
    expect(screen.queryByText("2 contexts")).toBeNull();
    // The rows the (mocked) search returned still render, ungrouped.
    expect(screen.getByText("Product manuals")).toBeTruthy();
  });

  it("renders the flat list when no folders exist", () => {
    data.folders = [];
    renderLibrary();

    expect(screen.queryByRole("heading", { name: "Ungrouped" })).toBeNull();
    expect(screen.getByText("Tender documents")).toBeTruthy();
  });

  it("gives super admins the manage button and a move menu per row", () => {
    renderLibrary({ super_admin: true });

    expect(screen.getByRole("button", { name: "Manage folders" })).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /to a folder$/ }),
    ).toHaveLength(3);
  });

  it("shows everyone else the grouping read-only", () => {
    renderLibrary({ super_admin: false });

    expect(screen.getByRole("heading", { name: "Tenders" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Manage folders" })).toBeNull();
    expect(
      screen.queryAllByRole("button", { name: /to a folder$/ }),
    ).toHaveLength(0);
  });
});
