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

import { artifactType } from "@/lib/artifacts/artifact-type";
import enMessages from "@/messages/en.json";

import type { ArtifactListItem } from "./hooks";

/**
 * The page's grouping: starred artifacts as preview cards above the table,
 * in star order; the table keeps every artifact. Data layer and dialogs are
 * mocked — this is the layout rule, not Apollo.
 */

const data = vi.hoisted(() => ({
  items: [] as ArtifactListItem[],
  favorites: [] as string[],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./hooks", () => ({
  useSharedArtifacts: () => ({
    items: data.items,
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useFavoriteArtifacts: () => ({
    favoriteNames: data.favorites,
    isFavorite: (name: string) => data.favorites.includes(name),
    toggle: vi.fn(),
    replaceFavorite: vi.fn(),
    canFavorite: true,
  }),
}));
vi.mock("./components/artifact-preview", () => ({
  ArtifactPreview: ({ item }: { item: ArtifactListItem }) => (
    <div data-testid={`preview-${item.name}`} />
  ),
}));
vi.mock("./components/create-dialog", () => ({
  CreateArtifactDialog: () => null,
}));
vi.mock("./components/rename-dialog", () => ({
  RenameArtifactDialog: () => null,
}));
vi.mock("./components/replace-file-dialog", () => ({
  ReplaceFileDialog: () => null,
}));
vi.mock("./components/sharing-dialog", () => ({ SharingDialog: () => null }));
vi.mock("./components/delete-dialog", () => ({
  DeleteArtifactDialog: () => null,
}));

import { ArtifactsClient } from "./artifacts-client";

const t = enMessages.artifacts;

const item = (name: string, filename: string): ArtifactListItem => ({
  id: name,
  name,
  filename,
  type: artifactType(filename),
  authMode: "regular",
  expiresAt: null,
  expired: false,
  mine: true,
  canManage: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  href: `/artifacts/open/${name}`,
  shareUrl: `/artifacts/${name}`,
});

const precedes = (a: Element, b: Element) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ArtifactsClient />
    </NextIntlClientProvider>,
  );
}

describe("ArtifactsClient favourites", () => {
  beforeEach(() => {
    data.items = [
      item("q3-report", "q3-report.html"),
      item("deck", "deck.pdf"),
      item("logo", "logo.png"),
    ];
    data.favorites = [];
  });
  afterEach(cleanup);

  it("shows starred artifacts as preview cards above the table, in star order", () => {
    data.favorites = ["logo", "q3-report"];
    renderPage();
    const section = screen.getByRole("region", { name: t.filterFavorites });
    const previews = within(section)
      .getAllByTestId(/preview-/)
      .map((el) => el.getAttribute("data-testid"));
    expect(previews).toEqual(["preview-logo", "preview-q3-report"]);
    expect(precedes(section, screen.getByRole("table"))).toBe(true);
    // The table still lists every artifact.
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      4,
    );
    expect(screen.getByRole("heading", { name: t.allArtifacts })).toBeDefined();
  });

  it("renders no section and no heading when nothing is starred", () => {
    renderPage();
    expect(
      screen.queryByRole("region", { name: t.filterFavorites }),
    ).toBeNull();
    expect(screen.queryByRole("heading", { name: t.allArtifacts })).toBeNull();
  });

  it("hides the cards while searching or filtering", () => {
    data.favorites = ["deck"];
    renderPage();
    fireEvent.change(
      screen.getByRole("textbox", { name: t.searchPlaceholder }),
      { target: { value: "deck" } },
    );
    expect(
      screen.queryByRole("region", { name: t.filterFavorites }),
    ).toBeNull();
    fireEvent.change(
      screen.getByRole("textbox", { name: t.searchPlaceholder }),
      { target: { value: "" } },
    );
    expect(
      screen.getByRole("region", { name: t.filterFavorites }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: t.filterMine }));
    expect(
      screen.queryByRole("region", { name: t.filterFavorites }),
    ).toBeNull();
  });
});
