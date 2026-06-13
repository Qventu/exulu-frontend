"use client";

/**
 * SkillDiffModal — From/To version selectors + per-file diff viewer.
 *
 * Spec: design/pages/skills.md inventory #66; ladder row 66; responsive.md
 * T5 (Dialog → full-screen sheet) + T8 (split diffs → unified <md).
 *
 * Behaviors:
 *  - **All current viewer states preserved**: same-version, loading,
 *    no-files, no-file-selected, unchanged-file, added, removed, modified.
 *  - **Mobile (<md)** = full-screen takeover (`h-dvh w-screen max-w-none
 *    rounded-none`), unified view forced (`splitView={false}` — fixes the
 *    60-px-column unreadable bug); From/To selects stack; file list becomes
 *    a horizontal scrolling chip strip above the viewer.
 *  - **Desktop (≥md)** = original two-pane layout with side file list +
 *    split view for modified files.
 *  - Theming via the existing ReactDiffViewer custom variables (preserved
 *    verbatim — page-doc explicitly calls these out as correct).
 *  - i18n: all copy moved into the `skills.editor.diff.*` namespace.
 */

import { useTheme } from "next-themes";
import {
  ArrowRight,
  FileCheck,
  FileEdit,
  FileMinus,
  FilePlus,
  GitCompare,
  Loader2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { skillsApi } from "@/lib/api/skills";
import { cn } from "@/lib/utils";

import type { Skill } from "../../types";

interface SkillFileDiff {
  path: string;
  status: "added" | "removed" | "modified" | "unchanged";
  diff?: string;
}

export interface SkillDiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: Skill;
}

type DiffStatus = SkillFileDiff["status"];

interface StatusConfigEntry {
  icon: typeof FilePlus;
  className: string;
}

const STATUS_CONFIG: Record<DiffStatus, StatusConfigEntry> = {
  added: {
    icon: FilePlus,
    className: "text-green-600 dark:text-green-500",
  },
  removed: {
    icon: FileMinus,
    className: "text-red-600 dark:text-red-500",
  },
  modified: {
    icon: FileEdit,
    className: "text-yellow-600 dark:text-yellow-500",
  },
  unchanged: {
    icon: FileCheck,
    className: "text-muted-foreground",
  },
};

// Parse a unified diff string into the two sides ReactDiffViewer expects.
// Lifted verbatim from the legacy implementation (correct behavior); only
// extracted for readability.
function parseUnifiedDiff(diffStr?: string): {
  oldContent: string;
  newContent: string;
} {
  if (!diffStr) return { oldContent: "", newContent: "" };
  const lines = diffStr.split("\n");
  const oldLines: string[] = [];
  const newLines: string[] = [];
  for (const line of lines) {
    if (
      line.startsWith("---") ||
      line.startsWith("+++") ||
      line.startsWith("@@")
    )
      continue;
    if (line.startsWith("-")) oldLines.push(line.slice(1));
    else if (line.startsWith("+")) newLines.push(line.slice(1));
    else {
      oldLines.push(line.slice(1));
      newLines.push(line.slice(1));
    }
  }
  return {
    oldContent: oldLines.join("\n"),
    newContent: newLines.join("\n"),
  };
}

