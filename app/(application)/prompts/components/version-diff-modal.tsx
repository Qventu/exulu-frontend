"use client";

/**
 * VersionDiffModal — side-by-side or unified diff between two prompt
 * versions (work item 2.9; prompts.md inventory item 42).
 *
 * Responsive (prompts.md §3 "Diff modal (< md): splitView={false}"; T8):
 * split view at `md+` ONLY — unified inline at phones via a media-query
 * watcher (the dialog stays `max-w-5xl` so it fills the desktop pane; below
 * md the diff component itself goes inline rather than shrinking columns to
 * slivers).
 *
 * All copy is i18n; diff colors and version-picker labels unchanged.
 */

import { ArrowRight, GitCompare } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

import { RelativeTime } from "@/components/primitives/relative-time";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PromptLibrary, PromptVersion } from "@/types/models/prompt-library";

interface VersionDiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: PromptLibrary;
  version: PromptVersion;
  compareVersion?: PromptVersion | null;
}

function useIsMdUp(): boolean {
  const [isMdUp, setIsMdUp] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 768px)");
    const update = () => setIsMdUp(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return isMdUp;
}

export function VersionDiffModal({
  open,
  onOpenChange,
  prompt,
  version,
  compareVersion: initialCompareVersion,
}: VersionDiffModalProps) {
  // Derived from the parent's version. When the parent passes a different
  // `version` prop (selected from history), the seed key flips and React
  // re-mounts the selectors — preferable to the legacy useEffect→setState
  // pattern (react-hooks/set-state-in-effect).
  return (
    <DiffDialog
      key={`diff-${version.version}`}
      open={open}
      onOpenChange={onOpenChange}
      prompt={prompt}
      initialLeft={initialCompareVersion ?? null}
      initialRight={version}
    />
  );
}

