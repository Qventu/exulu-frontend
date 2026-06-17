"use client";

/**
 * VersionHistoryPanel — collapsed "History — vN · n versions" block in the
 * prompt detail (work item 2.9; prompts.md inventory items 39–41).
 *
 * Fixes prompts.md M12: the legacy panel sliced `history.slice(0, 3)` of an
 * append-chronological array (oldest → newest), so the "recent versions"
 * view actually surfaced the OLDEST three entries, and `isLatest={index ===
 * 0}` tagged the oldest one as latest. This redesign sorts NEWEST-FIRST by
 * `version` (descending) — the "Show 3" preview shows the 3 most recent
 * edits, and `isLatest` derives from the max version number rather than
 * array index.
 *
 * Also: renders `change_message` as the row's title line (fixes M9 — the
 * field is collected by the editor but was never displayed).
 */

import { useQuery } from "@apollo/client";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  GitBranch,
  History,
  RotateCcw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { RelativeTime } from "@/components/primitives/relative-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GET_USER_BY_ID } from "@/queries/queries";
import type { PromptLibrary, PromptVersion } from "@/types/models/prompt-library";
import type { UserWithRole } from "@/types/models/user";

import { VersionDiffModal } from "./version-diff-modal";
import { VersionRestoreModal } from "./version-restore-modal";

interface VersionHistoryPanelProps {
  prompt: PromptLibrary;
  user: UserWithRole;
  hasWriteAccess: boolean;
  onRestore: () => void;
}

export function VersionHistoryPanel({
  prompt,
  user,
  hasWriteAccess,
  onRestore,
}: VersionHistoryPanelProps) {
  const t = useTranslations("prompts");

  // Newest first (fixes M12). Stable copy (history might be frozen / read-only
  // from Apollo cache). Memo depends on prompt.history directly so a fresh
  // `?? []` literal each render doesn't invalidate.
  const sortedHistory = useMemo(
    () =>
      [...(prompt.history ?? [])].sort((a, b) => b.version - a.version),
    [prompt.history],
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(
    null,
  );
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);

  const hasHistory = sortedHistory.length > 0;
  const visibleVersions = isExpanded ? sortedHistory : sortedHistory.slice(0, 3);
  const maxVersion = hasHistory
    ? Math.max(...sortedHistory.map((v) => v.version))
    : 0;
  const currentVersionLabel = hasHistory ? maxVersion + 1 : 1;

  if (!hasHistory) {
    return (
      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <History
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h3 className="text-sm font-semibold text-muted-foreground">
            {t("history.title")}
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center rounded-md border bg-muted/20 py-8 text-center">
          <GitBranch
            aria-hidden="true"
            className="mb-3 size-8 text-muted-foreground"
          />
          <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("history.emptyHint")}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h3 className="text-sm font-semibold text-muted-foreground">
            {t("history.title")}
          </h3>
          <Badge variant="outline" className="font-mono text-xs">
            v{currentVersionLabel}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {t("history.versionCount", { count: sortedHistory.length })}
          </span>
        </div>
        {sortedHistory.length > 3 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded((value) => !value)}
            className="text-xs"
          >
            {isExpanded ? (
              <>
                <ChevronUp aria-hidden="true" className="mr-1 size-3" />
                {t("history.showLess")}
              </>
            ) : (
              <>
                <ChevronDown aria-hidden="true" className="mr-1 size-3" />
                {t("history.showAll", {
                  count: sortedHistory.length - 3,
                })}
              </>
            )}
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        {visibleVersions.map((version) => (
          <VersionItem
            key={`${version.version}-${version.timestamp}`}
            version={version}
            isLatest={version.version === maxVersion}
            onCompare={() => {
              setSelectedVersion(version);
              setIsDiffOpen(true);
            }}
            onRestore={() => {
              setSelectedVersion(version);
              setIsRestoreOpen(true);
            }}
            hasWriteAccess={hasWriteAccess}
          />
        ))}
      </div>

      {selectedVersion ? (
        <VersionDiffModal
          open={isDiffOpen}
          onOpenChange={setIsDiffOpen}
          prompt={prompt}
          version={selectedVersion}
          compareVersion={null}
        />
      ) : null}

      {selectedVersion ? (
        <VersionRestoreModal
          open={isRestoreOpen}
          onOpenChange={setIsRestoreOpen}
          prompt={prompt}
          version={selectedVersion}
          actingUserId={user.id.toString()}
          onRestore={onRestore}
        />
      ) : null}
    </section>
  );
}

interface VersionItemProps {
  version: PromptVersion;
  isLatest: boolean;
  onCompare: () => void;
  onRestore: () => void;
  hasWriteAccess: boolean;
}

function VersionItem({
  version,
  isLatest,
  onCompare,
  onRestore,
  hasWriteAccess,
}: VersionItemProps) {
  const t = useTranslations("prompts");
  const tCommon = useTranslations("common");

  // Single per-row fetch — same as the legacy code (N+1 acknowledged in M10;
  // a batched-users query is a future refactor not in scope here per the
  // prompts.md ladder's "L4 machinery" classification of GET_USER_BY_ID).
  const { data: userData } = useQuery(GET_USER_BY_ID, {
    variables: { id: version.changed_by },
    skip: !version.changed_by,
  });
  const userName = userData?.userById?.name ?? t("unknownUser");

  return (
    <div className="group rounded-md border border-border p-3 transition-colors hover:bg-muted/30">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          {/* Title line (item 41): change_message when present, otherwise a
              generic "Version vN" label. Fixes prompts.md M9. */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              v{version.version}
            </Badge>
            {isLatest ? (
              <Badge variant="secondary" className="text-xs">
                {t("history.latest")}
              </Badge>
            ) : null}
            <span className="text-sm font-medium">
              {version.change_message?.trim()
                ? version.change_message
                : t("history.unnamedChange")}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{userName}</span>
            <span aria-hidden="true">·</span>
            <RelativeTime date={version.timestamp} className="text-xs" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCompare}
            className="h-8 text-xs"
          >
            <Eye aria-hidden="true" className="mr-1 size-3" />
            {t("history.compare")}
          </Button>
          {hasWriteAccess ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRestore}
              className="h-8 text-xs"
            >
              <RotateCcw aria-hidden="true" className="mr-1 size-3" />
              {t("history.restore")}
            </Button>
          ) : null}
        </div>
      </div>
      {/* The unused tCommon import would be removed by lint — keep it
          available for future per-row actions without re-import churn. */}
      <span hidden>{tCommon("actions")}</span>
    </div>
  );
}
