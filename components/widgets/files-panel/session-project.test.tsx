// @vitest-environment jsdom
/**
 * The chat's files sidebar in a session that belongs to a project: the
 * project's shared files on top, the session's below, "Add to project" on
 * session rows. A session without a project (or whose project the caller may
 * not see) must render exactly today's single-list panel.
 */
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

import enMessages from "@/messages/en.json";
import type { SessionFile } from "@/lib/api/session-files";

const api = vi.hoisted(() => ({
  sessionList: vi.fn(),
  projectList: vi.fn(),
  promote: vi.fn(),
}));
vi.mock("@/lib/api/project-files", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/project-files")>()),
  projectFilesApi: { list: api.projectList, promote: api.promote },
}));
vi.mock("@/lib/api/session-files", () => ({
  sessionFilesApi: { list: api.sessionList },
}));
const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/artifacts/share-artifact-dialog", () => ({
  ShareArtifactDialog: () => null,
}));
vi.mock("@/components/primitives/relative-time", () => ({
  RelativeTime: () => <span>{"some time ago"}</span>,
}));

import { ProjectFilesAccessError } from "@/lib/api/project-files";

import { FilesPanelContent, SessionFilesContent } from "./panel-content";

const file = (name: string, key: string): SessionFile => ({
  key,
  name,
  size: 2048,
  lastModified: "2026-11-16T10:00:00.000Z",
  contentType: "text/markdown",
  presignedUrl: `https://s3/${name}`,
  origin: "user",
});

const SESSION_FILE = file("notes.md", "user_1/s1/notes.md");
const PROJECT_FILE = file("brief.pdf", "projects/p1/brief.pdf");

const wrap = (node: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={enMessages}>
    {node}
  </NextIntlClientProvider>
);

/** useId differs between two mounts; everything else must be identical. */
const normalise = (html: string) =>
  html.replace(/(id|for)="[^"]*"/g, '$1="x"');

const project = (canWrite: boolean) => ({
  id: "p1",
  name: "Atlas",
  canWrite,
});

beforeEach(() => {
  api.sessionList.mockReset().mockResolvedValue({ files: [SESSION_FILE] });
  api.projectList
    .mockReset()
    .mockResolvedValue({ canWrite: true, files: [PROJECT_FILE] });
  api.promote.mockReset();
  toast.error.mockReset();
  toast.success.mockReset();
});

afterEach(cleanup);

describe("SessionFilesContent without a project", () => {
  it("renders today's session panel: one list, the existing privacy note", async () => {
    const { container } = render(wrap(<SessionFilesContent sessionId="s1" />));
    await screen.findByText("notes.md");
    expect(normalise(container.innerHTML)).toMatchSnapshot();
    expect(
      screen.getByText(enMessages.chat.files.privacyNote, { exact: false }),
    ).toBeTruthy();
    expect(screen.queryByText(enMessages.chat.files.sessionSection)).toBeNull();
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(1);
    expect(api.projectList).not.toHaveBeenCalled();
  });

  it("is the same component tree as the session-only FilesPanelContent", async () => {
    const a = render(wrap(<SessionFilesContent sessionId="s1" />));
    await screen.findByText("notes.md");
    const withWrapper = normalise(a.container.innerHTML);
    cleanup();
    const b = render(
      wrap(<FilesPanelContent scope={{ kind: "session", sessionId: "s1" }} />),
    );
    await screen.findByText("notes.md");
    expect(normalise(b.container.innerHTML)).toBe(withWrapper);
  });
});