export function SkillDiffModal({
  open,
  onOpenChange,
  skill,
}: SkillDiffModalProps) {
  const t = useTranslations("skills");
  const { theme } = useTheme();
  const isMobile = useIsMobile();

  const currentVersion = skill.current_version ?? 1;
  const history = React.useMemo(
    () => skill.history ?? [],
    [skill.history],
  );
  const allVersions = React.useMemo(
    () => Array.from({ length: currentVersion }, (_, i) => i + 1),
    [currentVersion],
  );

  const [fromVersion, setFromVersion] = React.useState<number>(
    currentVersion > 1 ? currentVersion - 1 : 1,
  );
  const [toVersion, setToVersion] = React.useState<number>(currentVersion);
  const [diffs, setDiffs] = React.useState<SkillFileDiff[]>([]);
  const [selectedFile, setSelectedFile] =
    React.useState<SkillFileDiff | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Re-fetch whenever the dialog opens or version selection changes.
  React.useEffect(() => {
    if (!open) return;
    if (fromVersion === toVersion) return;

    let cancelled = false;
    setLoading(true);
    setDiffs([]);
    setSelectedFile(null);

    skillsApi
      .diff(skill.id, fromVersion, toVersion)
      .then((res: { files?: SkillFileDiff[] }) => {
        if (cancelled) return;
        const files = res.files ?? [];
        setDiffs(files);
        const firstChanged =
          files.find((f) => f.status !== "unchanged") ?? files[0] ?? null;
        setSelectedFile(firstChanged);
      })
      .catch(() => {
        if (cancelled) return;
        setDiffs([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, fromVersion, toVersion, skill.id]);

  const versionLabel = React.useCallback(
    (v: number) => {
      if (v === currentVersion)
        return t("editor.diff.versionLabelCurrent", { version: v });
      const entry = history.find((h) => h.version === v);
      return entry?.label
        ? t("editor.diff.versionLabelTagged", {
            version: v,
            label: entry.label,
          })
        : t("editor.diff.versionLabelPlain", { version: v });
    },
    [currentVersion, history, t],
  );

  const changedFiles = diffs.filter((f) => f.status !== "unchanged");
  const unchangedCount = diffs.length - changedFiles.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 p-0",
          // <md: full-screen takeover (responsive.md T5/T8).
          "h-dvh w-screen max-w-none rounded-none",
          // ≥md: bounded centered dialog.
          "md:h-auto md:max-h-[90dvh] md:w-auto md:max-w-6xl md:rounded-lg",
        )}
      >
        <DialogHeader className="border-b px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <GitCompare
              className="size-4 text-muted-foreground sm:size-5"
              aria-hidden="true"
            />
            {t("editor.diff.title")}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {t("editor.diff.description")}
          </DialogDescription>
        </DialogHeader>

        {/* Version selectors — stack <sm, inline ≥sm. */}
        <div className="flex flex-col gap-2 border-b bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-6">
          <div className="flex items-center gap-2">
            <label
              htmlFor="diff-from"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {t("editor.diff.from")}
            </label>
            <Select
              value={fromVersion.toString()}
              onValueChange={(v) => setFromVersion(Number(v))}
            >
              <SelectTrigger id="diff-from" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allVersions.map((v) => (
                  <SelectItem key={v} value={v.toString()} className="text-xs">
                    {versionLabel(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ArrowRight
            className="hidden size-4 shrink-0 text-muted-foreground sm:block"
            aria-hidden="true"
          />

          <div className="flex items-center gap-2">
            <label
              htmlFor="diff-to"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {t("editor.diff.to")}
            </label>
            <Select
              value={toVersion.toString()}
              onValueChange={(v) => setToVersion(Number(v))}
            >
              <SelectTrigger id="diff-to" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allVersions.map((v) => (
                  <SelectItem key={v} value={v.toString()} className="text-xs">
                    {versionLabel(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!loading && diffs.length > 0 ? (
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {t("editor.diff.changedCount", { count: changedFiles.length })}
              </span>
              {unchangedCount > 0 ? (
                <span>
                  {t("editor.diff.unchangedCount", { count: unchangedCount })}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {fromVersion === toVersion ? (
          <div className="flex flex-1 items-center justify-center px-6 py-16 text-center text-sm text-muted-foreground">
            {t("editor.diff.selectDifferent")}
          </div>
        ) : loading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2
              className="size-6 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        ) : diffs.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6 py-16 text-center text-sm text-muted-foreground">
            {t("editor.diff.noFiles")}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
            {/* <md: chip strip (horizontal scroll); ≥md: side file list. */}
            {isMobile ? (
              <div className="flex-shrink-0 overflow-x-auto border-b">
                <div className="flex w-max gap-1 p-2">
                  {diffs.map((file) => {
                    const cfg = STATUS_CONFIG[file.status];
                    const Icon = cfg.icon;
                    const isActive = selectedFile?.path === file.path;
                    return (
                      <button
                        key={file.path}
                        type="button"
                        onClick={() => setSelectedFile(file)}
                        className={cn(
                          "flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors",
                          isActive
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "hover:bg-accent/50",
                        )}
                      >
                        <Icon
                          className={cn("size-3 shrink-0", cfg.className)}
                          aria-hidden="true"
                        />
                        <span>{file.path}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex w-56 flex-shrink-0 flex-col border-r">
                <p className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("editor.diff.files")}
                </p>
                <ScrollArea className="flex-1">
                  <div className="py-1">
                    {diffs.map((file) => {
                      const cfg = STATUS_CONFIG[file.status];
                      const Icon = cfg.icon;
                      const isActive = selectedFile?.path === file.path;
                      return (
                        <button
                          key={file.path}
                          type="button"
                          onClick={() => setSelectedFile(file)}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent/50",
                            isActive && "bg-primary/10 text-primary",
                          )}
                        >
                          <Icon
                            className={cn("size-3 shrink-0", cfg.className)}
                            aria-hidden="true"
                          />
                          <span className="truncate">{file.path}</span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Diff viewer. */}
            <div className="min-w-0 flex-1 overflow-auto">
              {selectedFile ? (
                <DiffViewerBody
                  file={selectedFile}
                  fromVersion={fromVersion}
                  toVersion={toVersion}
                  isMobile={isMobile}
                  isDark={theme === "dark"}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                  {t("editor.diff.selectFile")}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DiffViewerBody({
  file,
  fromVersion,
  toVersion,
  isMobile,
  isDark,
}: {
  file: SkillFileDiff;
  fromVersion: number;
  toVersion: number;
  isMobile: boolean;
  isDark: boolean;
}) {
  const t = useTranslations("skills");
  const { oldContent, newContent } = parseUnifiedDiff(file.diff);
  const showSplit = !isMobile && file.status === "modified";

  if (file.status === "unchanged") {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        {t("editor.diff.noChanges")}
      </div>
    );
  }

  if (file.status === "added") {
    return (
      <div className="p-4">
        <Badge
          variant="outline"
          className="mb-3 border-green-600/30 text-green-600 dark:text-green-500"
        >
          {t("editor.diff.fileAdded", { version: toVersion })}
        </Badge>
        <ReactDiffViewer
          oldValue=""
          newValue={newContent}
          splitView={false}
          useDarkTheme={isDark}
          compareMethod={DiffMethod.WORDS}
          hideLineNumbers={false}
          {...DIFF_VIEWER_STYLES}
        />
      </div>
    );
  }

  if (file.status === "removed") {
    return (
      <div className="p-4">
        <Badge
          variant="outline"
          className="mb-3 border-red-600/30 text-red-600 dark:text-red-500"
        >
          {t("editor.diff.fileRemoved", { version: toVersion })}
        </Badge>
        <ReactDiffViewer
          oldValue={oldContent}
          newValue=""
          splitView={false}
          useDarkTheme={isDark}
          compareMethod={DiffMethod.WORDS}
          hideLineNumbers={false}
          {...DIFF_VIEWER_STYLES}
        />
      </div>
    );
  }

  // Modified — split view ≥md, unified <md (responsive.md T8).
  return (
    <div className="p-4">
      <ReactDiffViewer
        oldValue={oldContent}
        newValue={newContent}
        splitView={showSplit}
        useDarkTheme={isDark}
        compareMethod={DiffMethod.WORDS}
        leftTitle={showSplit ? `v${fromVersion}` : undefined}
        rightTitle={showSplit ? `v${toVersion}` : undefined}
        {...DIFF_VIEWER_STYLES}
      />
    </div>
  );
}

// Theming preserved verbatim from the legacy implementation — page-doc
// risk callout: "Diff viewer theming already handles dark mode via custom
// variables; keep when restyling, it's correct."
const DIFF_VIEWER_STYLES = {
  styles: {
    variables: {
      light: {
        diffViewerBackground: "hsl(var(--background))",
        addedBackground: "hsl(142, 76%, 90%)",
        addedColor: "hsl(142, 76%, 20%)",
        removedBackground: "hsl(0, 84%, 90%)",
        removedColor: "hsl(0, 84%, 30%)",
        wordAddedBackground: "hsl(142, 76%, 75%)",
        wordRemovedBackground: "hsl(0, 84%, 75%)",
        addedGutterBackground: "hsl(142, 76%, 85%)",
        removedGutterBackground: "hsl(0, 84%, 85%)",
        gutterBackground: "hsl(var(--muted))",
        gutterBackgroundDark: "hsl(var(--muted))",
      },
      dark: {
        diffViewerBackground: "hsl(var(--background))",
        addedBackground: "hsl(142, 76%, 15%)",
        addedColor: "hsl(142, 76%, 80%)",
        removedBackground: "hsl(0, 84%, 15%)",
        removedColor: "hsl(0, 84%, 80%)",
        wordAddedBackground: "hsl(142, 76%, 25%)",
        wordRemovedBackground: "hsl(0, 84%, 25%)",
        addedGutterBackground: "hsl(142, 76%, 20%)",
        removedGutterBackground: "hsl(0, 84%, 20%)",
        gutterBackground: "hsl(var(--muted))",
        gutterBackgroundDark: "hsl(var(--muted))",
      },
    },
  },
};
