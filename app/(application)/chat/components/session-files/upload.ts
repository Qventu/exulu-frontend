/**
 * The one session-files upload path, shared by the panel's UploadZone and
 * the conversation-wide drop target (chat-drop-target.tsx). For each file:
 *  1. sessionFilesApi.uploadSign  → presigned PUT URL
 *  2. sessionFilesApi.putToSignedUrl → straight to S3
 *  3. sessionFilesApi.syncToSandbox → the agent sees it on its next turn
 * Files go sequentially so a multi-file drop never slams S3 with parallel
 * PUTs; the bottleneck for typical session files is bandwidth, not requests.
 *
 * Sizes are validated for the WHOLE batch first, so a drop never starts an
 * upload it will abandon halfway. Toasts stay on sonner (chat standard).
 *
 * The change signal below lets a drop outside the panel refresh the panel's
 * list at once instead of waiting for its 5 s poll — a tiny in-memory bus
 * keyed by session, nothing global.
 */

import { toast } from "sonner";

import { sessionFilesApi } from "@/lib/api/session-files";

import { formatBytes, MAX_UPLOAD_BYTES } from "./utils";

type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export interface UploadOutcome {
  uploaded: number;
  failed: number;
  /** The batch was refused up front (a file over the cap); nothing ran. */
  rejected: boolean;
}

export async function uploadSessionFiles(
  sessionId: string,
  files: File[],
  t: Translate,
): Promise<UploadOutcome> {
  if (files.length === 0) return { uploaded: 0, failed: 0, rejected: false };

  const tooBig = files.find((file) => file.size > MAX_UPLOAD_BYTES);
  if (tooBig) {
    toast.error(
      t("files.uploadTooBig", {
        name: tooBig.name,
        size: formatBytes(tooBig.size),
        limit: formatBytes(MAX_UPLOAD_BYTES),
      }),
    );
    return { uploaded: 0, failed: 0, rejected: true };
  }

  let uploaded = 0;
  let failed = 0;
  for (const file of files) {
    const contentType = file.type || "application/octet-stream";
    try {
      const { uploadUrl, key } = await sessionFilesApi.uploadSign(
        sessionId,
        file.name,
        contentType,
      );
      await sessionFilesApi.putToSignedUrl(uploadUrl, file, contentType);
      uploaded += 1;
      try {
        await sessionFilesApi.syncToSandbox(sessionId, key);
      } catch (syncErr) {
        // Upload itself succeeded — warn but don't fail the whole flow.
        toast.warning(t("files.uploadSyncWarning", { name: file.name }));
        console.error("[SESSION-FILES] sync-to-sandbox failed", syncErr);
      }
    } catch (err) {
      failed += 1;
      toast.error(
        t("files.uploadFailed", {
          name: file.name,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  notifySessionFilesChanged(sessionId);
  return { uploaded, failed, rejected: false };
}

const listeners = new Map<string, Set<() => void>>();

/** Subscribe to "files changed" for one session; returns the unsubscribe. */
export function subscribeSessionFilesChanged(
  sessionId: string,
  listener: () => void,
): () => void {
  let set = listeners.get(sessionId);
  if (!set) {
    set = new Set();
    listeners.set(sessionId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) listeners.delete(sessionId);
  };
}

export function notifySessionFilesChanged(sessionId: string): void {
  listeners.get(sessionId)?.forEach((listener) => listener());
}
