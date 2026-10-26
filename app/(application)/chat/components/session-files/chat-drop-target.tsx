"use client";

/**
 * ChatDropTarget — drag a file anywhere over the conversation and it lands
 * in the session's files.
 *
 * WHY: with the file sandbox on, the only way to give the agent a file was
 * ＋ → "Session files" → the panel's drop zone. But "drop it in the chat and
 * the agent sees it" is trained behaviour from every other chat tool, so a
 * drop on the conversation used to do the worst thing: the browser navigated
 * to the file. Now a file drag over the column shows a drop overlay naming
 * the destination, opens the files panel so the user sees where it lands,
 * and the drop uploads through the same path as the panel (./upload.ts).
 *
 * States of the overlay:
 *  - sandbox on + write access  → "Drop files to add them to this session"
 *  - sandbox off                → the ＋ menu's own "sandbox is off" line
 *  - read-only session          → "You can't add files to this session"
 *  - uploading                  → spinner + "Uploading N files…"
 * In every state the drop is swallowed, so the page never navigates away.
 *
 * Wraps the whole quiet column (header, messages, composer) — the composer
 * handles no drops of its own, so there is nothing to collide with. Enter/
 * leave are depth-counted (dragleave fires on every child boundary) and the
 * overlay is pointer-events-none, so it never steals its own drop.
 */

import { FolderOpen, Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { cn } from "@/lib/utils";

import type { ChatSessionController } from "../../hooks";
import { uploadSessionFiles } from "./upload";
import { formatBytes, MAX_UPLOAD_BYTES } from "./utils";

export type ChatDropController = Pick<
  ChatSessionController,
  | "agent"
  | "writeAccess"
  | "filesPanelOpen"
  | "setFilesPanelOpen"
  | "ensureSession"
>;

export interface ChatDropTargetProps {
  controller: ChatDropController;
  children: React.ReactNode;
  className?: string;
}

const carriesFiles = (event: React.DragEvent): boolean =>
  Array.from(event.dataTransfer?.types ?? []).includes("Files");

export function ChatDropTarget({
  controller,
  children,
  className,
}: ChatDropTargetProps) {
  const t = useTranslations("chat");
  const [dragging, setDragging] = React.useState(false);
  const [uploadingCount, setUploadingCount] = React.useState(0);
  const depth = React.useRef(0);
  const openedForThisDrag = React.useRef(false);

  const sandboxOn = !!controller.agent.sandbox_enabled;
  const enabled = sandboxOn && controller.writeAccess;

  const endDrag = () => {
    depth.current = 0;
    openedForThisDrag.current = false;
    setDragging(false);
  };

  const onDragEnter = (event: React.DragEvent) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    depth.current += 1;
    if (depth.current > 1) return;
    setDragging(true);
    // Show where the file will land before it is dropped.
    if (enabled && !openedForThisDrag.current) {
      openedForThisDrag.current = true;
      if (!controller.filesPanelOpen) void controller.setFilesPanelOpen(true);
    }
  };

  const onDragOver = (event: React.DragEvent) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = enabled ? "copy" : "none";
  };

  const onDragLeave = (event: React.DragEvent) => {
    if (!carriesFiles(event)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) endDrag();
  };

  const onDrop = async (event: React.DragEvent) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []);
    endDrag();
    if (!enabled || files.length === 0) return;

    setUploadingCount(files.length);
    try {
      const session = await controller.ensureSession();
      if (!session) return;
      if (!controller.filesPanelOpen) void controller.setFilesPanelOpen(true);
      await uploadSessionFiles(session.id, files, t);
    } finally {
      setUploadingCount(0);
    }
  };

  const uploading = uploadingCount > 0;
  const showOverlay = dragging || uploading;

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(event) => void onDrop(event)}
    >
      {children}
      {showOverlay ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
        >
          <div
            className={cn(
              "flex w-full min-w-0 max-w-md flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center sm:px-8 sm:py-10",
              enabled
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/40",
            )}
          >
            {uploading ? (
              <Loader2
                aria-hidden="true"
                className="size-8 animate-spin text-primary"
              />
            ) : enabled ? (
              <Upload aria-hidden="true" className="size-8 text-primary" />
            ) : (
              <FolderOpen
                aria-hidden="true"
                className="size-8 text-muted-foreground"
              />
            )}
            <p className="text-balance text-base font-medium text-foreground">
              {uploading
                ? t("files.uploadingCount", { count: uploadingCount })
                : enabled
                  ? t("files.dropTitle")
                  : sandboxOn
                    ? t("files.dropReadOnly")
                    : t("attach.sessionFilesDisabled")}
            </p>
            {/* Secondary lines only where there is room: on phones the
                files sheet covers the column anyway. */}
            {enabled && !uploading ? (
              <>
                <p className="hidden text-balance text-sm text-muted-foreground md:block">
                  {t("files.dropHint")}
                </p>
                <p className="hidden text-xs text-muted-foreground md:block">
                  {t("files.maxPerFile", {
                    limit: formatBytes(MAX_UPLOAD_BYTES),
                  })}
                </p>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
