"use client";

/**
 * Drag-drop / browse uploader for the session files panel (chat.md item 83 —
 * flow unchanged). Route-local relocation of
 * components/session-files/upload-zone.tsx. The upload itself (sign → PUT →
 * sync-to-sandbox, sequential, size-checked up front) lives in ./upload.ts,
 * shared with the conversation-wide drop target; this component owns only
 * the zone's UI state and triggers the parent's list refresh afterwards.
 *
 * `inputRef` (optional) exposes the hidden file input so the panel's empty
 * EmptyState can use "browse" as its action (item 80a).
 */

import { Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type MutableRefObject } from "react";

import { uploadSessionFiles } from "./upload";
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
        setUploadingCount(files.length);
        try {
            await uploadSessionFiles(sessionId, files, t);
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