describe("SessionFilesContent in a project session", () => {
  it("shows the project section above the session section, each with an upload zone for a writer", async () => {
    const { container } = render(
      wrap(<SessionFilesContent sessionId="s1" project={project(true)} />),
    );
    await screen.findByText("brief.pdf");
    await screen.findByText("notes.md");
    const projectHeader = screen.getByText("Project · Atlas");
    const sessionHeader = screen.getByText("This session");
    expect(
      projectHeader.compareDocumentPosition(sessionHeader) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByText("Visible to everyone with access to this project.", {
        exact: false,
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(enMessages.chat.files.privacyNote, { exact: false }),
    ).toBeTruthy();
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: "Add to project" }),
    ).toHaveLength(1);
  });

  it("gives a reader one upload zone (the session's) and no Add to project", async () => {
    api.projectList.mockResolvedValue({ canWrite: false, files: [PROJECT_FILE] });
    const { container } = render(
      wrap(<SessionFilesContent sessionId="s1" project={project(false)} />),
    );
    await screen.findByText("brief.pdf");
    await screen.findByText("notes.md");
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Add to project" })).toBeNull();
  });

  it("Add to project promotes that file and confirms with a toast", async () => {
    api.promote.mockResolvedValue({
      promoted: [{ key: "projects/p1/notes.md", name: "notes.md" }],
      rejected: [],
      clashes: [],
    });
    render(wrap(<SessionFilesContent sessionId="s1" project={project(true)} />));
    fireEvent.click(await screen.findByRole("button", { name: "Add to project" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Added to project"));
    expect(api.promote).toHaveBeenCalledWith("p1", {
      sessionId: "s1",
      keys: ["user_1/s1/notes.md"],
    });
  });

  it("a clash asks before replacing and the second call carries overwrite", async () => {
    api.promote
      .mockResolvedValueOnce({ promoted: [], rejected: [], clashes: ["notes.md"] })
      .mockResolvedValueOnce({
        promoted: [{ key: "projects/p1/notes.md", name: "notes.md" }],
        rejected: [],
        clashes: [],
      });
    render(wrap(<SessionFilesContent sessionId="s1" project={project(true)} />));
    fireEvent.click(await screen.findByRole("button", { name: "Add to project" }));
    expect(
      await screen.findByText(
        "A file named notes.md already exists in the project. Replace it?",
      ),
    ).toBeTruthy();
    expect(toast.success).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    await waitFor(() => expect(api.promote).toHaveBeenCalledTimes(2));
    expect(api.promote).toHaveBeenLastCalledWith("p1", {
      sessionId: "s1",
      keys: ["user_1/s1/notes.md"],
      overwrite: true,
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Added to project"));
  });

  it("a rejected file gets an error toast naming it", async () => {
    api.promote.mockResolvedValue({
      promoted: [],
      rejected: [{ key: "user_1/s1/notes.md", reason: "copy_failed" }],
      clashes: [],
    });
    render(wrap(<SessionFilesContent sessionId="s1" project={project(true)} />));
    fireEvent.click(await screen.findByRole("button", { name: "Add to project" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][0]).toContain("notes.md");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("a double click sends one promote, not two", async () => {
    let resolve!: (v: unknown) => void;
    api.promote.mockReturnValue(new Promise((r) => (resolve = r)));
    render(wrap(<SessionFilesContent sessionId="s1" project={project(true)} />));
    const button = await screen.findByRole("button", { name: "Add to project" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(api.promote).toHaveBeenCalledTimes(1);
    resolve({
      promoted: [{ key: "projects/p1/notes.md", name: "notes.md" }],
      rejected: [],
      clashes: [],
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    // The guard is released afterwards: a later click promotes again.
    api.promote.mockResolvedValue({ promoted: [], rejected: [], clashes: ["notes.md"] });
    fireEvent.click(button);
    await waitFor(() => expect(api.promote).toHaveBeenCalledTimes(2));
  });

  it("an empty rejection uses the translated generic message, not hardcoded English", async () => {
    api.promote.mockResolvedValue({ promoted: [], rejected: [], clashes: [] });
    render(wrap(<SessionFilesContent sessionId="s1" project={project(true)} />));
    fireEvent.click(await screen.findByRole("button", { name: "Add to project" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][0]).toContain(
      enMessages.chat.files.promoteFailedGeneric,
    );
    expect(toast.error.mock.calls[0][0]).not.toContain("not copied");
  });

  it("a thrown promote error gets an error toast naming the file", async () => {
    api.promote.mockRejectedValue(new Error("Forbidden"));
    render(wrap(<SessionFilesContent sessionId="s1" project={project(true)} />));
    fireEvent.click(await screen.findByRole("button", { name: "Add to project" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][0]).toContain("notes.md");
  });

  it("reports each project listing so the caller can track canWrite and the count", async () => {
    const onProjectListed = vi.fn();
    render(
      wrap(
        <SessionFilesContent
          sessionId="s1"
          project={project(true)}
          onProjectListed={onProjectListed}
        />,
      ),
    );
    await waitFor(() =>
      expect(onProjectListed).toHaveBeenCalledWith({
        canWrite: true,
        files: [PROJECT_FILE],
      }),
    );
  });

  it("a 403/404 on the project poll reports access lost, with no error shown", async () => {
    api.projectList.mockRejectedValue(new ProjectFilesAccessError(404));
    const onProjectAccessLost = vi.fn();
    render(
      wrap(
        <SessionFilesContent
          sessionId="s1"
          project={project(true)}
          onProjectAccessLost={onProjectAccessLost}
        />,
      ),
    );
    await waitFor(() => expect(onProjectAccessLost).toHaveBeenCalled());
    expect(screen.queryByText(enMessages.chat.files.errorTitle)).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
