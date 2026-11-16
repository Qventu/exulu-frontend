import { beforeEach, describe, expect, it, vi } from "vitest";

const project = vi.hoisted(() => ({ uploadSign: vi.fn() }));
const session = vi.hoisted(() => ({
  putToSignedUrl: vi.fn(),
  syncToSandbox: vi.fn(),
}));
const toasts = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn() }));

vi.mock("@/lib/api/session-files", () => ({ sessionFilesApi: session }));
vi.mock("@/lib/api/project-files", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/project-files")>()),
  projectFilesApi: project,
}));
vi.mock("sonner", () => ({ toast: toasts }));

import { ProjectFilesError } from "@/lib/api/project-files";
import { subscribeFilesChanged, uploadFiles } from "./upload";

const scope = {
  kind: "project",
  projectId: "p1",
  name: "Atlas",
  canWrite: true,
} as const;
const file = (name: string) =>
  new File([new Uint8Array(4)], name, { type: "text/plain" });
const t = (key: string, v?: Record<string, string | number>) =>
  `${key}${v ? JSON.stringify(v) : ""}`;

describe("uploadFiles (project scope)", () => {
  beforeEach(() => {
    project.uploadSign.mockReset().mockResolvedValue({ uploadUrl: "u", key: "k" });
    session.putToSignedUrl.mockReset().mockResolvedValue(undefined);
    session.syncToSandbox.mockReset();
    toasts.error.mockReset();
  });

  it("uploads without touching the sandbox and notifies project subscribers", async () => {
    const changed = vi.fn();
    const off = subscribeFilesChanged(scope, changed);
    const res = await uploadFiles(scope, [file("a.md")], t);
    off();
    expect(res).toEqual({ uploaded: 1, failed: 0, rejected: false });
    expect(session.syncToSandbox).not.toHaveBeenCalled();
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("skips a clashing name without a confirm handler (no silent overwrite)", async () => {
    project.uploadSign.mockResolvedValueOnce({ exists: true, lastModified: "x" });
    const res = await uploadFiles(scope, [file("a.md")], t);
    expect(res.failed).toBe(1);
    expect(session.putToSignedUrl).not.toHaveBeenCalled();
  });

  it("re-signs with overwrite after the user confirms", async () => {
    project.uploadSign
      .mockResolvedValueOnce({ exists: true, lastModified: "x" })
      .mockResolvedValueOnce({ uploadUrl: "u2", key: "k" });
    const confirm = vi.fn(async () => true);
    const res = await uploadFiles(scope, [file("a.md")], t, {
      confirmOverwrite: confirm,
    });
    expect(res.uploaded).toBe(1);
    expect(project.uploadSign.mock.calls[1][1]).toMatchObject({ overwrite: true });
    expect(confirm).toHaveBeenCalledWith("a.md", "x");
  });

  it("names the 200-file limit when the project is full", async () => {
    project.uploadSign.mockRejectedValueOnce(
      new ProjectFilesError("project_full", 200),
    );
    await uploadFiles(scope, [file("a.md")], t);
    expect(toasts.error.mock.calls[0][0]).toContain('"max":200');
  });
});
