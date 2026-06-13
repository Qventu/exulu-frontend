"use client";

/**
 * FileSidebar — wraps FileTree with a header (root New File / New Folder)
 * and a footer (file count + version badge).
 *
 * Spec: design/pages/skills.md inventory #48, #51, #52, #70; ladder rows
 * 48/51/52/70; responsive.md T6 (in-page rail → left Sheet below md).
 *
 * - Desktop (≥md): inline collapsible rail. The host (`SkillEditorView`)
 *   owns the open/closed state and the `w-60` shell + `duration-200`
 *   transition (#42). This component just renders the content; rendering
 *   nothing when `sidebarOpen=false` is the host's job (it animates the
 *   width to 0).
 * - Mobile (<md): the host renders this same component inside a left
 *   Sheet (responsive.md T6). The component doesn't know which surface
 *   it's painted on — the consumer wraps appropriately.
 *
 * canWrite=false (#67): New File / New Folder header actions are
 * suppressed. The empty-state copy switches to a read-only variant
 * (file-tree.tsx owns the in-tree empty copy).
 */

import { FilePlus, FolderPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { SkillFileNode, SkillFilesResponse } from "../../types";
import { FileTree } from "./file-tree";

export interface FileSidebarProps {
  filesData: SkillFilesResponse | null;
  filesLoading: boolean;
  fallbackVersion: number;
  selectedKey: string | null;
  canWrite: boolean;
  onSelectFile: (node: SkillFileNode) => void;
  onCreateFile: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
  onRename: (node: SkillFileNode) => void;
  onDelete: (node: SkillFileNode) => void;
}

export function FileSidebar({
  filesData,
  filesLoading,
  fallbackVersion,
  selectedKey,
  canWrite,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
}: FileSidebarProps) {
  const t = useTranslations("skills");

  const fileCount = filesData?.fileCount ?? 0;
  const version = filesData?.version ?? fallbackVersion;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full min-h-0 flex-col">
        {/* Header (#48) */}
        <div className="flex flex-shrink-0 items-center justify-between border-b bg-muted/20 px-3 py-2">
          <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("editor.sidebar.files")}
          </span>
          {canWrite ? (
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => onCreateFile("/")}
                    aria-label={t("editor.tree.newFile")}
                  >
                    <FilePlus className="size-3.5" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("editor.tree.newFile")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => onCreateFolder("/")}
                    aria-label={t("editor.tree.newFolder")}
                  >
                    <FolderPlus className="size-3.5" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("editor.tree.newFolder")}</TooltipContent>
              </Tooltip>
            </div>
          ) : null}
        </div>

        {/* Body — tree, skeleton, or empty state. */}
        <ScrollArea className="flex-1">
          {filesLoading ? (
            // Skeleton of ~6 indented rows (#70) — resolves M6 in the page-doc.
            <div className="space-y-1 px-2 py-2" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-5"
                  style={{
                    marginLeft: `${(i % 3) * 12}px`,
                    width: `${100 - (i % 4) * 8}%`,
                  }}
                />
              ))}
            </div>
          ) : filesData?.tree ? (
            <FileTree
              root={filesData.tree}
              selectedKey={selectedKey}
              canWrite={canWrite}
              onSelectFile={onSelectFile}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onRename={onRename}
              onDelete={onDelete}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-muted-foreground">
              <p className="text-xs">
                {canWrite
                  ? t("editor.tree.emptyTitle")
                  : t("editor.tree.emptyReadOnly")}
              </p>
              {canWrite ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onCreateFile("/")}
                >
                  <FilePlus className="size-3.5" aria-hidden="true" />
                  {t("editor.tree.newFile")}
                </Button>
              ) : null}
            </div>
          )}
        </ScrollArea>

        {/* Footer (#52) */}
        <div className="flex flex-shrink-0 items-center justify-between border-t bg-muted/10 px-3 py-2">
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {t("editor.sidebar.fileCount", { count: fileCount })}
          </span>
          <Badge
            variant="outline"
            className="font-mono text-xs"
            aria-label={t("editor.sidebar.versionLabel", { version })}
          >
            v{version}
          </Badge>
        </div>
      </div>
    </TooltipProvider>
  );
}
