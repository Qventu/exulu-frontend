import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  uploadSign: vi.fn(),
  putToSignedUrl: vi.fn(),
  syncToSandbox: vi.fn(),
}));
const toasts = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn() }));

vi.mock("@/lib/api/session-files", () => ({ sessionFilesApi: api }));
vi.mock("sonner", () => ({ toast: toasts }));

import { MAX_UPLOAD_BYTES } from "./utils";
import { subscribeSessionFilesChanged, uploadSessionFiles } from "./upload";

const file = (name: string, size = 10) => {
  const f = new File([new Uint8Array(size)], name, { type: "text/plain" });
  return f;
};
const t = (key: string) => key;

describe("uploadSessionFiles", () => {
  beforeEach(() => {
    api.uploadSign
      .mockReset()
      .mockImplementation(async (_s: string, name: string) => ({
        uploadUrl: `https://s3/${name}`,
        key: `k/${name}`,
      }));
    api.putToSignedUrl.mockReset().mockResolvedValue(undefined);
    api.syncToSandbox.mockReset().mockResolvedValue({ written: true });
    toasts.error.mockReset();
    toasts.warning.mockReset();
  });

  it("refuses the whole batch before any request when one file is over the cap", async () => {
    const big = new File([new Uint8Array(1)], "big.bin");
    Object.defineProperty(big, "size", { value: MAX_UPLOAD_BYTES + 1 });
    const result = await uploadSessionFiles("s1", [file("a.txt"), big], t);
    expect(result).toEqual({ uploaded: 0, failed: 0, rejected: true });
    expect(api.uploadSign).not.toHaveBeenCalled();
    expect(toasts.error).toHaveBeenCalledTimes(1);
  });

  it("signs, puts and syncs each file, in order", async () => {
    const result = await uploadSessionFiles(
      "s1",
      [file("a.txt"), file("b.txt")],
      t,
    );
    expect(result).toEqual({ uploaded: 2, failed: 0, rejected: false });
    expect(api.uploadSign.mock.calls.map((c) => c[1])).toEqual([
      "a.txt",
      "b.txt",
    ]);
    expect(api.putToSignedUrl).toHaveBeenCalledTimes(2);
    expect(api.syncToSandbox.mock.calls.map((c) => c[1])).toEqual([
      "k/a.txt",
      "k/b.txt",
    ]);
  });

  it("warns on a failed sandbox sync but still counts the upload", async () => {
    api.syncToSandbox.mockRejectedValueOnce(new Error("no sandbox"));
    const result = await uploadSessionFiles("s1", [file("a.txt")], t);
    expect(result.uploaded).toBe(1);
    expect(toasts.warning).toHaveBeenCalledTimes(1);
  });

  it("reports a failed put and carries on with the next file", async () => {
    api.putToSignedUrl.mockRejectedValueOnce(new Error("403"));
    const result = await uploadSessionFiles(
      "s1",
      [file("a.txt"), file("b.txt")],
      t,
    );
    expect(result).toEqual({ uploaded: 1, failed: 1, rejected: false });
    expect(toasts.error).toHaveBeenCalledTimes(1);
  });

  it("notifies that session's subscribers once the batch is done", async () => {
    const mine = vi.fn();
    const other = vi.fn();
    const stop = subscribeSessionFilesChanged("s1", mine);
    const stopOther = subscribeSessionFilesChanged("s2", other);
    await uploadSessionFiles("s1", [file("a.txt")], t);
    expect(mine).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    stop();
    stopOther();
    await uploadSessionFiles("s1", [file("b.txt")], t);
    expect(mine).toHaveBeenCalledTimes(1);
  });
});
