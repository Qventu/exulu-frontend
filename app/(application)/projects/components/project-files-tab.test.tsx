// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import deMessages from "@/messages/de.json";
import enMessages from "@/messages/en.json";

const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/api/project-files", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/project-files")>()),
  projectFilesApi: { list: api.list },
}));
vi.mock("@/lib/api/session-files", () => ({ sessionFilesApi: {} }));
vi.mock("@/components/artifacts/share-artifact-dialog", () => ({
  ShareArtifactDialog: () => null,
}));
vi.mock("@/components/primitives/relative-time", () => ({
  RelativeTime: () => <span>{"some time ago"}</span>,
}));

import { ProjectFilesAccessError } from "@/lib/api/project-files";

import { ProjectFilesTab } from "./project-files-tab";

const FILE = {
  key: "projects/p1/brief.pdf",
  name: "brief.pdf",
  size: 2048,
  lastModified: "2026-11-16T10:00:00.000Z",
  contentType: "application/pdf",
  presignedUrl: "https://s3/brief.pdf",
  origin: "user",
};

const ui = (messages: object = enMessages, locale = "en") => (
  <NextIntlClientProvider locale={locale} messages={messages}>
    <ProjectFilesTab projectId="p1" projectName="Atlas" />
  </NextIntlClientProvider>
);

beforeEach(() => {
  api.list.mockReset();
});
afterEach(cleanup);

describe("ProjectFilesTab", () => {
  it("shows the list, the note and an upload zone for a writer", async () => {
    api.list.mockResolvedValue({ canWrite: true, files: [FILE] });
    const { container } = render(ui());
    await screen.findByText("brief.pdf");
    expect(
      screen.getByText(enMessages.projects.projectFiles.note, { exact: false }),
    ).toBeTruthy();
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(1);
  });

  it("is read-only without write access: list, no upload zone", async () => {
    api.list.mockResolvedValue({ canWrite: false, files: [FILE] });
    const { container } = render(ui());
    await screen.findByText("brief.pdf");
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(0);
  });

  it("shows skeletons (no list, no upload zone) while the permission loads", async () => {
    api.list.mockReturnValue(new Promise(() => {}));
    const { container } = render(ui());
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(0);
  });

  it("shows the no-access state on a 403/404", async () => {
    api.list.mockRejectedValue(new ProjectFilesAccessError(403));
    render(ui());
    expect(
      await screen.findByText("You don't have access to this project's files."),
    ).toBeTruthy();
  });

  it("falls to the no-access state when a later poll loses access", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      api.list.mockResolvedValueOnce({ canWrite: true, files: [FILE] });
      api.list.mockResolvedValueOnce({ canWrite: true, files: [FILE] });
      api.list.mockRejectedValue(new ProjectFilesAccessError(404));
      render(ui());
      await screen.findByText("brief.pdf");
      await vi.advanceTimersByTimeAsync(5_100);
      await waitFor(() =>
        expect(
          screen.getByText("You don't have access to this project's files."),
        ).toBeTruthy(),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("has German copy under the same keys", () => {
    expect(Object.keys(deMessages.projects.projectFiles)).toEqual(
      Object.keys(enMessages.projects.projectFiles),
    );
    expect(Object.keys(deMessages.projects.knowledge)).toEqual(
      Object.keys(enMessages.projects.knowledge),
    );
    expect(deMessages.projects.tabs.knowledge).toBe("Wissen");
    expect(enMessages.projects.tabs.knowledge).toBe("Knowledge");
    expect(deMessages.chat.files.promoteFailedGeneric).toBeTruthy();
  });
});
