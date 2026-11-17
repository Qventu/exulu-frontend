"use client";

/**
 * Drag-drop / browse uploader for the session files panel (chat.md item 83 —
 * flow unchanged). Route-local relocation of
 * components/session-files/upload-zone.tsx. The upload itself (sign → PUT →
 * sync-to-sandbox for sessions only; projects are synced by the backend each
 * turn; sequential, size-checked up front) lives in ./upload.ts,
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
import { filesFromDrop, isFolderJunk } from "@/lib/dropped-files";
import { formatBytes, MAX_UPLOAD_BYTES } from "./utils";

export function UploadZone({
    scope,
    onUploadComplete,
    inputRef: externalInputRef,
    compact = false,
}: {
    scope: FileScope;
    onUploadComplete: () => void;
    inputRef?: MutableRefObject<HTMLInputElement | null>;
    /** One line instead of the tall zone: two zones share one sidebar. */
    compact?: boolean;
}) {
    const t = useTranslations("chat");
    const format = useFormatter();
    const [isDragging, setIsDragging] = useState(false);
    const [uploadingCount, setUploadingCount] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const folderInputRef = useRef<HTMLInputElement | null>(null);
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

    const handleFiles = async (picked: FileList | File[] | null) => {
        // A picked folder brings the operating system's own files with it.
        const files = Array.from(picked ?? []).filter((file) => !isFolderJunk(file.name));
        if (files.length === 0) return;
        setUploadingCount(files.length);
        try {
            await uploadFiles(scope, files, t, { confirmOverwrite });
        } finally {
            setUploadingCount(0);
            onUploadComplete();
            if (inputRef.current) inputRef.current.value = "";
            if (folderInputRef.current) folderInputRef.current.value = "";
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
                    // A dropped folder becomes its files (lib/dropped-files).
                    void filesFromDrop(e.dataTransfer).then(handleFiles);
                }}
                className={`${
                    compact
                        ? "flex min-h-11 cursor-pointer flex-wrap items-center justify-center gap-x-2 rounded-md border-2 border-dashed px-3 py-2"
                        : "flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-4"
                } text-center transition-colors duration-150 motion-reduce:transition-none ${
                    isDragging
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
                {/* The folder picker. `webkitdirectory` is the attribute every
                    current browser reads; React does not know it, hence the
                    spread. */}
                <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(e) => handleFiles(e.target.files)}
                    disabled={uploadingCount > 0}
                    {...({ webkitdirectory: "" } as Record<string, string>)}
                />
                {uploadingCount > 0 ? (
                    <>
                        <Loader2
                            className={`${compact ? "size-4" : "size-5"} animate-spin text-primary`}
                            aria-hidden="true"
                        />
                        <p
                            className="text-xs text-muted-foreground"
                            role="status"
                        >
                            {t("files.uploadingCount", {
                                count: uploadingCount,
                            })}
                        </p>
                    </>
                ) : (
                    <>
                        <Upload
                            className={`${compact ? "size-4" : "size-5"} text-muted-foreground`}
                            aria-hidden="true"
                        />
                        <p className="text-xs font-medium">
                            {t("files.dropOrClick")}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                            {t("files.maxPerFile", {
                                limit: formatBytes(MAX_UPLOAD_BYTES),
                            })}
                        </p>
                        {/* A button inside the label: without preventDefault
                            the click would also open the label's own file
                            picker. */}
                        <button
                            type="button"
                            className="rounded-sm text-[11px] font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={(e) => {
                                e.preventDefault();
                                folderInputRef.current?.click();
                            }}
                        >
                            {t("files.chooseFolder")}
                        </button>
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
