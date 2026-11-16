// @vitest-environment jsdom
/**
 * The project page's tabs: ?tab=files is the shared folder, ?tab=knowledge is
 * the pinned-items curation (the old "files" tab, renamed).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

const nav = vi.hoisted(() => ({ search: "" }));
// Stable identities: the view resyncs state from `project` in an effect.
const stable = vi.hoisted(() => ({
  project: {
    id: "p1",
    name: "Atlas",
    description: "",
    project_items: ["ctx/item1"],
    budget: null,
  },
  refetch: () => {},
  agents: [] as never[],
  sessions: [] as never[],
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/p1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("@apollo/client", async (orig) => ({
  ...(await orig<typeof import("@apollo/client")>()),
  useMutation: () => [vi.fn()],
}));
vi.mock("../hooks", () => ({
  MAX_PROJECT_ITEMS: 15,
  useDeleteProjectCascade: () => vi.fn(),
  useFavoriteProjects: () => ({ favoriteIds: [], toggleFavorite: vi.fn() }),
  useProject: () => ({
    project: stable.project,
    loading: false,
    error: undefined,
    refetch: stable.refetch,
  }),
  useProjectAgents: () => ({
    agents: stable.agents,
    agentName: () => "",
    loading: false,
  }),
  useProjectConfigDownloads: () => ({
    downloadCoworkConfig: vi.fn(),
    downloadClaudeCodeConfig: vi.fn(),
    downloadContinueDevConfig: vi.fn(),
  }),
  useProjectSessions: () => ({
    sessions: stable.sessions,
    loading: false,
    canLoadMore: false,
    loadMore: vi.fn(),
    refetch: vi.fn(),
    totalCount: 0,
  }),
}));
vi.mock("../queries", () => ({ UPDATE_PROJECT: {} }));
vi.mock("./sessions-tab", () => ({ SessionsTab: () => <div>{"sessions-tab"}</div> }));
vi.mock("./settings-tab", () => ({ SettingsTab: () => <div>{"settings-tab"}</div> }));
vi.mock("./new-session-dialog", () => ({ NewSessionDialog: () => null }));
vi.mock("./project-item-card", () => ({
  ProjectItemCard: ({ gid }: { gid: string }) => <div>{`card ${gid}`}</div>,
}));
vi.mock("@/components/items-selection-modal", () => ({
  ItemsSelectionModal: () => null,
}));
vi.mock("@/components/shell/mobile-topbar", () => ({
  MobileTopbarAction: () => null,
}));
vi.mock("@/components/primitives/relative-time", () => ({
  RelativeTime: () => <span>{"some time ago"}</span>,
}));
vi.mock("@/components/artifacts/share-artifact-dialog", () => ({
  ShareArtifactDialog: () => null,
}));
vi.mock("@/lib/api/session-files", () => ({ sessionFilesApi: {} }));
const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/api/project-files", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/project-files")>()),
  projectFilesApi: { list: api.list },
}));

import { ProjectDetailView } from "./project-detail-view";

const view = () => (
  <NextIntlClientProvider locale="en" messages={enMessages}>
    <ProjectDetailView projectId="p1" />
  </NextIntlClientProvider>
);

beforeEach(() => {
  api.list.mockReset().mockResolvedValue({
    canWrite: true,
    files: [
      {
        key: "projects/p1/brief.pdf",
        name: "brief.pdf",
        size: 1,
        lastModified: "2026-11-16T10:00:00.000Z",
        contentType: "application/pdf",
        presignedUrl: "https://s3/brief.pdf",
        origin: "user",
      },
    ],
  });
});
afterEach(cleanup);

describe("ProjectDetailView tabs", () => {
  it("labels the pinned-items tab Knowledge and the folder tab Files", () => {
    nav.search = "";
    render(view());
    expect(screen.getByRole("tab", { name: /^Knowledge/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Files" })).toBeTruthy();
  });

  it("?tab=files renders the shared folder with an upload zone for a writer", async () => {
    nav.search = "tab=files";
    const { container } = render(view());
    await screen.findByText("brief.pdf");
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(1);
    expect(screen.queryByText("card ctx/item1")).toBeNull();
  });

  it("?tab=knowledge renders the existing items curation, not the folder", async () => {
    nav.search = "tab=knowledge";
    render(view());
    expect(await screen.findByText("card ctx/item1")).toBeTruthy();
    expect(screen.getByText("1 / 15 knowledge items")).toBeTruthy();
    expect(screen.queryByText("brief.pdf")).toBeNull();
  });
});
