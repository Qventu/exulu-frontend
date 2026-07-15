import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadFileToS3 } from "@/lib/import/upload";

vi.mock("@/lib/api/client", () => ({
  getUris: vi.fn(async () => ({
    base: "https://backend.test",
    files: "https://backend.test",
  })),
  getToken: vi.fn(async () => "jwt-token"),
}));

const signedUrl =
  "https://api.s3.exulu.com/exulu/user_1/uuid-_EXULU_report.pdf?X-Amz-Signature=xyz";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadFileToS3", () => {
  it("signs, PUTs, and returns the key extracted from the signed url", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            key: "uuid-_EXULU_report.pdf",
            url: signedUrl,
            method: "PUT",
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const key = await uploadFileToS3(
      new File(["x"], "report.pdf", { type: "application/pdf" }),
    );

    expect(key).toBe("exulu/user_1/uuid-_EXULU_report.pdf");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://backend.test/s3/sign",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer jwt-token" }),
        body: JSON.stringify({
          filename: "report.pdf",
          type: "application/pdf",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      signedUrl,
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("defaults the content type for extension-less files", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ key: "k", url: signedUrl, method: "PUT" }),
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await uploadFileToS3(new File(["x"], "README"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).type).toBe(
      "application/octet-stream",
    );
  });

  it("throws the backend detail on sign failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "no permission" }), {
          status: 403,
        }),
      ),
    );
    await expect(uploadFileToS3(new File(["x"], "a.pdf"))).rejects.toThrow(
      "no permission",
    );
  });

  it("throws on PUT failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ key: "k", url: signedUrl, method: "PUT" }),
          ),
        )
        .mockResolvedValueOnce(new Response(null, { status: 500 })),
    );
    await expect(uploadFileToS3(new File(["x"], "a.pdf"))).rejects.toThrow(
      "Upload failed (500)",
    );
  });

  it("throws when sign response is missing url", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ key: "k", method: "PUT" })),
        ),
    );
    await expect(uploadFileToS3(new File(["x"], "a.pdf"))).rejects.toThrow(
      "Sign response missing upload url",
    );
  });
});
