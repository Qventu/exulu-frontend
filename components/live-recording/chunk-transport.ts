/**
 * The real transport behind the chunk queue: multipart POST to
 * POST {backend}/transcription-jobs/:id/chunks with the same auth headers the
 * chat composer uses for /transcribe. Never throws on HTTP errors — the queue
 * decides what to do from the status code.
 */
import { getToken } from "@/lib/api/client";

import type { SendResult } from "./chunk-queue";
import { extensionFor } from "./mime";

export type ChunkPayload = {
  seq: number;
  blob: Blob;
  offsetMs: number;
  durationMs: number;
  mimeType: string;
};

export type LiveRecorderTransport = {
  sendChunk: (jobId: string, chunk: ChunkPayload, opts: { skipped: boolean }) => Promise<SendResult>;
};

/**
 * Per-request budget. A chunk POST that neither fails nor answers (a socket
 * black-holed by a sleeping radio) would otherwise block the strictly
 * sequential queue forever — no retry, no interim text, and a Stop that never
 * drains. Aborting reports the same transient failure as a network error, and
 * the server appends with a compare-and-swap on seq, so a retry of a request
 * that did land is idempotent.
 */
export const CHUNK_REQUEST_TIMEOUT_MS = 90_000;

export function createFetchTransport(backend: string, userId: string | number): LiveRecorderTransport {
  return {
    async sendChunk(jobId, chunk, { skipped }) {
      const form = new FormData();
      form.append("seq", String(chunk.seq));
      form.append("offset_ms", String(Math.max(0, Math.round(chunk.offsetMs))));
      form.append("duration_ms", String(Math.max(1, Math.round(chunk.durationMs))));
      // An empty segment (an interruption right after a cut) carries no audio
      // a transcriber could ever accept, so it goes as a skip marker whatever
      // the queue asked for: sending it as a file would draw a deterministic
      // rejection at best and an empty transcription bill at worst.
      if (skipped || chunk.blob.size === 0) {
        form.append("skipped", "true");
      } else {
        // Re-wrap so the type is always audio/* (Chrome can report video/webm on raw blobs).
        const type = chunk.mimeType || "audio/webm";
        form.append("file", new Blob([chunk.blob], { type }), `chunk-${chunk.seq}.${extensionFor(type)}`);
      }
      let res: Response;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CHUNK_REQUEST_TIMEOUT_MS);
      try {
        const token = await getToken();
        if (!token) return { ok: false, status: 401 };
        res = await fetch(`${backend}/transcription-jobs/${jobId}/chunks`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, User: String(userId) },
          body: form,
          signal: controller.signal,
        });
      } catch {
        // Includes the AbortError the timer raises: transient, so the queue
        // retries this seq with backoff.
        return { ok: false, status: null };
      } finally {
        clearTimeout(timer);
      }
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as { text?: unknown };
        return { ok: true, text: typeof json.text === "string" ? json.text : "" };
      }
      const body = (await res.json().catch(() => null)) as { kind?: string } | null;
      return { ok: false, status: res.status, body };
    },
  };
}
