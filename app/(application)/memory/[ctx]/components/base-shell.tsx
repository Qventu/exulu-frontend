"use client";

import { useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";

import { EmptyState } from "@/components/primitives/empty-state";
import { OverflowMenu } from "@/components/primitives/overflow-menu";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { StatCard } from "@/components/primitives/stat-card";

import { type MemoryBase } from "../../components/memory-bases-data";
import { GET_MEMORY_BASE_USAGE, GET_MEMORY_BASES } from "../../queries";
import type { MemoryContext } from "./memory-list-data";
import { MemoryTable } from "./memory-table";
import type { BaseUsage } from "./usage-data";

export function NotFoundBase({ contextId }: { contextId: string }) {
  const t = useTranslations("memory");
  return (
    <PageShell>
      <EmptyState title={t("base.missingFromCode")} description={contextId} action={{ label: t("empty.backToOverview"), href: "/memory" }} />
    </PageShell>
  );
}

export function BaseShell({
  context, initialMine, initialPage, initialUsage,
}: { context: MemoryContext; initialMine: boolean; initialPage: number; initialUsage?: "never" | "stale" }) {
  const t = useTranslations("memory");
  const router = useRouter();
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
        action={<OverflowMenu items={[{ label: t("base.openInKnowledge"), onSelect: () => router.push(`/data/${context.id}`) }]} />}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
          value={usage.data?.memoryBaseUsage?.neverUsed ?? 0}
          caption={t("usage.neverUsedCaption")}
          loading={usage.loading && !usage.data}
        />
      </div>
      {valid ? (
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
      ) : (
        <EmptyState
          title={t("base.invalid", { fields: (context.memoryBase?.missing ?? []).join(", ") })}
          description={t("base.noList")}
        />
      )}
    </PageShell>
  );
}
