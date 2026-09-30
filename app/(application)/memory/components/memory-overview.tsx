"use client";

import { useQuery } from "@apollo/client";
import type { ColumnDef } from "@tanstack/react-table";
import { Bookmark } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { DataTable } from "@/components/primitives/data-table";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { RelativeTime } from "@/components/primitives/relative-time";
import { StatCard } from "@/components/primitives/stat-card";
import { Toolbar } from "@/components/primitives/toolbar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { GET_AGENT_COUNT, GET_MEMORY_BASES } from "../queries";
import {
  type BaseFilterMode,
  type MemoryBase,
  baseState,
  baseSubtitle,
  filterBases,
  overviewTotals,
} from "./memory-bases-data";

const DOCS_URL = "https://docs.exulu.com/building/memory/overview";

/** Invalid and missing-from-code bases render muted across the whole row (not just BaseCell). */
function isBaseMuted(base: MemoryBase): boolean {
  const state = baseState(base);
  return state === "invalid" || state === "missingFromCode";
}

export function AgentChips({
  agents,
  max = 2,
  muted = false,
}: {
  agents: { id: string; name: string }[];
  max?: number;
  muted?: boolean;
}) {
  const t = useTranslations("memory");
  const shown = agents.slice(0, max);
  const rest = agents.slice(max);
  return (
    <span className={cn("flex flex-wrap items-center gap-1", muted && "opacity-70")}>
      {shown.map((a) => (
        <Badge key={a.id} variant="secondary" className="font-normal">{a.name}</Badge>
      ))}
      {rest.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="font-normal">{t("base.moreAgents", { count: rest.length })}</Badge>
          </TooltipTrigger>
          <TooltipContent>{rest.map((a) => a.name).join(", ")}</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

function BaseCell({ base }: { base: MemoryBase }) {
  const t = useTranslations("memory");
  const state = baseState(base);
  const sub = baseSubtitle(base);
  const muted = isBaseMuted(base);
  return (
    <div className={cn("flex flex-col gap-0.5", muted && "text-muted-foreground")}>
      <span className="font-medium">{base.name}</span>
      {state === "invalid" && (
        <span className="text-xs">{t("base.invalid", { fields: base.missing.join(", ") })}</span>
      )}
      {state === "missingFromCode" && <span className="text-xs">{t("base.missingFromCode")}</span>}
      {!muted && sub.kind === "description" && (
        <span className="text-xs text-muted-foreground line-clamp-1">{sub.text}</span>
      )}
      {!muted && sub.kind === "createdWith" && (
        <span className="text-xs text-muted-foreground">{t("base.createdWith", { agent: sub.agent })}</span>
      )}
      {state === "unused" && (
        <span className="text-xs text-muted-foreground">
          {t("base.notUsed")} ·{" "}
          <Link href="/agents" className="underline" onClick={(e) => e.stopPropagation()}>
            {t("base.assign")}
          </Link>
        </span>
      )}
    </div>
  );
}

export function MemoryOverview() {
  const t = useTranslations("memory");
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [mode, setMode] = React.useState<BaseFilterMode>("all");

  const bases = useQuery<{ memoryBases: MemoryBase[] }>(GET_MEMORY_BASES, { fetchPolicy: "cache-and-network" });
  const agents = useQuery<{ agentsPagination: { pageInfo: { itemCount: number } } }>(GET_AGENT_COUNT);

  const all = bases.data?.memoryBases ?? [];
  const rows = React.useMemo(() => filterBases(all, search, mode), [all, search, mode]);
  const totals = overviewTotals(all, agents.data?.agentsPagination.pageInfo.itemCount ?? 0);

  const columns = React.useMemo<ColumnDef<MemoryBase>[]>(
    () => [
      { id: "base", header: t("columns.base"), cell: ({ row }) => <BaseCell base={row.original} /> },
      {
        id: "usedBy",
        header: t("columns.usedBy"),
        cell: ({ row }) => <AgentChips agents={row.original.agents} muted={isBaseMuted(row.original)} />,
      },
      {
        id: "memories",
        header: t("columns.memories"),
        cell: ({ row }) => (
          <span className={cn(isBaseMuted(row.original) && "text-muted-foreground")}>
            {row.original.stats?.total ?? "—"}
          </span>
        ),
      },
      {
        id: "contributors",
        header: t("columns.contributors"),
        cell: ({ row }) => (
          <span className={cn(isBaseMuted(row.original) && "text-muted-foreground")}>
            {row.original.stats?.contributors ?? "—"}
          </span>
        ),
      },
      {
        id: "lastSaved",
        header: t("columns.lastSaved"),
        cell: ({ row }) => (
          <span className={cn(isBaseMuted(row.original) && "text-muted-foreground")}>
            {row.original.stats?.lastSavedAt ? (
              <RelativeTime date={row.original.stats.lastSavedAt} />
            ) : (
              t("stats.never")
            )}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <PageShell>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("stats.bases")} value={totals.bases} loading={bases.loading && !bases.data} />
        <StatCard
          label={t("stats.agents")}
          value={totals.agentsWithMemory}
          caption={t("stats.agentsOf", { count: totals.agentCount })}
          loading={bases.loading && !bases.data}
        />
        <StatCard label={t("stats.memories")} value={totals.memories} loading={bases.loading && !bases.data} />
        <StatCard label={t("stats.contributors")} value={totals.contributors} loading={bases.loading && !bases.data} />
      </div>
      <Toolbar
        search={{ value: search, onChange: setSearch, placeholder: t("filter.searchBases"), debounceMs: 0 }}
        view={
          <Tabs value={mode} onValueChange={(v) => setMode(v as BaseFilterMode)}>
            <TabsList>
              <TabsTrigger value="all">{t("filter.all")}</TabsTrigger>
              <TabsTrigger value="inUse">{t("filter.inUse")}</TabsTrigger>
              <TabsTrigger value="unused">{t("filter.unused")}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <DataTable<MemoryBase>
        columns={columns}
        data={rows}
        loading={bases.loading && !bases.data}
        error={bases.error ? { message: bases.error.message, onRetry: () => bases.refetch() } : null}
        onRowClick={(row) => {
          if (!row.missingFromCode) router.push(`/memory/${row.id}`);
        }}
        getRowId={(row) => row.id}
        empty={{
          icon: Bookmark,
          title: t("empty.basesTitle"),
          description: t("empty.basesDescription"),
          action: { label: t("empty.basesAction"), href: DOCS_URL },
        }}
        mobileCard={(row) => {
          const muted = isBaseMuted(row);
          return (
            <div className="flex flex-col gap-2">
              <BaseCell base={row} />
              <AgentChips agents={row.agents} muted={muted} />
              <span className={cn("text-xs text-muted-foreground", muted && "opacity-70")}>
                {t("columns.memories")}: {row.stats?.total ?? "—"} · {t("columns.contributors")}: {row.stats?.contributors ?? "—"}
              </span>
            </div>
          );
        }}
      />
      <p className="text-xs text-muted-foreground">{t("countsNote")}</p>
    </PageShell>
  );
}
