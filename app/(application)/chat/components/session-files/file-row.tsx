"use client";

/**
 * One file row in the session files panel (chat.md items 80/81).
 *
 * Route-local rework of components/session-files/file-row.tsx:
 * - Preview / Download / Delete are ALWAYS visible (fixes U6 — no
 *   opacity-0 group-hover reveal), ≥44px targets below `md`, with
 *   tooltips + aria-labels;
 * - Delete only signals intent — the parent confirms via the shared
 *   ConfirmDialog (item 81, kills window.confirm);
 * - timestamps via the shared RelativeTime primitive.
 */

import {
    Download,
    Eye,
    File as FileIcon,
    FileCode,
    FileImage,
    FileSpreadsheet,
    FileText,
    FileType2,
    Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { RelativeTime } from "@/components/primitives/relative-time";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SessionFile } from "@/lib/api/session-files";

import { formatBytes, getPreviewCategory } from "./utils";

function IconFor({ name }: { name: string }) {
    const cat = getPreviewCategory(name);
    switch (cat) {
        case "text":
            return <FileText className="size-4 text-muted-foreground" aria-hidden="true" />;
        case "code":
            return <FileCode className="size-4 text-muted-foreground" aria-hidden="true" />;
        case "image":
            return <FileImage className="size-4 text-muted-foreground" aria-hidden="true" />;
        case "pdf":
            return <FileType2 className="size-4 text-muted-foreground" aria-hidden="true" />;
        case "office":
            return <FileSpreadsheet className="size-4 text-muted-foreground" aria-hidden="true" />;
        default:
            return <FileIcon className="size-4 text-muted-foreground" aria-hidden="true" />;
    }
}

const ACTION_BUTTON_CLASSES = "h-11 w-11 md:h-8 md:w-8";

export function FileRow({
    file,
    onPreview,
    onDelete,
}: {
    file: SessionFile;
    onPreview: (file: SessionFile) => void;
    /** Signals intent only — the parent confirms via the shared ConfirmDialog. */
    onDelete: (file: SessionFile) => void;
}) {
    const t = useTranslations("chat");
    const tCommon = useTranslations("common");

    return (
        <TooltipProvider delayDuration={300}>
            <div className="flex min-h-11 items-center gap-2 border-b border-border px-3 py-1.5 last:border-b-0 hover:bg-muted/50">
                <IconFor name={file.name} />
                <button
                    type="button"
                    onClick={() => onPreview(file)}
                    className="min-h-11 min-w-0 flex-1 py-1 text-left"
                >
                    <div className="truncate text-sm font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                        {formatBytes(file.size)} · <RelativeTime date={file.lastModified} />
                    </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={ACTION_BUTTON_CLASSES}
                                onClick={() => onPreview(file)}
                                aria-label={t("files.preview")}
                            >
                                <Eye className="size-4" aria-hidden="true" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("files.preview")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={ACTION_BUTTON_CLASSES}
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
                        </TooltipTrigger>
                        <TooltipContent>{t("files.download")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`${ACTION_BUTTON_CLASSES} text-destructive hover:text-destructive`}
                                onClick={() => onDelete(file)}
                                aria-label={tCommon("delete")}
                            >
                                <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{tCommon("delete")}</TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </TooltipProvider>
    );
}