function DiffDialog({
  open,
  onOpenChange,
  prompt,
  initialLeft,
  initialRight,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: PromptLibrary;
  initialLeft: PromptVersion | null;
  initialRight: PromptVersion;
}) {
  const t = useTranslations("prompts");
  const { theme } = useTheme();
  const isMdUp = useIsMdUp();
  const [leftVersion, setLeftVersion] = useState<PromptVersion | null>(initialLeft);
  const [rightVersion, setRightVersion] = useState<PromptVersion>(initialRight);

  const history = prompt.history ?? [];
  const currentVersionNum = history.length > 0
    ? Math.max(...history.map((v) => v.version)) + 1
    : 1;
  const currentVersion: PromptVersion = {
    version: currentVersionNum,
    content: prompt.content,
    name: prompt.name,
    description: prompt.description,
    tags: prompt.tags,
    timestamp: prompt.updatedAt,
    changed_by: prompt.created_by,
    change_message: undefined,
  };

  const allVersions = [currentVersion, ...history].sort(
    (a, b) => b.version - a.version,
  );

  const leftContent = leftVersion?.content ?? prompt.content;
  const rightContent = rightVersion.content;

  const nameChanged =
    leftVersion !== null && leftVersion.name !== rightVersion.name;
  const descriptionChanged =
    leftVersion !== null &&
    (leftVersion.description ?? "") !== (rightVersion.description ?? "");
  const tagsChanged =
    leftVersion !== null &&
    JSON.stringify(leftVersion.tags ?? []) !==
      JSON.stringify(rightVersion.tags ?? []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-5xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare aria-hidden="true" className="size-5 text-primary" />
            {t("diff.title")}
          </DialogTitle>
          <DialogDescription>{t("diff.description")}</DialogDescription>
        </DialogHeader>

        {/* Version Selectors — stack at phone widths so they fit. */}
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="block text-xs font-semibold text-muted-foreground">
              {t("diff.compareFrom")}
            </label>
            <Select
              value={leftVersion?.version.toString() ?? "current"}
              onValueChange={(value) => {
                if (value === "current") {
                  setLeftVersion(null);
                } else {
                  const found = allVersions.find(
                    (v) => v.version.toString() === value,
                  );
                  if (found) setLeftVersion(found);
                }
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allVersions.map((v) => (
                  <SelectItem key={v.version} value={v.version.toString()}>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs">v{v.version}</span>
                      {v.version === currentVersionNum ? (
                        <Badge variant="secondary" className="text-xs">
                          {t("diff.currentLabel")}
                        </Badge>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ArrowRight
            aria-hidden="true"
            className="mb-2 hidden size-4 text-muted-foreground sm:block"
          />

          <div className="flex-1 space-y-1.5">
            <label className="block text-xs font-semibold text-muted-foreground">
              {t("diff.compareTo")}
            </label>
            <Select
              value={rightVersion.version.toString()}
              onValueChange={(value) => {
                const found = allVersions.find(
                  (v) => v.version.toString() === value,
                );
                if (found) setRightVersion(found);
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allVersions.map((v) => (
                  <SelectItem key={v.version} value={v.version.toString()}>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs">v{v.version}</span>
                      {v.version === currentVersionNum ? (
                        <Badge variant="secondary" className="text-xs">
                          {t("diff.currentLabel")}
                        </Badge>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Metadata changes summary */}
        {nameChanged || descriptionChanged || tagsChanged ? (
          <div className="space-y-2 border-b border-border py-3">
            <p className="text-xs font-semibold text-muted-foreground">
              {t("diff.metadataChanges")}
            </p>
            {nameChanged ? (
              <DiffMetaRow
                label={t("diff.metaName")}
                left={leftVersion?.name ?? "—"}
                right={rightVersion.name ?? "—"}
              />
            ) : null}
            {descriptionChanged ? (
              <DiffMetaRow
                label={t("diff.metaDescription")}
                left={leftVersion?.description ?? t("diff.none")}
                right={rightVersion.description ?? t("diff.none")}
              />
            ) : null}
            {tagsChanged ? (
              <div className="text-sm">
                <span className="mr-2 font-semibold">
                  {t("diff.metaTags")}
                </span>
                <span className="inline-flex flex-wrap items-center gap-2">
                  {leftVersion?.tags?.map((tag) => (
                    <Badge
                      key={`l-${tag}`}
                      variant="outline"
                      className="text-xs line-through"
                    >
                      {tag}
                    </Badge>
                  ))}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-3 text-muted-foreground"
                  />
                  {rightVersion.tags?.map((tag) => (
                    <Badge
                      key={`r-${tag}`}
                      variant="secondary"
                      className="text-xs"
                    >
                      {tag}
                    </Badge>
                  ))}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Content diff */}
        <div className="min-h-0 flex-1 overflow-auto rounded-md border">
          <ReactDiffViewer
            oldValue={leftContent}
            newValue={rightContent}
            splitView={isMdUp}
            useDarkTheme={theme === "dark"}
            compareMethod={DiffMethod.WORDS}
            leftTitle={`v${leftVersion?.version ?? currentVersionNum}`}
            rightTitle={`v${rightVersion.version}`}
          />
        </div>

        {leftContent === rightContent ? (
          <p className="py-3 text-center text-sm text-muted-foreground">
            {t("diff.noContentChanges")}
          </p>
        ) : null}

        {/* Footer hint: absolute timestamps via the shared RelativeTime tooltip. */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            v{leftVersion?.version ?? currentVersionNum} —{" "}
            <RelativeTime
              date={leftVersion?.timestamp ?? prompt.updatedAt}
              className="text-xs"
            />
          </span>
          <span>
            v{rightVersion.version} —{" "}
            <RelativeTime date={rightVersion.timestamp} className="text-xs" />
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DiffMetaRow({
  label,
  left,
  right,
}: {
  label: string;
  left: string;
  right: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold">{label}</span>
      <span className="font-mono text-xs text-muted-foreground line-through">
        {left}
      </span>
      <ArrowRight
        aria-hidden="true"
        className="size-3 text-muted-foreground"
      />
      <span className="font-mono text-xs">{right}</span>
    </div>
  );
}
