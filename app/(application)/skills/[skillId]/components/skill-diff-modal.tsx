"use client";

import { useState, useEffect } from "react";
import { Skill, SkillFileDiff } from "@/types/models/skill";
import { skillsApi } from "@/lib/api/skills";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { useTheme } from "next-themes";
import {
  GitCompare,
  ArrowRight,
  Loader2,
  FilePlus,
  FileMinus,
  FileEdit,
  FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SkillDiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: Skill;
}

const statusConfig = {
  added: { icon: FilePlus, color: "text-green-600 dark:text-green-500", label: "Added" },
  removed: { icon: FileMinus, color: "text-red-600 dark:text-red-500", label: "Removed" },
  modified: { icon: FileEdit, color: "text-yellow-600 dark:text-yellow-500", label: "Modified" },
  unchanged: { icon: FileCheck, color: "text-muted-foreground", label: "Unchanged" },
};

export function SkillDiffModal({ open, onOpenChange, skill }: SkillDiffModalProps) {
  const { theme } = useTheme();
  const currentVersion = skill.current_version ?? 1;
  const history = skill.history ?? [];

  // Build version list: all versions from 1 to current
  const allVersions = Array.from({ length: currentVersion }, (_, i) => i + 1);

  const [fromVersion, setFromVersion] = useState<number>(
    currentVersion > 1 ? currentVersion - 1 : 1,
  );
  const [toVersion, setToVersion] = useState<number>(currentVersion);
  const [selectedFile, setSelectedFile] = useState<SkillFileDiff | null>(null);
  const [diffs, setDiffs] = useState<SkillFileDiff[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (fromVersion === toVersion) return;

    setLoading(true);
    setDiffs([]);
    setSelectedFile(null);

    skillsApi
      .diff(skill.id, fromVersion, toVersion)
      .then((res) => {
        setDiffs(res.files ?? []);
        const firstChanged = res.files?.find(
          (f: SkillFileDiff) => f.status !== "unchanged",
        );
        setSelectedFile(firstChanged ?? res.files?.[0] ?? null);
      })
      .catch(() => {
        setDiffs([]);
      })
      .finally(() => setLoading(false));
  }, [open, fromVersion, toVersion, skill.id]);

  const getVersionLabel = (v: number) => {
    if (v === currentVersion) return `v${v} (current)`;
    const entry = history.find((h) => h.version === v);
    return entry?.label ? `v${v} — ${entry.label}` : `v${v}`;
  };

  // Parse unified diff into old/new content for ReactDiffViewer
  const parseDiff = (diffStr?: string): { oldContent: string; newContent: string } => {
    if (!diffStr) return { oldContent: "", newContent: "" };
    const lines = diffStr.split("\n");
    const oldLines: string[] = [];
    const newLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("@@")) continue;
      if (line.startsWith("-")) oldLines.push(line.slice(1));
      else if (line.startsWith("+")) newLines.push(line.slice(1));
      else {
        oldLines.push(line.slice(1));
        newLines.push(line.slice(1));
      }
    }
    return { oldContent: oldLines.join("\n"), newContent: newLines.join("\n") };
  };

  const changedFiles = diffs.filter((f) => f.status !== "unchanged");
  const unchangedFiles = diffs.filter((f) => f.status === "unchanged");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            Compare Versions
          </DialogTitle>
          <DialogDescription>
            View file-level differences between two skill versions
          </DialogDescription>
        </DialogHeader>

        {/* Version selectors */}
        <div className="flex items-center gap-3 px-6 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              From
            </label>
            <Select
              value={fromVersion.toString()}
              onValueChange={(v) => setFromVersion(Number(v))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allVersions.map((v) => (
                  <SelectItem key={v} value={v.toString()} className="text-xs">
                    {getVersionLabel(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              To
            </label>
            <Select
              value={toVersion.toString()}
              onValueChange={(v) => setToVersion(Number(v))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allVersions.map((v) => (
                  <SelectItem key={v} value={v.toString()} className="text-xs">
                    {getVersionLabel(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!loading && diffs.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{changedFiles.length} changed</span>
              {unchangedFiles.length > 0 && (
                <span>· {unchangedFiles.length} unchanged</span>
              )}
            </div>
          )}
        </div>

        {fromVersion === toVersion ? (
          <div className="flex-1 flex items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm">Select different versions to compare</p>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : diffs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm">No files found for this comparison</p>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* File list sidebar */}
            <div className="w-56 flex-shrink-0 border-r flex flex-col">
              <p className="text-xs font-semibold text-muted-foreground px-3 py-2 border-b">
                Files
              </p>
              <ScrollArea className="flex-1">
                <div className="py-1">
                  {diffs.map((file) => {
                    const cfg = statusConfig[file.status];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={file.path}
                        onClick={() => setSelectedFile(file)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent/50 transition-colors text-left",
                          selectedFile?.path === file.path && "bg-primary/10",
                        )}
                      >
                        <Icon className={cn("h-3 w-3 flex-shrink-0", cfg.color)} />
                        <span className="truncate">{file.path}</span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Diff viewer */}
            <div className="flex-1 min-w-0 overflow-auto">
              {selectedFile ? (
                selectedFile.status === "unchanged" ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p className="text-sm">No changes in this file</p>
                  </div>
                ) : selectedFile.status === "added" ? (
                  <div className="p-4">
                    <p className="text-xs text-green-600 mb-2 font-semibold">
                      File added in v{toVersion}
                    </p>
                    <ReactDiffViewer
                      oldValue=""
                      newValue={parseDiff(selectedFile.diff).newContent}
                      splitView={false}
                      useDarkTheme={theme === "dark"}
                      compareMethod={DiffMethod.WORDS}
                      hideLineNumbers={false}
                      {...diffViewerStyles}
                    />
                  </div>
                ) : selectedFile.status === "removed" ? (
                  <div className="p-4">
                    <p className="text-xs text-red-600 mb-2 font-semibold">
                      File removed in v{toVersion}
                    </p>
                    <ReactDiffViewer
                      oldValue={parseDiff(selectedFile.diff).oldContent}
                      newValue=""
                      splitView={false}
                      useDarkTheme={theme === "dark"}
                      compareMethod={DiffMethod.WORDS}
                      hideLineNumbers={false}
                      {...diffViewerStyles}
                    />
                  </div>
                ) : (
                  <div className="p-4">
                    <ReactDiffViewer
                      oldValue={parseDiff(selectedFile.diff).oldContent}
                      newValue={parseDiff(selectedFile.diff).newContent}
                      splitView={true}
                      useDarkTheme={theme === "dark"}
                      compareMethod={DiffMethod.WORDS}
                      leftTitle={`v${fromVersion}`}
                      rightTitle={`v${toVersion}`}
                      {...diffViewerStyles}
                    />
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p className="text-sm">Select a file to view its diff</p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const diffViewerStyles = {
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
