"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { sessionFilesApi } from "@/lib/api/session-files";
import { toast } from "sonner";
import { MAX_UPLOAD_BYTES, formatBytes } from "./utils";

/**
 * Drag-drop / browse uploader for the session files panel. For each file:
 *  1. Calls sessionFilesApi.uploadSign to get a presigned PUT URL.
 *  2. PUTs the file directly to S3.
 *  3. Calls sessionFilesApi.syncToSandbox so the agent sees the file on
 *     its next turn.
 *  4. Triggers a refresh of the file list in the parent.
 *
 * Multi-file uploads run sequentially so we don't slam S3 with parallel
 * PUTs that could exceed quotas; the bottleneck for typical session files
 * (documents, images) is upload bandwidth, not request count.
 */
export function UploadZone({
    sessionId,
    onUploadComplete,
}: {
    sessionId: string;
    onUploadComplete: () => void;
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadingCount, setUploadingCount] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFiles = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        const files = Array.from(fileList);

        // Pre-validate sizes so we don't kick off a multi-file upload that
        // will fail partway.
        const tooBig = files.find((f) => f.size > MAX_UPLOAD_BYTES);
        if (tooBig) {
            toast.error(
                `"${tooBig.name}" is ${formatBytes(tooBig.size)} — limit is ${formatBytes(MAX_UPLOAD_BYTES)}`,
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
                            `"${file.name}" uploaded, but the agent may not see it until the next session restart.`,
                        );
                        console.error("[SESSION-FILES] sync-to-sandbox failed", syncErr);
                    }
                } catch (err: any) {
                    toast.error(`Failed to upload "${file.name}": ${err.message}`);
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
            className={`flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                }`}
        >
            <input
                ref={inputRef}
                id="session-files-upload"
                type="file"
                multiple
                className="sr-only"
                onChange={(e) => handleFiles(e.target.files)}
                disabled={uploadingCount > 0}
            />
            {uploadingCount > 0 ? (
                <>
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">
                        Uploading {uploadingCount} file{uploadingCount === 1 ? "" : "s"}…
                    </p>
                </>
            ) : (
                <>
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <p className="text-xs font-medium">Drop files or click to upload</p>
                    <p className="text-[11px] text-muted-foreground">
                        Max {formatBytes(MAX_UPLOAD_BYTES)} per file
                    </p>
                </>
            )}
        </label>
    );
}
