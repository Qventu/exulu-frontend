"use client";

/**
 * SkillDetailPanel — the right-hand surface for /skills (work item 2.10;
 * skills.md §3 "Detail panel" + inventory items 21-30). Replaces the legacy
 * `SkillPreviewPanel` inline in app/(application)/skills/page.tsx.
 *
 * Sections (skills.md ladder):
 *   - Header: name + vN + description + Open Editor (outline — purple stays
 *     on the page's New Skill CTA).
 *   - SKILL.md preview with 15-line clamp + "Show N more" (items #23-25).
 *     Yellow alert for missing SKILL.md, skeleton while loading.
 *   - Tags section (item #26; absorbs row tags from #17).
 *   - Compact version history: current + last 3 with "View all & compare →"
 *     deep-link into editor history (item #27).
 *   - Access control via <AccessBadge variant="panel" /> + Edit button gated
 *     by hasSkillWriteAccess; RBACControl in modalMode with
 *     allowedModes={['private','users','roles','public']} — fixes H7 (teams
 *     was previously selectable but silently dropped on save).
 *   - Stats footer: versions + uses (with info tooltip explaining the metric;
 *     item #30 + M9 mitigation).
 *
 * Below lg this same component renders inside a Sheet (ListDetail handles
 * the lift). No internal viewport-width assumptions.
 *
 * Additive: Copy skill ID in the panel header overflow menu (P4 use; skills.md
 * inventory addendum bullet at end of §3 ladder).
 */

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronsRight,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FileText,
  GitBranch,
  Info,
  Pencil,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import {
  OverflowMenu,
  type OverflowMenuItem,
} from "@/components/primitives/overflow-menu";
import { RelativeTime } from "@/components/primitives/relative-time";
import { RBACControl } from "@/components/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { skillsApi } from "@/lib/api/skills";
import { cn } from "@/lib/utils";

import { useUniqueSkillTagsLocal, useUpdateSkillLocal } from "../hooks";
import { SKILLS_RBAC_TEAMS_SUPPORTED } from "../queries";
import type { Skill, SkillRBACEntry, SkillRightsMode } from "../types";
import { AccessBadge } from "./access-badge";
import { SkillTagsInput } from "./skill-tags-input";

const PREVIEW_LINES = 15;

/**
 * RBACControl allowedModes when teams are not supported by the backend
 * (SKILLS_RBAC_TEAMS_SUPPORTED = false). Mirrors the prompts editor —
 * see app/(application)/prompts/components/prompt-editor-modal.tsx.
 */
const ALLOWED_MODES_NO_TEAMS = [
  "private",
  "users",
  "roles",
  "public",
] as const;

export interface SkillDetailPanelProps {
  skill: Skill;
  canWrite: boolean;
  onOpenEditor: () => void;
  onRefetch: () => Promise<unknown> | void;
}

