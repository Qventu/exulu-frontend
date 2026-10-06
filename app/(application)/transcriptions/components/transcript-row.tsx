"use client";

/**
 * TranscriptRow — one row in the merged home list (task-8 brief, Interfaces
 * block — the prop contract is binding, later tasks depend on it).
 *
 * Anatomy: checkbox (faint until a selection exists; disabled + tooltip for
 * kind "job", since bulk actions apply to knowledge items only), title, an
 * amber "Needs review" badge, one summary line, a meta line that degrades
 * quietly when a segment's value is null (pre-backfill rows), an access
 * indicator, and one action button (Review / Open) linking to `row.href`.
 */
import { Lock, Mic, Users, Video, FileAudio } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { RelativeTime } from "@/components/primitives/relative-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { useProjectOptions } from "../hooks";
import { formatDuration, type Mode, type TranscriptRow } from "../types";

export interface TranscriptRowProps {
  row: TranscriptRow;
  currentUserId: number;
  /** Faint until any row is selected (design: "checkboxes are faint until something is selected"). */
  anySelected: boolean;
  selected: boolean;
  /** Absent for kind "job" — bulk actions apply to knowledge items only. */
  onSelectedChange?: (selected: boolean) => void;
}

function RowIcon({ source }: { source: TranscriptRow["source"] }) {
  if (source === "recall") {
    return <Video aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />;
  }
  if (source === "live") {
    return <Mic aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />;
  }
  return <FileAudio aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />;
}

/**
 * Access indicator. `TranscriptRow` intentionally carries only `rightsMode` +
 * `createdBy` (types.ts — the merged view has no per-item RBAC breakdown), so
 * an exact grantee count is only available for kind "job" rows (via `job`'s
 * `target_rbac_users`/`target_rbac_roles`). For a "mine" item shared with a
 * specific set of users/roles/teams, this falls back to the generic mode
 * label rather than fabricating a number.
 */
function AccessIndicator({
  row,
  currentUserId,
  t,
  tMode,
}: {
  row: TranscriptRow;
  currentUserId: number;
  t: ReturnType<typeof useTranslations>;
  tMode: (mode: Exclude<Mode, "private" | "public">) => string;
}) {
  const mode = row.rightsMode ?? "private";

  if (mode === "private") {
    return (
      <span className="inline-flex items-center gap-1">
        <Lock aria-hidden="true" className="size-3" />
        {t("row.onlyYou")}
      </span>
    );
  }

  if (row.createdBy != null && row.createdBy !== currentUserId) {
    return (
      <span className="inline-flex items-center gap-1">
        <Users aria-hidden="true" className="size-3" />
        {t("row.sharedWithYou")}
      </span>
    );
  }

  if (mode === "public") {
    return (
      <span className="inline-flex items-center gap-1">
        <Users aria-hidden="true" className="size-3" />
        {t("row.everyone")}
      </span>
    );
  }

  const count = row.job
    ? (row.job.target_rbac_users?.length ?? 0) +
      (row.job.target_rbac_roles?.length ?? 0)
    : null;

  return (
    <span className="inline-flex items-center gap-1">
      <Users aria-hidden="true" className="size-3" />
      {count != null ? t("row.people", { count }) : tMode(mode)}
    </span>
  );
}

// Named `TranscriptListRow`, not `TranscriptRow` — that identifier is the
// merged-row TYPE from ../types, and page.tsx imports both.
export function TranscriptListRow({
  row,
  currentUserId,
  anySelected,
  selected,
  onSelectedChange,
}: TranscriptRowProps) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const projects = useProjectOptions();

  const projectName = row.projectId
    ? (projects.find((p) => p.id === row.projectId)?.name ?? null)
    : null;

  const sourceLabel =
    row.source === "recall"
      ? t("row.meetingSource")
      : row.source === "live"
        ? t("row.liveSource")
        : null;

  // Meta line segments — omit any whose value is null so a pre-backfill row
  // (speaker_count / project_id added after some items were saved) degrades
  // quietly instead of showing "null" or a stray separator.
  const metaSegments: React.ReactNode[] = [];
  if (sourceLabel) metaSegments.push(<span key="source">{sourceLabel}</span>);
  metaSegments.push(
    <RelativeTime key="date" date={row.recordedAt} />,
  );
  if (row.durationSeconds != null) {
    metaSegments.push(
      <span key="duration">{formatDuration(row.durationSeconds)}</span>,
    );
  }
  if (row.speakerCount != null) {
    metaSegments.push(
      <span key="speakers">{t("row.speakers", { count: row.speakerCount })}</span>,
    );
  }
  if (projectName) {
    metaSegments.push(<span key="project">{projectName}</span>);
  }

  const isJob = row.kind === "job";

  const checkboxNode = (
    <Checkbox
      checked={selected}
      disabled={isJob}
      onCheckedChange={(value) => onSelectedChange?.(value === true)}
      aria-label={isJob ? t("row.bulkDisabled") : tCommon("selectRow")}
      className={cn(
        "transition-opacity",
        !anySelected && !isJob && "opacity-40 hover:opacity-100",
      )}
    />
  );

  return (
    <li className="rounded-lg border">
      <div className="flex items-center gap-3 p-3">
        {isJob ? (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Wrap disabled control in a span so the Tooltip still fires. */}
                <span tabIndex={0} className="inline-flex">
                  {checkboxNode}
                </span>
              </TooltipTrigger>
              <TooltipContent>{t("row.bulkDisabled")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          checkboxNode
        )}

        <RowIcon source={row.source} />

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{row.title}</span>
            {row.state === "needs_review" && (
              <Badge variant="warning" className="shrink-0">
                {t("tabs.needsReview")}
              </Badge>
            )}
            {row.state === "reviewed" && (
              // Quieter than the amber "Needs review" badge (spec: reviewed
              // rows render "with a quieter badge") — signed off, not a
              // call to action.
              <Badge variant="secondary" className="shrink-0">
                {t("row.reviewedBadge")}
              </Badge>
            )}
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {row.summaryLine ??
              (row.state === "needs_review" ? t("row.summaryPending") : null)}
          </p>
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
            {metaSegments.map((segment, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span aria-hidden="true">·</span>}
                {segment}
              </React.Fragment>
            ))}
            <span aria-hidden="true">·</span>
            <AccessIndicator
              row={row}
              currentUserId={currentUserId}
              t={t}
              tMode={(mode) => t(`mode.${mode}`)}
            />
          </div>
        </div>

        <Button asChild variant="outline" size="sm" className="max-md:h-11">
          <Link href={row.href}>
            {row.state === "needs_review" ? t("row.review") : t("row.open")}
          </Link>
        </Button>
      </div>
    </li>
  );
}
