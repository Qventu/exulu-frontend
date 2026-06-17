"use client";

/**
 * Drag-drop / browse uploader for the session files panel (chat.md item 83 —
 * flow unchanged). Route-local relocation of
 * components/session-files/upload-zone.tsx. For each file:
 *  1. Calls sessionFilesApi.uploadSign to get a presigned PUT URL.
 *  2. PUTs the file directly to S3.
 *  3. Calls sessionFilesApi.syncToSandbox so the agent sees the file on
 *     its next turn.
 *  4. Triggers a refresh of the file list in the parent.
 *
 * Multi-file uploads run sequentially so we don't slam S3 with parallel
 * PUTs that could exceed quotas; the bottleneck for typical session files
 * (documents, images) is upload bandwidth, not request count.
 *
 * `inputRef` (optional) exposes the hidden file input so the panel's empty
 * EmptyState can use "browse" as its action (item 80a).
 */

import { Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type MutableRefObject } from "react";
import { toast } from "sonner";

import { sessionFilesApi } from "@/lib/api/session-files";

import { formatBytes, MAX_UPLOAD_BYTES } from "./utils";

export function UploadZone({
    sessionId,
    onUploadComplete,
    inputRef: externalInputRef,
}: {
    sessionId: string;
    onUploadComplete: () => void;
    inputRef?: MutableRefObject<HTMLInputElement | null>;
}) {
    const t = useTranslations("chat");
    const [isDragging, setIsDragging] = useState(false);
    const [uploadingCount, setUploadingCount] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const handleFiles = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        const files = Array.from(fileList);

        // Pre-validate sizes so we don't kick off a multi-file upload that
        // will fail partway.
        const tooBig = files.find((f) => f.size > MAX_UPLOAD_BYTES);
        if (tooBig) {
            toast.error(
                t("files.uploadTooBig", {
                    name: tooBig.name,
                    size: formatBytes(tooBig.size),
                    limit: formatBytes(MAX_UPLOAD_BYTES),
                }),
            );
            return;
        }

        setUploadingCount(files.length);
        try {
            for (const file of files) {
                const contentType = file.type || "application/octet-stream";
                try {
                    const { uploadUrl, key } = await sessionFilesApi.uploadSign(
                        sessionId,
                        file.name,
                        contentType,
                    );
                    await sessionFilesApi.putToSignedUrl(uploadUrl, file, contentType);
                    try {
                        await sessionFilesApi.syncToSandbox(sessionId, key);
                    } catch (syncErr: any) {
                        // Upload itself succeeded — warn but don't fail the whole flow.
                        toast.warning(
                            t("files.uploadSyncWarning", { name: file.name }),
                        );
                        console.error("[SESSION-FILES] sync-to-sandbox failed", syncErr);
                    }
                } catch (err: any) {
                    toast.error(
                        t("files.uploadFailed", {
                            name: file.name,
                            message: err.message,
                        }),
                    );
                }
            }
        } finally {
            setUploadingCount(0);
            onUploadComplete();
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    return (
        <label
            htmlFor="session-files-upload"
            onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
            }}
            onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
            }}
            onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
            }}
            onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFiles(e.dataTransfer.files);
            }}
            className={`flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-4 text-center transition-colors duration-150 motion-reduce:transition-none ${isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/30"
                }`}
        >
            <input
                ref={(el) => {
                    inputRef.current = el;
                    if (externalInputRef) externalInputRef.current = el;
                }}
                id="session-files-upload"
                type="file"
                multiple
                className="sr-only"
                onChange={(e) => handleFiles(e.target.files)}
                disabled={uploadingCount > 0}
            />
            {uploadingCount > 0 ? (
                <>
                    <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
                    <p className="text-xs text-muted-foreground" role="status">
                        {t("files.uploadingCount", { count: uploadingCount })}
                    </p>
                </>
            ) : (
                <>
                    <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
                    <p className="text-xs font-medium">{t("files.dropOrClick")}</p>
                    <p className="text-[11px] text-muted-foreground">
                        {t("files.maxPerFile", { limit: formatBytes(MAX_UPLOAD_BYTES) })}
                    </p>
                </>
            )}
        </label>
    );
}
