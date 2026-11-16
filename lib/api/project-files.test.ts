import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  getUris: vi.fn(async () => ({ base: "https://api" })),
  getToken: vi.fn(async () => "tok"),
  request: vi.fn(),
}));
vi.mock("@/lib/api/client", () => client);

import { ProjectFilesError, projectFilesApi } from "./project-files";

const reply = (status: number, body: unknown) =>
  vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: "x",
    json: async () => body,
  }));

describe("projectFilesApi", () => {
  beforeEach(() => client.request.mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it("list asks the project route and returns canWrite with the files", async () => {
    client.request.mockResolvedValue({ canWrite: true, files: [] });
    const res = await projectFilesApi.list("p1");
    expect(client.request).toHaveBeenCalledWith("/projects/p1/files", "GET");
    expect(res).toEqual({ canWrite: true, files: [] });
  });

  it("uploadSign returns the signed url on 200", async () => {
    vi.stubGlobal("fetch", reply(200, { uploadUrl: "u", key: "k" }));
    expect(
      await projectFilesApi.uploadSign("p1", {
        filename: "a.md",
        contentType: "text/markdown",
      }),
    ).toEqual({ uploadUrl: "u", key: "k" });
  });

  it("uploadSign maps 409 to { exists: true, lastModified }", async () => {
    vi.stubGlobal(
      "fetch",
      reply(409, { error: "exists", lastModified: "2026-11-16T10:00:00Z" }),
    );
    expect(
      await projectFilesApi.uploadSign("p1", {
        filename: "a.md",
        contentType: "text/markdown",
      }),
    ).toEqual({ exists: true, lastModified: "2026-11-16T10:00:00Z" });
  });

  it("uploadSign turns 400 project_full into a typed error carrying the max", async () => {
    vi.stubGlobal("fetch", reply(400, { error: "project_full", max: 200 }));
    await expect(
      projectFilesApi.uploadSign("p1", { filename: "a", contentType: "x" }),
    ).rejects.toMatchObject({ code: "project_full", max: 200 });
    await expect(
      projectFilesApi.uploadSign("p1", { filename: "a", contentType: "x" }),
    ).rejects.toBeInstanceOf(ProjectFilesError);
  });

  it("uploadSign sends overwrite only when asked", async () => {
    const f = reply(200, { uploadUrl: "u", key: "k" });
    vi.stubGlobal("fetch", f);
    await projectFilesApi.uploadSign("p1", {
      filename: "a",
      contentType: "x",
      overwrite: true,
    });
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({
      filename: "a",
      contentType: "x",
      overwrite: true,
    });
  });

  it("promote returns the 409 clash body instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      reply(409, { promoted: [], rejected: [], clashes: ["a.md"] }),
    );
    expect(
      await projectFilesApi.promote("p1", { sessionId: "s1", keys: ["k"] }),
    ).toMatchObject({ promoted: [], clashes: ["a.md"] });
  });

  it("promote resolves with the result body on a 500 that carries one", async () => {
    const body = {
      promoted: [],
      rejected: [{ key: "k", reason: "copy_failed" }],
      clashes: [],
    };
    vi.stubGlobal("fetch", reply(500, body));
    expect(
      await projectFilesApi.promote("p1", { sessionId: "s1", keys: ["k"] }),
    ).toEqual(body);
  });

  it("promote throws on a 500 with only a detail", async () => {
    vi.stubGlobal(
      "fetch",
      reply(500, { detail: "Failed to copy files into the project." }),
    );
    await expect(
      projectFilesApi.promote("p1", { sessionId: "s1", keys: ["k"] }),
    ).rejects.toThrow("Failed to copy files into the project.");
  });

  it("delete encodes the key", async () => {
    client.request.mockResolvedValue({ deleted: true });
    await projectFilesApi.delete("p1", "projects/p1/a b.md");
    expect(client.request).toHaveBeenCalledWith(
      "/projects/p1/files?key=projects%2Fp1%2Fa%20b.md",
      "DELETE",
    );
  });

  it("previewPdfUrl embeds key and token", async () => {
    expect(await projectFilesApi.previewPdfUrl("p1", "k/a")).toBe(
      "https://api/projects/p1/file/preview-pdf?key=k%2Fa&auth=tok",
    );
  });
});
