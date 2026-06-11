"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { sessionFilesApi, type SessionFile } from "@/lib/api/session-files";
import { TextPreview } from "@/components/custom/text-preview";
import { CodePreview } from "@/components/custom/code-preview";
import { formatBytes, getPreviewCategory } from "./utils";

const INLINE_TEXT_MAX_BYTES = 200 * 1024;

/**
 * Filename → react-syntax-highlighter language hint. Limited to the few
 * languages CodePreview already imports; everything else uses the default.
 */
function languageFromFilename(name: string): string | undefined {
    const dot = name.lastIndexOf(".");
    if (dot < 0) return undefined;
    const ext = name.slice(dot).toLowerCase();
    switch (ext) {
        case ".py":
            return "python";
        case ".js":
        case ".jsx":
            return "javascript";
        case ".ts":
        case ".tsx":
            return "typescript";
        case ".json":
            return "json";
        case ".yaml":
        case ".yml":
            return "yaml";
        case ".sh":
            return "bash";
        case ".html":
            return "html";
        case ".css":
            return "css";
        case ".xml":
            return "xml";
        default:
            return undefined;
    }
}

/**
 * Routes the preview UI by file extension:
 *   - text/code → fetch the file body and render via TextPreview/CodePreview
 *   - image    → <img> with the presigned URL
 *   - pdf      → <iframe> with the presigned URL
 *   - office   → <iframe> with the auth'd PDF preview URL (LibreOffice on backend)
 *   - unknown  → metadata + Download button only
 *
 * Files larger than 200 KB skip the inline render and show a "too big to
 * preview, download instead" notice for text/code; binary previews stream
 * from S3 directly via the iframe/img regardless of size.
 */
export function PreviewPane({
    sessionId,
    file,
    onBack,
}: {
    sessionId: string;
    file: SessionFile;
    onBack: () => void;
}) {
    const category = getPreviewCategory(file.name);
    const [textBody, setTextBody] = useState<string | null>(null);
    const [textError, setTextError] = useState<string | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    // Fetch text content for text/code categories.
    useEffect(() => {
        if (category !== "text" && category !== "code") return;
        if (file.size > INLINE_TEXT_MAX_BYTES) {
            setTextBody(null);
            setTextError(
                `File is ${formatBytes(file.size)} — too large to preview inline. Use Download to view.`,
            );
            return;
        }
        let cancelled = false;
        setTextBody(null);
        setTextError(null);
        (async () => {
            try {
                const res = await fetch(file.presignedUrl);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const body = await res.text();
                if (!cancelled) setTextBody(body);
            } catch (err: any) {
                if (!cancelled) setTextError(`Could not load preview: ${err.message}`);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [file.presignedUrl, file.size, category]);

    // Resolve the LibreOffice-rendered preview URL for Office binaries.
    useEffect(() => {
        if (category !== "office") return;
        let cancelled = false;
        setPdfUrl(null);
        sessionFilesApi
            .previewPdfUrl(sessionId, file.key)
            .then((url) => {
                if (!cancelled) setPdfUrl(url);
            })
            .catch((err) => {
                console.error("[SESSION-FILES] previewPdfUrl failed", err);
            });
        return () => {
            cancelled = true;
        };
    }, [sessionId, file.key, category]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 py-2 border-b">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onBack}
                    title="Back to files"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                        {formatBytes(file.size)}
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Download">
                    <a href={file.presignedUrl} download={file.name}>
                        <Download className="h-3.5 w-3.5" />
                    </a>
                </Button>
            </div>

            <div className="flex-1 overflow-auto p-3">
                {category === "image" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={file.presignedUrl}
                        alt={file.name}
                        className="max-w-full h-auto rounded-md border"
                    />
                )}

                {category === "pdf" && (
                    <iframe
                        src={file.presignedUrl}
                        title={file.name}
                        className="w-full h-[calc(100vh-220px)] rounded-md border"
                    />
                )}

                {category === "office" &&
                    (pdfUrl ? (
                        <iframe
                            src={pdfUrl}
                            title={file.name}
                            className="w-full h-[calc(100vh-220px)] rounded-md border"
                        />
                    ) : (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            <span className="text-sm">Rendering preview…</span>
                        </div>
                    ))}

                {category === "text" &&
                    (textError ? (
                        <p className="text-sm text-muted-foreground">{textError}</p>
                    ) : textBody === null ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            <span className="text-sm">Loading preview…</span>
                        </div>
                    ) : (
                        <TextPreview text={textBody} sliceLength={textBody.length} />
                    ))}

                {category === "code" &&
                    (textError ? (
                        <p className="text-sm text-muted-foreground">{textError}</p>
                    ) : textBody === null ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            <span className="text-sm">Loading preview…</span>
                        </div>
                    ) : (
                        <CodePreview
                            code={textBody}
                            slice={textBody.length}
                            language={languageFromFilename(file.name)}
                        />
                    ))}

                {category === "unknown" && (
                    <div className="text-sm text-muted-foreground space-y-2">
                        <p>No inline preview available for this file type.</p>
                        <p>
                            <a
                                href={file.presignedUrl}
                                download={file.name}
                                className="text-primary hover:underline"
                            >
                                Download {file.name}
                            </a>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
