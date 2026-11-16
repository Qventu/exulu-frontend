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

import { useState } from "react";
import {
    Bot,
    Download,
    Eye,
    File as FileIcon,
    FileCode,
    FileImage,
    FileSpreadsheet,
    FileText,
    FileType2,
    FolderInput,
    Link2,
    Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { ShareArtifactDialog } from "@/components/artifacts/share-artifact-dialog";

import { RelativeTime } from "@/components/primitives/relative-time";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SessionFile } from "@/lib/api/session-files";

import type { FileScope } from "./scope";
import { formatBytes, getPreviewCategory } from "./utils";

function IconFor({ name }: { name: string }) {
    const cat = getPreviewCategory(name);
    switch (cat) {
        case "text":
            return (
                <FileText
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                />
            );
        case "code":
            return (
                <FileCode
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                />
            );
        case "image":
            return (
                <FileImage
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                />
            );
        case "pdf":
            return (
                <FileType2
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                />
            );
        case "office":
            return (
                <FileSpreadsheet
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                />
            );
        default:
            return (
                <FileIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                />
            );
    }
}

const ACTION_BUTTON_CLASSES = "h-11 w-11 md:h-8 md:w-8";

export function FileRow({
    scope,
    file,
    onPreview,
    onDelete,
    onPromote,
}: {
    scope: FileScope;
    file: SessionFile;
    onPreview: (file: SessionFile) => void;
    /** Signals intent only — the parent confirms via the shared ConfirmDialog. */
    onDelete: (file: SessionFile) => void;
    /** "Add to project" — given only on session rows the user may promote. */
    onPromote?: (file: SessionFile) => void;
}) {
    const t = useTranslations("chat");
    const tCommon = useTranslations("common");
    const [shareOpen, setShareOpen] = useState(false);
    // A read-only project member sees the folder but cannot change it.
    const canDelete = scope.kind === "session" || scope.canWrite;
    // Sharing signs a key under the caller's own session prefix; a project
    // key is not one, so the project folder offers download only.
    const canShare = scope.kind === "session";

    return (
        <TooltipProvider delayDuration={300}>
            <div className="flex min-h-11 items-center gap-2 border-b border-border px-3 py-1.5 last:border-b-0 hover:bg-muted/50">
                <IconFor name={file.name} />
                <button
                    type="button"
                    onClick={() => onPreview(file)}
                    className="min-h-11 min-w-0 flex-1 py-1 text-left"
                >
                    {file.origin === "agent" ? (
                        <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                            <span className="truncate">{file.name}</span>
                            <span
                                className="shrink-0 text-muted-foreground"
                                title={t("files.createdByAgent")}
                                aria-label={t("files.createdByAgent")}
                                role="img"
                            >
                                <Bot className="size-3.5" aria-hidden="true" />
                            </span>
                        </div>
                    ) : (
                        <div className="truncate text-sm font-medium">
                            {file.name}
                        </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                        {formatBytes(file.size)}
                        {" · "}
                        <RelativeTime date={file.lastModified} />
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
                                    <Download
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                </a>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("files.download")}</TooltipContent>
                    </Tooltip>
                    {canShare && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={ACTION_BUTTON_CLASSES}
                                    onClick={() => setShareOpen(true)}
                                    aria-label={t("files.share")}
                                >
                                    <Link2
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("files.share")}</TooltipContent>
                        </Tooltip>
                    )}
                    {onPromote && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={ACTION_BUTTON_CLASSES}
                                    onClick={() => onPromote(file)}
                                    aria-label={t("files.addToProject")}
                                >
                                    <FolderInput
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {t("files.addToProject")}
                            </TooltipContent>
                        </Tooltip>
                    )}
                    {canDelete && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`${ACTION_BUTTON_CLASSES} text-destructive hover:text-destructive`}
                                    onClick={() => onDelete(file)}
                                    aria-label={tCommon("delete")}
                                >
                                    <Trash2
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{tCommon("delete")}</TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </div>
            {canShare && (
                <ShareArtifactDialog
                    open={shareOpen}
                    onOpenChange={setShareOpen}
                    s3Key={file.key}
                    contentType={file.contentType}
                />
            )}
        </TooltipProvider>
    );
}
