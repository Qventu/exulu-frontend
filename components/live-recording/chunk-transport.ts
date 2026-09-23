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

export function createFetchTransport(backend: string, userId: string | number): LiveRecorderTransport {
  return {
    async sendChunk(jobId, chunk, { skipped }) {
      const form = new FormData();
      form.append("seq", String(chunk.seq));
      form.append("offset_ms", String(Math.max(0, Math.round(chunk.offsetMs))));
      form.append("duration_ms", String(Math.max(1, Math.round(chunk.durationMs))));
      if (skipped) {
        form.append("skipped", "true");
      } else {
        // Re-wrap so the type is always audio/* (Chrome can report video/webm on raw blobs).
        const type = chunk.mimeType || "audio/webm";
        form.append("file", new Blob([chunk.blob], { type }), `chunk-${chunk.seq}.${extensionFor(type)}`);
      }
      let res: Response;
      try {
        const token = await getToken();
        if (!token) return { ok: false, status: 401 };
        res = await fetch(`${backend}/transcription-jobs/${jobId}/chunks`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, User: String(userId) },
          body: form,
        });
      } catch {
        return { ok: false, status: null };
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
