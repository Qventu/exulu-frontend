// @vitest-environment jsdom
/**
 * The chat's view of the session's project folder: present only when the
 * session has a project AND the caller may list its files; fed by the panel's
 * own poll while open; dropped (silently) on a 403/404.
 */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/api/project-files", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/project-files")>()),
  projectFilesApi: { list: api.list },
}));
vi.mock("@/lib/api/session-files", () => ({ sessionFilesApi: {} }));
const apollo = vi.hoisted(() => ({ useQuery: vi.fn() }));
vi.mock("@apollo/client", async (orig) => ({
  ...(await orig<typeof import("@apollo/client")>()),
  useQuery: apollo.useQuery,
}));

import { ProjectFilesAccessError } from "@/lib/api/project-files";
import { notifyFilesChanged } from "@/components/widgets/files-panel/upload";

import { useChatProjectFiles } from "./use-project-files";

const FILE = {
  key: "projects/p1/brief.pdf",
  name: "brief.pdf",
  size: 1,
  lastModified: "2026-11-16T10:00:00.000Z",
  contentType: "application/pdf",
  presignedUrl: "u",
};

beforeEach(() => {
  api.list.mockReset().mockResolvedValue({ canWrite: true, files: [FILE] });
  apollo.useQuery.mockReset().mockImplementation((_doc, opts) => ({
    data: opts?.skip ? undefined : { projectById: { id: "p1", name: "Atlas" } },
  }));
});
afterEach(cleanup);

describe("useChatProjectFiles", () => {
  it("is null for a session without a project, and never asks", async () => {
    const { result } = renderHook(() => useChatProjectFiles(null));
    await act(async () => {});
    expect(result.current.projectFiles).toBeNull();
    expect(api.list).not.toHaveBeenCalled();
  });

  it("combines the listing with the project's name", async () => {
    const { result } = renderHook(() => useChatProjectFiles("p1"));
    await waitFor(() =>
      expect(result.current.projectFiles).toEqual({
        id: "p1",
        name: "Atlas",
        canWrite: true,
        files: [FILE],
      }),
    );
  });

  it.each([403, 404])("is null when the listing answers %i", async (status) => {
    api.list.mockRejectedValue(new ProjectFilesAccessError(status));
    const { result } = renderHook(() => useChatProjectFiles("p1"));
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current.projectFiles).toBeNull();
  });

  it("the panel's poll can drop the section (detached while open)", async () => {
    const { result } = renderHook(() => useChatProjectFiles("p1"));
    await waitFor(() => expect(result.current.projectFiles).not.toBeNull());
    act(() => result.current.syncProjectFiles(null));
    expect(result.current.projectFiles).toBeNull();
  });

  it("the panel's poll updates canWrite and files", async () => {
    const { result } = renderHook(() => useChatProjectFiles("p1"));
    await waitFor(() => expect(result.current.projectFiles).not.toBeNull());
    act(() => result.current.syncProjectFiles({ canWrite: false, files: [] }));
    expect(result.current.projectFiles).toMatchObject({ canWrite: false, files: [] });
  });

  it("refetches when the project folder changes (upload, promote)", async () => {
    renderHook(() => useChatProjectFiles("p1"));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(1));
    act(() =>
      notifyFilesChanged({ kind: "project", projectId: "p1", name: "", canWrite: true }),
    );
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  });
});
