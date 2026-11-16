/**
 * The one session-files upload path, shared by the panel's UploadZone and
 * the conversation-wide drop target (chat-drop-target.tsx), for a session or
 * a project folder (see scope.ts). For each file:
 *  1. adapter.uploadSign  → presigned PUT URL (a project may answer "exists")
 *  2. sessionFilesApi.putToSignedUrl → straight to S3
 *  3. adapter.afterUpload → sessions only: the agent sees it on its next turn
 * Files go sequentially so a multi-file drop never slams S3 with parallel
 * PUTs; the bottleneck for typical session files is bandwidth, not requests.
 *
 * Sizes are validated for the WHOLE batch first, so a drop never starts an
 * upload it will abandon halfway. Toasts stay on sonner (chat standard).
 *
 * The change signal below lets a drop outside the panel refresh the panel's
 * list at once instead of waiting for its 5 s poll — a tiny in-memory bus
 * keyed by folder, nothing global.
 */

import { toast } from "sonner";

import { ProjectFilesError } from "@/lib/api/project-files";
import { sessionFilesApi } from "@/lib/api/session-files";

import { fileScopeAdapter, type FileScope } from "./scope";
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

export interface UploadOptions {
  /**
   * Called when the project already has a file of that name. Resolve true to
   * overwrite. Without it a clash is reported and the file skipped, so a
   * caller that cannot ask never overwrites silently.
   */
  confirmOverwrite?: (name: string, lastModified: string) => Promise<boolean>;
}

export async function uploadFiles(
  scope: FileScope,
  files: File[],
  t: Translate,
  options: UploadOptions = {},
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

  const adapter = fileScopeAdapter(scope);
  let uploaded = 0;
  let failed = 0;
  for (const file of files) {
    const contentType = file.type || "application/octet-stream";
    try {
      let signed = await adapter.uploadSign({
        filename: file.name,
        contentType,
      });
      if ("exists" in signed) {
        const overwrite = options.confirmOverwrite
          ? await options.confirmOverwrite(file.name, signed.lastModified)
          : false;
        if (!overwrite) {
          failed += 1;
          toast.error(t("files.uploadExistsSkipped", { name: file.name }));
          continue;
        }
        signed = await adapter.uploadSign({
          filename: file.name,
          contentType,
          overwrite: true,
        });
        if ("exists" in signed) throw new Error("Upload refused: file exists");
      }
      await sessionFilesApi.putToSignedUrl(signed.uploadUrl, file, contentType);
      uploaded += 1;
      if (adapter.afterUpload) {
        try {
          await adapter.afterUpload(signed.key);
        } catch (syncErr) {
          // Upload itself succeeded — warn but don't fail the whole flow.
          toast.warning(t("files.uploadSyncWarning", { name: file.name }));
          console.error("[SESSION-FILES] sync-to-sandbox failed", syncErr);
        }
      }
    } catch (err) {
      failed += 1;
      toast.error(
        err instanceof ProjectFilesError
          ? t("files.projectFull", { max: err.max })
          : t("files.uploadFailed", {
              name: file.name,
              message: err instanceof Error ? err.message : String(err),
            }),
      );
    }
  }

  notifyFilesChanged(scope);
  return { uploaded, failed, rejected: false };
}

/** The session-only entry point the conversation drop target uses. */
export function uploadSessionFiles(
  sessionId: string,
  files: File[],
  t: Translate,
): Promise<UploadOutcome> {
  return uploadFiles({ kind: "session", sessionId }, files, t);
}

const listeners = new Map<string, Set<() => void>>();

function subscribeKey(key: string, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) listeners.delete(key);
  };
}

/** Subscribe to "files changed" for one folder; returns the unsubscribe. */
export function subscribeFilesChanged(
  scope: FileScope,
  listener: () => void,
): () => void {
  return subscribeKey(fileScopeAdapter(scope).changeKey, listener);
}

export function notifyFilesChanged(scope: FileScope): void {
  listeners.get(fileScopeAdapter(scope).changeKey)?.forEach((l) => l());
}

/** Subscribe to "files changed" for one session; returns the unsubscribe. */
export function subscribeSessionFilesChanged(
  sessionId: string,
  listener: () => void,
): () => void {
  return subscribeFilesChanged({ kind: "session", sessionId }, listener);
}

export function notifySessionFilesChanged(sessionId: string): void {
  notifyFilesChanged({ kind: "session", sessionId });
}
