"use client";

/**
 * Session-file preview (chat.md item 82). Route-local rework of
 * components/session-files/preview-pane.tsx — content behavior unchanged
 * (text/code inline ≤200 KB, images, PDFs via iframe, Office via the
 * backend LibreOffice→PDF preview, unknown → download only). Sizing
 * switches from `h-[calc(100vh-220px)]` to `h-full` (V1), and the header
 * controls meet ≥44px touch targets below `md`.
 */

import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { CodePreview } from "@/components/custom/code-preview";
import { TextPreview } from "@/components/custom/text-preview";
import { Button } from "@/components/ui/button";
import { sessionFilesApi, type SessionFile } from "@/lib/api/session-files";

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

function CenteredSpinner({ label }: { label: string }) {
    return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 size-5 animate-spin" aria-hidden="true" />
            <span className="text-sm">{label}</span>
        </div>
    );
}

export function PreviewPane({
    sessionId,
    file,
    onBack,
}: {
    sessionId: string;
    file: SessionFile;
    onBack: () => void;
}) {
    const t = useTranslations("chat");
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
                t("files.tooLargeToPreview", { size: formatBytes(file.size) }),
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
                if (!cancelled)
                    setTextError(
                        t("files.previewFailed", { message: err.message }),
                    );
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file.presignedUrl, file.size, category]);

    // Resolve the LibreOffice-rendered preview URL for Office binaries
    // (unchanged transport: sessionFilesApi.previewPdfUrl).
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
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 md:h-8 md:w-8"
                    onClick={onBack}
                    aria-label={t("files.backToFiles")}
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                </Button>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                        {formatBytes(file.size)}
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 md:h-8 md:w-8"
                    asChild
                >
                    <a
                        href={file.presignedUrl}
                        download={file.name}
                        aria-label={t("files.download")}
                    >
                        <Download className="size-4" aria-hidden="true" />
                    </a>
                </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3">
                {category === "image" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={file.presignedUrl}
                        alt={file.name}
                        className="h-auto max-w-full rounded-md border"
                    />
                )}

                {category === "pdf" && (
                    <iframe
                        src={file.presignedUrl}
                        title={file.name}
                        className="h-full min-h-[320px] w-full rounded-md border"
                    />
                )}

                {category === "office" &&
                    (pdfUrl ? (
                        <iframe
                            src={pdfUrl}
                            title={file.name}
                            className="h-full min-h-[320px] w-full rounded-md border"
                        />
                    ) : (
                        <CenteredSpinner label={t("files.renderingPreview")} />
                    ))}

                {category === "text" &&
                    (textError ? (
                        <p className="text-sm text-muted-foreground">{textError}</p>
                    ) : textBody === null ? (
                        <CenteredSpinner label={t("files.loadingPreview")} />
                    ) : (
                        <TextPreview text={textBody} sliceLength={textBody.length} />
                    ))}

                {category === "code" &&
                    (textError ? (
                        <p className="text-sm text-muted-foreground">{textError}</p>
                    ) : textBody === null ? (
                        <CenteredSpinner label={t("files.loadingPreview")} />
                    ) : (
                        <CodePreview
                            code={textBody}
                            slice={textBody.length}
                            language={languageFromFilename(file.name)}
                        />
                    ))}

                {category === "unknown" && (
                    <div className="space-y-2 text-sm text-muted-foreground">
                        <p>{t("files.noInlinePreview")}</p>
                        <p>
                            <a
                                href={file.presignedUrl}
                                download={file.name}
                                className="text-primary hover:underline"
                            >
                                {t("files.downloadNamed", { name: file.name })}
                            </a>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