export function SkillDetailPanel({
  skill,
  canWrite,
  onOpenEditor,
  onRefetch,
}: SkillDetailPanelProps) {
  const t = useTranslations("skills");
  const tCommon = useTranslations("common");

  // ----- SKILL.md preview ---------------------------------------------------
  const [skillMdContent, setSkillMdContent] = React.useState<string | null>(
    null,
  );
  const [skillMdMissing, setSkillMdMissing] = React.useState(false);
  const [skillMdLoading, setSkillMdLoading] = React.useState(false);
  const [showFullPreview, setShowFullPreview] = React.useState(false);

  React.useEffect(() => {
    setSkillMdContent(null);
    setSkillMdMissing(false);
    setShowFullPreview(false);
    if (!skill.id) return;

    const key = `skills/${skill.id}/v${skill.current_version ?? 1}/SKILL.md`;
    setSkillMdLoading(true);
    skillsApi
      .file(skill.id, key)
      .then(({ content }) => {
        setSkillMdContent(content ?? "");
        setSkillMdMissing(false);
      })
      .catch(() => {
        setSkillMdMissing(true);
        setSkillMdContent(null);
      })
      .finally(() => setSkillMdLoading(false));
  }, [skill.id, skill.current_version]);

  const allLines = skillMdContent?.split("\n") ?? [];
  const previewLines = showFullPreview
    ? allLines
    : allLines.slice(0, PREVIEW_LINES);
  const hasMore = allLines.length > PREVIEW_LINES;

  // ----- Tags editing ------------------------------------------------------
  const [updateSkill, { loading: savingAccess }] = useUpdateSkillLocal();
  const { data: tagsData, loading: tagsLoading } = useUniqueSkillTagsLocal();
  const availableTags = React.useMemo(
    () => tagsData?.getUniqueSkillTags ?? [],
    [tagsData],
  );
  const [editingTags, setEditingTags] = React.useState(false);
  const [pendingTags, setPendingTags] = React.useState<string[]>([]);
  const [savingTags, setSavingTags] = React.useState(false);

  const startEditingTags = () => {
    setPendingTags(skill.tags ?? []);
    setEditingTags(true);
  };

  const handleSaveTags = async () => {
    setSavingTags(true);
    try {
      await updateSkill({ id: skill.id, tags: pendingTags });
      toast.success(t("detail.tagsSaved"));
      setEditingTags(false);
      await onRefetch();
    } catch (err) {
      toast.error(t("detail.tagsFailed"), {
        description: (err as Error).message,
      });
    } finally {
      setSavingTags(false);
    }
  };

  // ----- Access editing ----------------------------------------------------
  const [editingAccess, setEditingAccess] = React.useState(false);
  const [pendingRbac, setPendingRbac] = React.useState<{
    rights_mode: SkillRightsMode;
    users: SkillRBACEntry[];
    roles: SkillRBACEntry[];
    teams: SkillRBACEntry[];
  } | null>(null);

  const handleSaveAccess = async () => {
    if (!pendingRbac) return;
    try {
      await updateSkill({
        id: skill.id,
        rights_mode: pendingRbac.rights_mode,
        RBAC: {
          users: pendingRbac.users,
          roles: pendingRbac.roles,
          teams: pendingRbac.teams,
        },
      });
      toast.success(t("detail.accessSaved"));
      setEditingAccess(false);
      setPendingRbac(null);
      await onRefetch();
    } catch (err) {
      toast.error(t("detail.accessFailed"), {
        description: (err as Error).message,
      });
    }
  };

  // ----- Header overflow (Download .zip, Copy ID) --------------------------
  const [downloading, setDownloading] = React.useState(false);

  const handleDownloadZip = React.useCallback(async () => {
    setDownloading(true);
    const version = skill.current_version ?? 1;
    try {
      const blob = await skillsApi.download(skill.id, version);
      const safeName =
        (skill.name || "skill")
          .replace(/[^a-zA-Z0-9-_]+/g, "-")
          .replace(/^-+|-+$/g, "") || "skill";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}-v${version}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("detail.downloadStarted"));
    } catch (err) {
      toast.error(t("detail.downloadFailed"), {
        description: (err as Error).message,
      });
    } finally {
      setDownloading(false);
    }
  }, [skill.id, skill.current_version, skill.name, t]);

  const handleExportSkill = React.useCallback(async () => {
    setDownloading(true);
    const version = skill.current_version ?? 1;
    try {
      const blob = await skillsApi.download(skill.id, version, "skill");
      const safeName = String(skill.name ?? "skill")
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "") || "skill";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}.skill`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("detail.downloadStarted"));
    } catch (err) {
      toast.error(t("detail.downloadFailed"), {
        description: (err as Error).message,
      });
    } finally {
      setDownloading(false);
    }
  }, [skill.id, skill.current_version, skill.name, t]);

  const handleCopyId = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(skill.id);
      toast.success(tCommon("copied"));
    } catch {
      toast.error(tCommon("copyFailed"));
    }
  }, [skill.id, tCommon]);

  const headerOverflowItems = React.useMemo<OverflowMenuItem[]>(
    () => [
      {
        label: downloading
          ? t("detail.downloadInProgress")
          : t("detail.downloadZip"),
        icon: Download,
        onSelect: () => void handleDownloadZip(),
        disabled: downloading,
      },
      {
        label: t("detail.exportSkill"),
        icon: FileArchive,
        onSelect: () => void handleExportSkill(),
        disabled: downloading,
      },
      {
        label: t("detail.copyInstallPrompt"),
        icon: Copy,
        onSelect: () => {
          void navigator.clipboard.writeText(
            `Install the Exulu skill "${skill.name}"`,
          );
          toast.success(tCommon("copied"));
        },
      },
      {
        label: t("row.copyId"),
        icon: Copy,
        onSelect: () => void handleCopyId(),
      },
    ],
    [downloading, handleDownloadZip, handleExportSkill, handleCopyId, skill.name, t, tCommon],
  );

  // ----- History (compact: current + last 3, link to editor) ---------------
  const fullHistory = skill.history ?? [];
  const recentHistory = fullHistory.slice(-3).reverse(); // newest 3 prior versions
  const hasMoreHistory = fullHistory.length > recentHistory.length;
  const versionCount = fullHistory.length + 1;

  const counts = React.useMemo(
    () => ({
      users: skill.RBAC?.users?.length ?? 0,
      roles: skill.RBAC?.roles?.length ?? 0,
      teams: skill.RBAC?.teams?.length ?? 0,
    }),
    [
      skill.RBAC?.roles?.length,
      skill.RBAC?.users?.length,
      skill.RBAC?.teams?.length,
    ],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 truncate text-xl font-semibold tracking-tight">
              {skill.name}
            </h2>
            <Badge variant="secondary" className="shrink-0 font-mono text-xs">
              v{skill.current_version ?? 1}
            </Badge>
          </div>
          {skill.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {skill.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" onClick={onOpenEditor} className="gap-2">
            <ExternalLink aria-hidden="true" className="size-4" />
            {t("detail.openEditor")}
          </Button>
          <OverflowMenu
            items={headerOverflowItems}
            label={tCommon("actions")}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <div className="space-y-6">
          {/* SKILL.md preview */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
              />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("detail.skillMd")}
              </span>
            </div>

            {skillMdLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : skillMdMissing ? (
              <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-warning"
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    {t("detail.skillMdMissingTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("detail.skillMdMissingDescription")}
                  </p>
                </div>
              </div>
            ) : skillMdContent !== null ? (
              <div className="overflow-hidden rounded-md border bg-muted/30">
                <pre className="whitespace-pre-wrap break-words p-3 text-xs font-mono leading-relaxed">
                  {previewLines.join("\n")}
                  {!showFullPreview && hasMore ? (
                    <span className="text-muted-foreground"> ...</span>
                  ) : null}
                </pre>
                {hasMore ? (
                  <button
                    type="button"
                    onClick={() => setShowFullPreview((v) => !v)}
                    className="flex w-full items-center justify-center gap-1.5 border-t py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    {showFullPreview ? (
                      <>
                        <ChevronUp aria-hidden="true" className="size-3" />
                        {t("detail.showLess")}
                      </>
                    ) : (
                      <>
                        <ChevronDown aria-hidden="true" className="size-3" />
                        {t("detail.showMoreLines", {
                          count: allLines.length - PREVIEW_LINES,
                        })}
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

          <Separator />

          {/* Tags — editable when the viewer has write access (mirrors the
              prompts tag editor; read-only viewers see badges only, and the
              section is hidden entirely when there are no tags and no rights
              to add any). */}
          {canWrite || (skill.tags && skill.tags.length > 0) ? (
            <>
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Tag
                      aria-hidden="true"
                      className="size-3.5 text-muted-foreground"
                    />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("detail.tags")}
                    </span>
                  </div>
                  {canWrite && !editingTags ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 px-2 text-xs"
                      onClick={startEditingTags}
                    >
                      <Pencil aria-hidden="true" className="size-3" />
                      {tCommon("edit")}
                    </Button>
                  ) : null}
                </div>

                {!editingTags ? (
                  skill.tags && skill.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {skill.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("detail.tagsNone")}
                    </p>
                  )
                ) : (
                  <div className="space-y-3 pt-1">
                    <SkillTagsInput
                      value={pendingTags}
                      onChange={setPendingTags}
                      availableTags={availableTags}
                      loading={tagsLoading}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingTags(false);
                          setPendingTags([]);
                        }}
                        disabled={savingTags}
                      >
                        {tCommon("cancel")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void handleSaveTags()}
                        disabled={savingTags}
                        aria-busy={savingTags}
                      >
                        {savingTags ? t("detail.saving") : tCommon("save")}
                      </Button>
                    </div>
                  </div>
                )}
              </section>
              <Separator />
            </>
          ) : null}

          {/* Version history (compact) */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <GitBranch
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
              />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("detail.versionHistory")}
              </span>
            </div>
            <div className="space-y-1.5">
              {/* Current row, pinned on top */}
              <div className="flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-primary">
                    v{skill.current_version ?? 1}
                  </span>
                  <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                    {t("detail.current")}
                  </Badge>
                </div>
                <RelativeTime
                  date={skill.updatedAt}
                  className="text-muted-foreground"
                />
              </div>
              {recentHistory.map((entry) => (
                <div
                  key={entry.version}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-mono font-semibold text-primary">
                      v{entry.version}
                    </span>
                    {entry.label ? (
                      <span className="truncate text-muted-foreground">
                        {entry.label}
                      </span>
                    ) : null}
                  </div>
                  <RelativeTime
                    date={entry.created_at}
                    className="text-muted-foreground"
                  />
                </div>
              ))}
              {hasMoreHistory || fullHistory.length > 0 ? (
                <button
                  type="button"
                  onClick={onOpenEditor}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {t("detail.viewAllAndCompare")}
                  <ChevronsRight aria-hidden="true" className="size-3" />
                </button>
              ) : null}
            </div>
          </section>

          <Separator />

          {/* Access control */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck
                  aria-hidden="true"
                  className="size-3.5 text-muted-foreground"
                />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("detail.accessControl")}
                </span>
              </div>
              {canWrite && !editingAccess ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={() => {
                    setEditingAccess(true);
                    setPendingRbac({
                      rights_mode:
                        (skill.rights_mode as SkillRightsMode) ?? "private",
                      users: (skill.RBAC?.users ?? []) as SkillRBACEntry[],
                      roles: (skill.RBAC?.roles ?? []) as SkillRBACEntry[],
                      teams: (skill.RBAC?.teams ?? []) as SkillRBACEntry[],
                    });
                  }}
                >
                  <Pencil aria-hidden="true" className="size-3" />
                  {tCommon("edit")}
                </Button>
              ) : null}
            </div>

            {!editingAccess ? (
              <AccessBadge
                mode={skill.rights_mode ?? undefined}
                variant="panel"
                counts={counts}
              />
            ) : (
              <div className="space-y-3 pt-1">
                <RBACControl
                  modalMode
                  subjectLabel={t("detail.subjectLabel")}
                  initialRightsMode={
                    (skill.rights_mode as SkillRightsMode) ?? "private"
                  }
                  initialUsers={
                    (skill.RBAC?.users ?? []) as {
                      id: number;
                      rights: "read" | "write";
                    }[]
                  }
                  initialRoles={
                    (skill.RBAC?.roles ?? []) as {
                      id: string;
                      rights: "read" | "write";
                    }[]
                  }
                  initialTeams={
                    (skill.RBAC?.teams ?? []) as {
                      id: string;
                      rights: "read" | "write";
                    }[]
                  }
                  allowedModes={
                    SKILLS_RBAC_TEAMS_SUPPORTED
                      ? undefined
                      : (ALLOWED_MODES_NO_TEAMS as unknown as Array<
                          "private" | "users" | "roles" | "teams" | "public"
                        >)
                  }
                  // 4-arg signature (rights_mode, users, roles, teams).
                  onChange={(rights_mode, users, roles, teams) => {
                    setPendingRbac({
                      rights_mode: rights_mode as SkillRightsMode,
                      users,
                      roles,
                      teams,
                    });
                  }}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingAccess(false);
                      setPendingRbac(null);
                    }}
                    disabled={savingAccess}
                  >
                    {tCommon("cancel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void handleSaveAccess()}
                    disabled={savingAccess || !pendingRbac}
                    aria-busy={savingAccess}
                  >
                    {savingAccess ? t("detail.saving") : tCommon("save")}
                  </Button>
                </div>
              </div>
            )}
          </section>

          <Separator />

          {/* Stats footer. items-start keeps both numbers on the same
              baseline — the Uses label is taller (it carries the Info
              tooltip), so items-end would shift its number up by ~4px. */}
          <section
            className={cn(
              "flex flex-wrap items-start gap-x-8 gap-y-3 pb-2 pt-1",
            )}
          >
            <div>
              <p className="text-2xl font-semibold leading-none">
                {versionCount}
              </p>
              <p className="mt-1.5 inline-flex h-4 items-center text-xs leading-none text-muted-foreground">
                {t("detail.versionsLabel")}
              </p>
            </div>
            <div>
              <p className="text-2xl font-semibold leading-none">
                {skill.usage_count ?? 0}
              </p>
              <p className="mt-1.5 inline-flex h-4 items-center gap-1 text-xs leading-none text-muted-foreground">
                {t("detail.usesLabel")}
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex size-4 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        aria-label={t("detail.usesTooltipLabel")}
                      >
                        <Info aria-hidden="true" className="size-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">
                        {t("detail.usesTooltip")}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
