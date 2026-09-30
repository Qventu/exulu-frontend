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
import { GET_MEMORY_BASES } from "../../queries";
import type { MemoryContext } from "./memory-list-data";
import { MemoryTable } from "./memory-table";

export function NotFoundBase({ contextId }: { contextId: string }) {
  const t = useTranslations("memory");
  return (
    <PageShell>
      <EmptyState title={t("base.missingFromCode")} description={contextId} action={{ label: t("empty.back"), href: "/memory" }} />
    </PageShell>
  );
}

export function BaseShell({ context, initialMine, initialPage }: { context: MemoryContext; initialMine: boolean; initialPage: number }) {
  const t = useTranslations("memory");
  const router = useRouter();
  const bases = useQuery<{ memoryBases: MemoryBase[] }>(GET_MEMORY_BASES, { fetchPolicy: "cache-and-network" });
  const base = bases.data?.memoryBases.find((b) => b.id === context.id);
  const stats = base?.stats ?? null;
  const agents = base?.agents ?? [];
  const valid = context.memoryBase?.ok ?? false;

  const usedBy =
    agents.length === 0 ? t("base.notUsed")
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
          label={t("stats.usedBy")}
          value={agents.length}
          caption={agents.length ? agents.slice(0, 3).map((a) => a.name).join(", ") + (agents.length > 3 ? ` ${t("base.moreAgents", { count: agents.length - 3 })}` : "") : t("base.notUsed")}
          loading={bases.loading && !bases.data}
        />
      </div>
      {valid ? (
        <>
          <MemoryTable context={context} initialMine={initialMine} initialPage={initialPage} onChanged={() => { void bases.refetch(); }} />
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
