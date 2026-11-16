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
import { useFormatter, useTranslations } from "next-intl";
import { useId, useRef, useState, type MutableRefObject } from "react";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";

import type { FileScope } from "./scope";
import { uploadFiles } from "./upload";
import { formatBytes, MAX_UPLOAD_BYTES } from "./utils";

export function UploadZone({
    scope,
    onUploadComplete,
    inputRef: externalInputRef,
}: {
    scope: FileScope;
    onUploadComplete: () => void;
    inputRef?: MutableRefObject<HTMLInputElement | null>;
}) {
    const t = useTranslations("chat");
    const format = useFormatter();
    const [isDragging, setIsDragging] = useState(false);
    const [uploadingCount, setUploadingCount] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const inputId = useId();
    // A name clash in a project pauses the upload on this confirm; the
    // promise resolves with the user's answer.
    const [pendingOverwrite, setPendingOverwrite] = useState<{
        name: string;
        lastModified: string;
        resolve: (overwrite: boolean) => void;
    } | null>(null);
    const confirmOverwrite = (name: string, lastModified: string) =>
        new Promise<boolean>((resolve) =>
            setPendingOverwrite({ name, lastModified, resolve }),
        );
    const answerOverwrite = (overwrite: boolean) => {
        pendingOverwrite?.resolve(overwrite);
        setPendingOverwrite(null);
    };

    const handleFiles = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        const files = Array.from(fileList);
        setUploadingCount(files.length);
        try {
            await uploadFiles(scope, files, t, { confirmOverwrite });
        } finally {
            setUploadingCount(0);
            onUploadComplete();
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    return (
        <>
        <label
            htmlFor={inputId}
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
                id={inputId}
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
        <ConfirmDialog
            open={pendingOverwrite !== null}
            onOpenChange={(open) => {
                if (!open) answerOverwrite(false);
            }}
            title={t("files.overwriteTitle")}
            description={
                pendingOverwrite
                    ? t("files.overwriteDescription", {
                          name: pendingOverwrite.name,
                          when: format.relativeTime(
                              new Date(pendingOverwrite.lastModified),
                          ),
                      })
                    : undefined
            }
            confirmLabel={t("files.overwriteConfirm")}
            onConfirm={async () => answerOverwrite(true)}
        />
        </>
    );
}
