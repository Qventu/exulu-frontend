"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { sessionFilesApi, type SessionFile } from "@/lib/api/session-files";
import { toast } from "sonner";
import { FileRow } from "./file-row";
import { UploadZone } from "./upload-zone";
import { PreviewPane } from "./preview-pane";

const POLL_INTERVAL_MS = 5_000;

/**
 * Right-side panel showing the files in this chat session's S3 folder.
 *
 * The panel is intentionally session-scoped — both in the UI ("not visible
 * in other sessions, projects, or knowledge bases") and in the auth model
 * (every backend route checks the calling user's session prefix). The same
 * S3 prefix is used by the agent's writeFile and bash artifact mirroring,
 * so user-uploaded files appear alongside agent-produced ones.
 *
 * Polls every 5s while open so files the agent creates mid-conversation
 * show up without manual refresh. Stops polling on close / unmount.
 */
export function SessionFilesPanel({
    sessionId,
    onClose,
}: {
    sessionId: string;
    onClose: () => void;
}) {
    const [files, setFiles] = useState<SessionFile[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<SessionFile | null>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const refresh = useCallback(async () => {
        try {
            const res = await sessionFilesApi.list(sessionId);
            setFiles(res.files);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        }
    }, [sessionId]);

    // Initial load + polling while mounted.
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

    const handleDelete = useCallback(
        async (file: SessionFile) => {
            const ok = window.confirm(`Delete "${file.name}"? This cannot be undone.`);
            if (!ok) return;
            try {
                await sessionFilesApi.delete(sessionId, file.key);
                setFiles((curr) => (curr ? curr.filter((f) => f.key !== file.key) : curr));
                if (previewFile?.key === file.key) setPreviewFile(null);
            } catch (err: any) {
                toast.error(`Failed to delete: ${err.message}`);
            }
        },
        [sessionId, previewFile],
    );

    return (
        // Width is controlled by the parent ResizablePanel — keep this
        // component fluid so the user can drag the handle to make the panel
        // wider for previewing large documents.
        <aside className="flex flex-col w-full h-full bg-card border-l">
            <div className="flex items-center justify-between px-3 py-2 border-b">
                <div>
                    <h3 className="text-sm font-semibold">Session files</h3>
                    <p className="text-[11px] text-muted-foreground">
                        {files === null ? "Loading…" : `${files.length} file${files.length === 1 ? "" : "s"}`}
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onClose}
                    title="Close panel"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="px-3 py-2 text-[11px] text-muted-foreground bg-muted/30 border-b leading-snug">
                Files in this session aren&apos;t shared with other sessions, projects, or knowledge
                bases.
            </div>

            {previewFile ? (
                <PreviewPane
                    sessionId={sessionId}
                    file={previewFile}
                    onBack={() => setPreviewFile(null)}
                />
            ) : (
                <>
                    <div className="flex-1 overflow-auto">
                        {error ? (
                            <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                <p className="text-xs text-destructive">{error}</p>
                                <Button variant="outline" size="sm" onClick={refresh}>
                                    Retry
                                </Button>
                            </div>
                        ) : files === null ? (
                            <div className="flex items-center justify-center py-8 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                <span className="text-xs">Loading files…</span>
                            </div>
                        ) : files.length === 0 ? (
                            <div className="py-8 px-4 text-center text-xs text-muted-foreground">
                                No files yet. Upload below, or wait for the agent to produce one.
                            </div>
                        ) : (
                            files.map((file) => (
                                <FileRow
                                    key={file.key}
                                    file={file}
                                    onPreview={setPreviewFile}
                                    onDelete={handleDelete}
                                />
                            ))
                        )}
                    </div>
                    <div className="border-t p-3">
                        <UploadZone sessionId={sessionId} onUploadComplete={refresh} />
                    </div>
                </>
            )}
        </aside>
    );
}
