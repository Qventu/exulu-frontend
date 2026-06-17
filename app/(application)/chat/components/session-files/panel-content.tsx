"use client";

/**
 * SessionFilesContent — the files panel CONTENT (chat.md items 80, 80a,
 * 81–84). Mounted INSIDE the SidePanel primitive by session-screen:
 *
 *   <SidePanel open={…} onOpenChange={…} title={t("chat.files.title")}
 *     resizable storageKey="chat-files" mobileSize="full">
 *     {session && <SessionFilesContent sessionId={session.id} />}
 *   </SidePanel>
 *
 * Route-local relocation + rework of components/session-files/
 * session-files-panel.tsx (the SidePanel now owns header/close/resize):
 * - 5s polling via lib/api/session-files (unchanged transport, item 80);
 * - loading = skeleton rows mirroring file rows, empty = shared EmptyState
 *   with the upload zone as its action, error = message + Retry (item 80a);
 * - delete = shared ConfirmDialog (item 81, kills window.confirm);
 * - privacy note on the panel's title info line (item 84);
 * - toasts stay on sonner (chat standardizes on sonner, fixes U8).
 *
 * The panel is intentionally session-scoped — both in the UI and in the
 * auth model (every backend route checks the calling user's session
 * prefix). The same S3 prefix is used by the agent's writeFile and bash
 * artifact mirroring, so user-uploaded files appear alongside
 * agent-produced ones.
 */

import { FolderOpen, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionFilesApi, type SessionFile } from "@/lib/api/session-files";

import { FileRow } from "./file-row";
import { PreviewPane } from "./preview-pane";
import { UploadZone } from "./upload-zone";

const POLL_INTERVAL_MS = 5_000;

export interface SessionFilesContentProps {
    sessionId: string;
}

/** Skeleton rows mirroring the file-row anatomy (philosophy §6 / item 80a). */
function FileRowSkeletons() {
    return (
        <div aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
                <div
                    key={i}
                    className="flex min-h-11 items-center gap-2 border-b border-border px-3 py-2 last:border-b-0"
                >
                    <Skeleton className="size-4 rounded" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-3/5" />
                        <Skeleton className="h-3 w-2/5" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function SessionFilesContent({ sessionId }: SessionFilesContentProps) {
    const t = useTranslations("chat");
    const tCommon = useTranslations("common");

    const [files, setFiles] = useState<SessionFile[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<SessionFile | null>(null);
    const [fileToDelete, setFileToDelete] = useState<SessionFile | null>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const browseInputRef = useRef<HTMLInputElement | null>(null);

    const refresh = useCallback(async () => {
        try {
            const res = await sessionFilesApi.list(sessionId);
            setFiles(res.files);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        }
    }, [sessionId]);

    // Initial load + 5s polling while mounted so agent-produced files appear
    // live (item 80 — unchanged cadence). Stops on unmount/panel close
    // (session-screen unmounts the content with the SidePanel).
    useEffect(() => {
        refresh();
        pollIntervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, [refresh]);

    // Keep the preview file's metadata in sync with the polled list — if it
    // was deleted, drop the preview and bail back to the list.
    useEffect(() => {
        if (!previewFile || !files) return;
        const stillThere = files.find((f) => f.key === previewFile.key);
        if (!stillThere) {
            setPreviewFile(null);
        } else if (stillThere.lastModified !== previewFile.lastModified) {
            // Re-uploaded version: refresh metadata + presigned URL.
            setPreviewFile(stillThere);
        }
    }, [files, previewFile]);

    const handleConfirmDelete = useCallback(async () => {
        if (!fileToDelete) return;
        const file = fileToDelete;
        try {
            await sessionFilesApi.delete(sessionId, file.key);
            setFiles((curr) =>
                curr ? curr.filter((f) => f.key !== file.key) : curr,
            );
            if (previewFile?.key === file.key) setPreviewFile(null);
            setFileToDelete(null);
        } catch (err: any) {
            toast.error(t("files.deleteFailed", { message: err.message }));
            // Re-throw so the ConfirmDialog stays open for retry/cancel.
            throw err;
        }
    }, [fileToDelete, previewFile, sessionId, t]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            {previewFile ? (
                <PreviewPane
                    sessionId={sessionId}
                    file={previewFile}
                    onBack={() => setPreviewFile(null)}
                />
            ) : (
                <>
                    {/* Item 84: session-scope privacy note on the title info line. */}
                    <div className="flex shrink-0 items-start gap-2 border-b border-border bg-muted/30 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
                        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        <span>
                            {t("files.privacyNote")}
                            {files !== null && (
                                <>
                                    {" · "}
                                    {t("files.count", { count: files.length })}
                                </>
                            )}
                        </span>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {error ? (
                            <EmptyState
                                variant="error"
                                title={t("files.errorTitle")}
                                description={error}
                                action={{ label: tCommon("retry"), onClick: refresh }}
                            />
                        ) : files === null ? (
                            <FileRowSkeletons />
                        ) : files.length === 0 ? (
                            <EmptyState
                                variant="quiet"
                                icon={FolderOpen}
                                title={t("files.emptyTitle")}
                                description={t("files.emptyDescription")}
                                action={{
                                    label: t("files.browse"),
                                    onClick: () => browseInputRef.current?.click(),
                                }}
                            />
                        ) : (
                            files.map((file) => (
                                <FileRow
                                    key={file.key}
                                    file={file}
                                    onPreview={setPreviewFile}
                                    onDelete={setFileToDelete}
                                />
                            ))
                        )}
                    </div>

                    {/* Item 83: upload zone, bottom of the panel, flow unchanged. */}
                    <div className="shrink-0 border-t border-border p-3">
                        <UploadZone
                            sessionId={sessionId}
                            onUploadComplete={refresh}
                            inputRef={browseInputRef}
                        />
                    </div>
                </>
            )}

            {/* Item 81: shared ConfirmDialog replaces window.confirm. */}
            <ConfirmDialog
                open={fileToDelete !== null}
                onOpenChange={(open) => {
                    if (!open) setFileToDelete(null);
                }}
                title={t("files.deleteTitle")}
                description={
                    fileToDelete
                        ? t("files.deleteDescription", { name: fileToDelete.name })
                        : undefined
                }
                variant="destructive"
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
