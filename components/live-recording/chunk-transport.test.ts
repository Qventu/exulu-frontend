import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHUNK_REQUEST_TIMEOUT_MS, createFetchTransport, type ChunkPayload } from "./chunk-transport";

vi.mock("@/lib/api/client", () => ({ getToken: async () => "token" }));

const chunk = (blob: Blob): ChunkPayload => ({ seq: 3, blob, offsetMs: 1234.6, durationMs: 20_000, mimeType: "audio/webm" });

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("createFetchTransport", () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
  const transport = createFetchTransport("https://backend.test", 42);

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const sentForm = (): FormData => {
    const init = fetchMock.mock.calls[0]?.[1];
    if (!(init?.body instanceof FormData)) throw new Error("no FormData body was sent");
    return init.body;
  };

  it("posts the audio as a file with the seq, offset and duration", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { text: "hello" }));
    const result = await transport.sendChunk("job-1", chunk(new Blob(["abc"])), { skipped: false });
    expect(result).toEqual({ ok: true, text: "hello" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://backend.test/transcription-jobs/job-1/chunks");
    const form = sentForm();
    expect(form.get("seq")).toBe("3");
    expect(form.get("offset_ms")).toBe("1235");
    expect(form.get("duration_ms")).toBe("20000");
    expect(form.get("skipped")).toBeNull();
    const file = form.get("file");
    expect(file).toBeInstanceOf(Blob);
    expect((file as Blob).type).toBe("audio/webm");
  });

  it("sends the skip marker instead of a file when the queue asks for one", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await transport.sendChunk("job-1", chunk(new Blob(["abc"])), { skipped: true });
    const form = sentForm();
    expect(form.get("skipped")).toBe("true");
    expect(form.get("file")).toBeNull();
  });

  it("sends an empty segment as a skip marker whatever the queue asked for", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await transport.sendChunk("job-1", chunk(new Blob([])), { skipped: false });
    const form = sentForm();
    expect(form.get("skipped")).toBe("true");
    expect(form.get("file")).toBeNull();
  });

  it("reports HTTP failures with the status and the server's kind", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(409, { kind: "not_recording" }));
    const result = await transport.sendChunk("job-1", chunk(new Blob(["abc"])), { skipped: false });
    expect(result).toEqual({ ok: false, status: 409, body: { kind: "not_recording" } });
  });

  it("reports a thrown fetch as a transient failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const result = await transport.sendChunk("job-1", chunk(new Blob(["abc"])), { skipped: false });
    expect(result).toEqual({ ok: false, status: null });
  });

  it("aborts a request that never answers and reports it as transient", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const pending = transport.sendChunk("job-1", chunk(new Blob(["abc"])), { skipped: false });
    // getToken() resolves on a microtask before fetch is called; let it.
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(CHUNK_REQUEST_TIMEOUT_MS - 1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    await expect(pending).resolves.toEqual({ ok: false, status: null });
  });

  it("clears the timer once the request has answered", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { text: "" }));
    await transport.sendChunk("job-1", chunk(new Blob(["abc"])), { skipped: false });
    expect(vi.getTimerCount()).toBe(0);
  });
});
