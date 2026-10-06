"use client";

import { useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { EmptyState } from "@/components/primitives/empty-state";
import { OverflowMenu } from "@/components/primitives/overflow-menu";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { StatCard } from "@/components/primitives/stat-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContextMapCard } from "@/components/widgets/context-map/context-map-card";

import { type MemoryBase } from "../../components/memory-bases-data";
import { GET_MEMORY_BASE_USAGE, GET_MEMORY_BASES, GET_MEMORY_CONFLICT_COUNTS, GET_MEMORY_CONFLICTS } from "../../queries";
import { type MemoryContext } from "./memory-list-data";
import { MemoryTable } from "./memory-table";
import type { BaseUsage } from "./usage-data";

/**
 * The base's three tabs. Conflicts is a link in a tab's clothing: that view is
 * its own shipped route, so the trigger navigates there instead of this shell
 * growing a second copy of it.
 */
type MemoryTab = "overview" | "memories" | "conflicts";

/** One identity for "nothing is ringed", so the card's derivation can rest. */
const NO_ITEM_IDS: Set<string> = new Set();

export function BaseShell({
  context, initialMine, initialPage, initialUsage, initialTab,
}: {
  context: MemoryContext; initialMine: boolean; initialPage: number;
  initialUsage?: "never" | "stale";
  /** The raw `?tab=` value: a URL may say anything, so it is narrowed here. */
  initialTab?: string;
}) {
  const t = useTranslations("memory");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const bases = useQuery<{ memoryBases: MemoryBase[] }>(GET_MEMORY_BASES, { fetchPolicy: "cache-and-network" });
  const base = bases.data?.memoryBases.find((b) => b.id === context.id);
  const stats = base?.stats ?? null;
  const agents = base?.agents ?? [];
  const valid = context.memoryBase?.ok ?? false;
  const usage = useQuery<{ memoryBaseUsage: BaseUsage | null }>(GET_MEMORY_BASE_USAGE, {
    variables: { contextId: context.id, staleDays: 90 },
    fetchPolicy: "cache-and-network",
    skip: !valid,
  });
  const counts = useQuery<{ memoryConflictCounts: { open: number; memoriesInvolved: number; lastScanAt: string | null } }>(
    GET_MEMORY_CONFLICT_COUNTS,
    { variables: { contextId: context.id }, skip: !valid },
  );

  // Overview is the default, and `conflicts` is never an active body: its
  // trigger navigates away, so a hand-typed ?tab=conflicts lands on Overview.
  const tab = initialTab === "memories" ? "memories" : "overview";

  const setTab = (next: MemoryTab) => {
    if (next === "conflicts") {
      router.push(`/memory/${context.id}/conflicts`);
      return;
    }
    const url = new URLSearchParams(params?.toString() ?? "");
    if (next === "overview") url.delete("tab");
    else url.set("tab", next);
    // Switching drops the parameters only the tab being left reads: the list's
    // page and visibility, and the map's selected passage and region. They
    // survive a reload, so a stale one would be reapplied to the wrong view.
    if (next !== "memories") {
      url.delete("page");
      url.delete("mine");
    }
    if (next !== "overview") {
      url.delete("selected");
      url.delete("topic");
    }
    const q = url.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  /**
   * The memories the map rings. `memoryConflicts` is scoped to unresolved
   * groups server-side — which is why the Conflicts route filters none — and
   * it is the same document that route issues, so the two share a cache entry.
   * Only the overview mounts a map, so only the overview pays for the query.
   */
  const conflicts = useQuery<{ memoryConflicts: { id: string; members: { id: string }[] }[] }>(
    GET_MEMORY_CONFLICTS,
    {
      variables: { contextId: context.id },
      fetchPolicy: "cache-and-network",
      skip: !valid || tab !== "overview",
    },
  );
  const conflictGroups = conflicts.data?.memoryConflicts;
  // ITEM ids: the card turns them into passages, because only it holds the
  // answer that records both.
  const ringedItemIds = React.useMemo(() => {
    if (conflictGroups === undefined || conflictGroups.length === 0) return NO_ITEM_IDS;
    const ids = new Set<string>();
    for (const group of conflictGroups) for (const member of group.members) ids.add(member.id);
    return ids;
  }, [conflictGroups]);

  const itemHref = React.useCallback(
    (itemId: string) => `/memory/${context.id}/${itemId}`,
    [context.id],
  );

  // Until memoryBases has answered, `agents` is empty for every base — showing
  // "Not used by any agent" then would claim something the page does not know.
  const usedBy =
    bases.loading && !bases.data ? undefined
    : agents.length === 0 ? t("base.notUsed")
    : agents.length === 1 ? t("base.usedByOne", { agent: agents[0].name })
    : t("base.usedByMore", { agent: agents[0].name, count: agents.length - 1 });

  return (
    <PageShell>
      <PageHeader
        breadcrumb={{ label: t("title"), href: "/memory" }}
        title={context.name}
        description={usedBy}
        action={
          <OverflowMenu
            items={[
              { label: t("base.openInKnowledge"), onSelect: () => router.push(`/data/${context.id}`) },
              { label: t("conflicts.find"), onSelect: () => router.push(`/memory/${context.id}/conflicts`) },
            ]}
          />
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label={t("stats.memories")}
          value={stats?.total ?? 0}
          caption={stats ? t("stats.memoriesSplit", { public: stats.public, private: stats.private }) : undefined}
          loading={bases.loading && !bases.data}
        />
        <StatCard label={t("stats.contributors")} value={stats?.contributors ?? 0} loading={bases.loading && !bases.data} />
        <StatCard
          label={t("stats.lastSaved")}
          value={stats?.lastSavedAt ? new Date(stats.lastSavedAt).toLocaleDateString() : t("stats.never")}
          caption={stats?.lastSavedBy ? t("stats.lastSavedBy", { name: stats.lastSavedBy.name }) : undefined}
          loading={bases.loading && !bases.data}
        />
        <StatCard
          label={t("usage.neverUsedCard")}
          value={usage.error ? "—" : (usage.data?.memoryBaseUsage?.neverUsed ?? 0)}
          caption={usage.error ? undefined : t("usage.neverUsedCaption")}
          loading={usage.loading && !usage.data}
        />
        <StatCard
          label={t("conflicts.card")}
          value={counts.error ? "—" : (counts.data?.memoryConflictCounts?.open ?? 0)}
          caption={counts.data?.memoryConflictCounts?.lastScanAt ? t("conflicts.cardCaption", { count: counts.data.memoryConflictCounts.memoriesInvolved }) : t("conflicts.notScanned")}
          loading={counts.loading && !counts.data}
          href={`/memory/${context.id}/conflicts`}
        />
      </div>
      {valid ? (
        <>
          <Tabs value={tab} onValueChange={(value) => setTab(value as MemoryTab)}>
            <TabsList>
              <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
              <TabsTrigger value="memories">{t("tabs.memories")}</TabsTrigger>
              <TabsTrigger value="conflicts">{t("tabs.conflicts")}</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === "overview" ? (
            <ContextMapCard
              contextId={context.id}
              groupField="type"
              ringedItemIds={ringedItemIds}
              itemHref={itemHref}
              titleKey="memory"
              // A memory base accumulates, so filtering the cloud by when a
              // memory was added answers a real question here. The knowledge
              // workspace does not pass this: those bases ingest in one batch.
              timeline
            />
          ) : (
            <>
              <MemoryTable
                context={context}
                initialMine={initialMine}
                initialPage={initialPage}
                initialUsage={initialUsage}
                onChanged={() => { void bases.refetch(); void usage.refetch(); }}
              />
              {stats && <p className="text-xs text-muted-foreground">{t("base.visibleFooter", { visible: stats.visible, total: stats.total })}</p>}
            </>
          )}
        </>
      ) : (
        <EmptyState
          title={t("base.invalid", { fields: (context.memoryBase?.missing ?? []).join(", ") })}
          description={t("base.noList")}
        />
      )}
    </PageShell>
  );
}
