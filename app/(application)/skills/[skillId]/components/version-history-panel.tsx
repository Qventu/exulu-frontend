"use client";

/**
 * VersionHistoryPanel — Sheet content listing every saved version with the
 * current one pinned and labels/timestamps, plus a Compare button gated
 * `current_version >= 2` (skills.md inventory #65; ladder row 65).
 *
 * The editor's history sheet is the canonical version-history surface
 * (skills.md ladder row 27 / L2-dup resolution). The /skills detail panel
 * uses a compact preview that links here for the full list.
 */

import { formatDistanceToNow } from "date-fns";
import { de, enUS } from "date-fns/locale";
import {
  Clock,
  GitBranch,
  GitCompare,
  History,
  TagIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type { Skill, SkillHistoryEntry } from "../../types";

export interface VersionHistoryPanelProps {
  skill: Skill;
  onCompare: () => void;
}

type VersionRow = SkillHistoryEntry & { isCurrent?: boolean };

export function VersionHistoryPanel({
  skill,
  onCompare,
}: VersionHistoryPanelProps) {
  const t = useTranslations("skills");
  const locale = useLocale();
  const dateLocale = locale === "de" ? de : enUS;

  const history = React.useMemo(
    () => skill.history ?? [],
    [skill.history],
  );
  const currentVersion = skill.current_version ?? 1;

  const rows = React.useMemo<VersionRow[]>(
    () => [
      {
        version: currentVersion,
        created_at: skill.updatedAt,
        label: t("editor.history.currentLabel"),
        isCurrent: true,
      },
      ...history.slice().sort((a, b) => b.version - a.version),
    ],
    [currentVersion, history, skill.updatedAt, t],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <History
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <h3 className="text-sm font-semibold">
            {t("editor.history.title")}
          </h3>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCompare}
          disabled={currentVersion < 2}
          className="gap-1.5"
        >
          <GitCompare className="size-3.5" aria-hidden="true" />
          {t("editor.history.compare")}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {rows.map((row) => (
            <VersionRowCard
              key={row.version}
              row={row}
              dateLocale={dateLocale}
            />
          ))}

          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-8 text-center text-muted-foreground">
              <GitBranch
                className="size-9 text-muted-foreground/60"
                aria-hidden="true"
              />
              <p className="text-sm">
                {t("editor.history.emptyTitle")}
              </p>
              <p className="text-xs">
                {t("editor.history.emptyHint")}
              </p>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function VersionRowCard({
  row,
  dateLocale,
}: {
  row: VersionRow;
  dateLocale: Locale;
}) {
  const t = useTranslations("skills");

  return (
    <div
      className={cn(
        "space-y-1.5 rounded-lg border p-3 transition-colors",
        row.isCurrent
          ? "border-primary/30 bg-primary/5"
          : "bg-card hover:bg-accent/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge
            variant={row.isCurrent ? "default" : "secondary"}
            className="font-mono text-xs"
          >
            v{row.version}
          </Badge>
          {row.isCurrent ? (
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              {t("editor.history.currentBadge")}
            </span>
          ) : null}
        </div>
      </div>

      {row.label && !row.isCurrent ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TagIcon className="size-3" aria-hidden="true" />
          <span className="truncate">{row.label}</span>
        </div>
      ) : null}

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3" aria-hidden="true" />
        <span>
          {formatDistanceToNow(new Date(row.created_at), {
            addSuffix: true,
            locale: dateLocale,
          })}
        </span>
      </div>
    </div>
  );
}

// `Locale` type is provided by date-fns; we just declare the shape we use.
type Locale = typeof enUS;
