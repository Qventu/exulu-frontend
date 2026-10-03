"use client";

/**
 * /memory/[ctx]/conflicts client shell (spec §5.3): on-demand scan, the list
 * of open duplicate/contradiction groups, and per-group resolution via
 * ConflictCard. `canScan` mirrors the server's resolve/scan rule
 * (access-control.ts: super admin, or `role.agents === "write"`) and is
 * additionally gated by demo mode, since the demo link never maps the
 * scan/resolve/suggest mutations (`lib/demo/resolvers.ts`).
 */
import { useMutation, useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { EmptyState } from "@/components/primitives/empty-state";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isDemoMode } from "@/lib/demo/flag";

import { GET_MEMORY_CONFLICT_COUNTS, GET_MEMORY_CONFLICTS, SCAN_MEMORY_CONFLICTS } from "../../../queries";
import type { MemoryContext } from "../../components/memory-list-data";
import { ConflictCard } from "./conflict-card";
import { type Conflict, scanToastKey } from "./conflicts-data";

type ShellUser = { id?: number; super_admin?: boolean; role?: { agents?: string } } | undefined;

/** Mirrors the server rule the mutations enforce. */
function hasAgentsWrite(user: ShellUser): boolean {
  return !!user?.super_admin || user?.role?.agents === "write";
}

export function ConflictsShell({ context }: { context: MemoryContext }) {
  const t = useTranslations("memory");
  const { user } = React.useContext(UserContext) as { user?: ShellUser };
  const valid = context.memoryBase?.ok ?? false;

  const list = useQuery<{ memoryConflicts: Conflict[] }>(GET_MEMORY_CONFLICTS, {
    variables: { contextId: context.id },
    fetchPolicy: "cache-and-network",
    skip: !valid,
  });
  const counts = useQuery<{ memoryConflictCounts: { open: number; memoriesInvolved: number; lastScanAt: string | null } }>(
    GET_MEMORY_CONFLICT_COUNTS,
    { variables: { contextId: context.id }, fetchPolicy: "cache-and-network", skip: !valid },
  );
  const [scan, scanState] = useMutation(SCAN_MEMORY_CONFLICTS);
  const scanning = scanState.loading;
  const canScan = hasAgentsWrite(user) && !isDemoMode();

  // Hides skipped cards for this visit only — a fresh load (or a rescan's
  // refetch) shows them again.
  const [skipped, setSkipped] = React.useState<Set<string>>(new Set());

  const runScan = async () => {
    try {
      const res = await scan({ variables: { contextId: context.id } });
      const result = res.data?.memoryConflictsScan;
      if (result) {
        toast.success(t(`conflicts.${scanToastKey(result)}`, { open: result.open, unjudged: result.unjudged }));
      }
      await Promise.all([list.refetch(), counts.refetch()]);
    } catch (err) {
      toast.error(t("conflicts.scanFailed", { message: err instanceof Error ? err.message : String(err) }));
    }
  };

  const countsData = counts.data?.memoryConflictCounts;
  const description =
    counts.loading && !counts.data
      ? undefined
      : countsData?.lastScanAt
        ? t("conflicts.lastScan", { when: new Date(countsData.lastScanAt).toLocaleString() })
        : t("conflicts.notScanned");

  const groups = list.data?.memoryConflicts ?? [];
  const visible = groups.filter((g) => !skipped.has(g.id));
  // Both queries resolve independently — wait for whichever is still on its
  // first load before picking an empty state, or "unscanned" can flash ahead
  // of a counts answer that was simply a beat slower than the list.
  const initialLoading = (list.loading && !list.data) || (counts.loading && !counts.data);

  return (
    <PageShell>
      <PageHeader
        breadcrumb={{ label: context.name, href: `/memory/${context.id}` }}
        title={t("conflicts.title")}
        description={description}
        action={
          <Button disabled={!canScan || scanning} onClick={runScan}>
            {scanning ? t("conflicts.scanning") : t("conflicts.find")}
          </Button>
        }
      />
      {!valid ? (
        <EmptyState
          title={t("base.invalid", { fields: (context.memoryBase?.missing ?? []).join(", ") })}
          description={t("base.noList")}
        />
      ) : initialLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : !countsData?.lastScanAt ? (
        <EmptyState title={t("conflicts.unscannedTitle")} description={t("conflicts.unscannedDescription")} />
      ) : visible.length === 0 ? (
        <EmptyState title={t("conflicts.emptyTitle")} description={t("conflicts.emptyDescription")} />
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((group) => (
            <ConflictCard
              key={group.id}
              group={group}
              context={context}
              user={user}
              onSkip={() => setSkipped((prev) => new Set(prev).add(group.id))}
              onResolved={() => { void list.refetch(); void counts.refetch(); }}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
