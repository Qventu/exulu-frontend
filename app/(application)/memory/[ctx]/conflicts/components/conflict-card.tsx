"use client";

/**
 * One conflict group — near-duplicates or a contradiction — with the
 * per-member Keep action and the group-level Not a duplicate/conflict, Skip
 * and Merge actions (spec §5.3). `canResolve` gates the resolution buttons on
 * authorship; demo mode gates them again since the demo link never maps the
 * resolve/scan/suggest mutations (`lib/demo/resolvers.ts`).
 */
import { useMutation } from "@apollo/client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isDemoMode } from "@/lib/demo/flag";
import { cn } from "@/lib/utils";

import { RESOLVE_MEMORY_CONFLICT } from "../../../queries";
import type { MemoryContext } from "../../components/memory-list-data";
import { type Conflict, type Viewer, canResolve, groupTitle, memberLine } from "./conflicts-data";
import { MergePanel } from "./merge-panel";

/** Tailwind needs the full class name literally in the source to keep it. */
const MEMBER_GRID_COLS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
};

export interface ConflictCardProps {
  group: Conflict;
  context: MemoryContext;
  user: Viewer | undefined;
  onSkip: () => void;
  onResolved: () => void;
}

export function ConflictCard({ group, context, user, onSkip, onResolved }: ConflictCardProps) {
  const t = useTranslations("memory");
  const [resolve] = useMutation(RESOLVE_MEMORY_CONFLICT);
  const actions = canResolve(group, user, t("conflicts.unknown"));
  const demoLocked = isDemoMode();
  const { count } = groupTitle(group);

  const [keepId, setKeepId] = React.useState<string | null>(null);
  const [dismissOpen, setDismissOpen] = React.useState(false);
  const [mergeOpen, setMergeOpen] = React.useState(false);

  // ConfirmDialog: resolve closes it, reject keeps it open — toast + rethrow
  // so the user can retry without losing the dialog.
  const confirmKeep = async () => {
    try {
      await resolve({ variables: { id: group.id, action: "KEEP", keepId } });
      toast.success(t("conflicts.resolved"));
      onResolved();
    } catch (err) {
      toast.error(t("detail.failed"));
      throw err instanceof Error ? err : new Error("keep failed");
    }
  };
  const confirmDismiss = async () => {
    try {
      await resolve({ variables: { id: group.id, action: "NOT_CONFLICT" } });
      toast.success(t("conflicts.resolved"));
      onResolved();
    } catch (err) {
      toast.error(t("detail.failed"));
      throw err instanceof Error ? err : new Error("dismiss failed");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge>{t(`conflicts.${group.kind}`)}</Badge>
          <span className="text-xs text-muted-foreground">{t("conflicts.similarity", { percent: Math.round(group.similarity * 100) })}</span>
        </div>
        <CardTitle className="text-base font-semibold">
          {group.kind === "duplicate" ? t("conflicts.duplicateTitle", { count }) : group.reason}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className={cn("grid gap-3", MEMBER_GRID_COLS[Math.min(group.members.length, 3)])}>
          {group.members.map((member) => (
            <div key={member.id} className="flex flex-col gap-2 rounded-md border p-3">
              <p className="text-sm">{member.information}</p>
              <p className="text-xs text-muted-foreground">
                {memberLine(member, t("conflicts.unknown"))} · <RelativeTime date={member.createdAt} />
              </p>
              <p className="text-xs text-muted-foreground">{t("conflicts.usedTimes", { count: member.usedCount })}</p>
              <Button variant="outline" size="sm" disabled={!actions.keep || demoLocked} onClick={() => setKeepId(member.id)}>
                {t("conflicts.keepThis")}
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" disabled={!actions.dismiss || demoLocked} onClick={() => setDismissOpen(true)}>
            {group.kind === "duplicate" ? t("conflicts.notDuplicate") : t("conflicts.notConflict")}
          </Button>
          <Button variant="ghost" onClick={onSkip}>{t("conflicts.skip")}</Button>
          {group.kind === "duplicate" && (
            <Button disabled={!actions.merge || demoLocked} onClick={() => setMergeOpen(true)}>{t("conflicts.merge")}</Button>
          )}
        </div>
        {actions.blockedBy && <p className="text-xs text-muted-foreground">{t("conflicts.blocked", { author: actions.blockedBy })}</p>}
      </CardContent>
      <ConfirmDialog
        open={keepId !== null}
        onOpenChange={(open) => { if (!open) setKeepId(null); }}
        variant="default"
        title={t("conflicts.keepTitle")}
        description={t("conflicts.keepDescription", { count: group.members.length - 1 })}
        onConfirm={confirmKeep}
      />
      <ConfirmDialog
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        title={t("conflicts.dismissTitle")}
        description={t("conflicts.dismissDescription")}
        onConfirm={confirmDismiss}
      />
      {group.kind === "duplicate" && (
        <MergePanel open={mergeOpen} onOpenChange={setMergeOpen} group={group} context={context} onMerged={onResolved} />
      )}
    </Card>
  );
}
