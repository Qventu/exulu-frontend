"use client";

/**
 * /variables/usage/[id] — full-page "where is this variable used?" view
 * (Phase 4.5 redesign per variables.md §3).
 *
 * Thin route: a header + summary strip + the shared <UsageList /> primitive.
 * Resolution batching lives in UsageList (no hooks-in-loop — fixes U5). The
 * error vs not-found gate is split (U19): inline error with Retry vs a true
 * EmptyState for missing.
 */

import { useQuery } from "@apollo/client";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { UsageList } from "@/app/(application)/variables/components/usage-list";
import { EmptyState } from "@/components/primitives/empty-state";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GET_VARIABLE_BY_ID,
  GET_VARIABLE_USAGE,
} from "@/queries/queries";

export const dynamic = "force-dynamic";

export default function VariableUsagePage() {
  const params = useParams();
  const t = useTranslations("variables");
  const tCommon = useTranslations("common");
  const variableId = params.variable_id as string;

  const {
    loading: metaLoading,
    error: metaError,
    data: metaData,
    refetch: refetchMeta,
  } = useQuery(GET_VARIABLE_BY_ID, {
    variables: { id: variableId },
    skip: !variableId,
  });

  const usageQuery = useQuery(GET_VARIABLE_USAGE, {
    variables: { id: variableId },
    skip: !variableId,
    errorPolicy: "all",
  });

  const variable = metaData?.variableById as
    | {
        id: string;
        name: string;
        encrypted: boolean;
        createdAt: string;
        updatedAt: string;
      }
    | null
    | undefined;

  const usedBy: string[] | null | undefined =
    (usageQuery.data?.variableById as { used_by?: string[] | null } | null)
      ?.used_by ?? (usageQuery.error ? null : undefined);

  if (metaLoading) {
    return (
      <PageShell>
        <PageHeader
          title={t("usage.title")}
          breadcrumb={{ label: t("title"), href: "/variables" }}
        />
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageShell>
    );
  }

  // U19: connection failure → inline error + Retry.
  if (metaError && !variable) {
    return (
      <PageShell>
        <PageHeader
          title={t("usage.title")}
          breadcrumb={{ label: t("title"), href: "/variables" }}
        />
        <EmptyState
          variant="error"
          title={t("edit.loadErrorTitle")}
          description={t("edit.loadErrorBody")}
          action={{ label: tCommon("retry"), onClick: () => void refetchMeta() }}
        />
      </PageShell>
    );
  }

  // U19: missing → not-found EmptyState (distinct from error).
  if (!variable) {
    return (
      <PageShell>
        <PageHeader
          title={t("usage.title")}
          breadcrumb={{ label: t("title"), href: "/variables" }}
        />
        <EmptyState
          title={t("edit.notFoundTitle")}
          description={t("edit.notFoundBody")}
          action={{ label: t("actions.back"), href: "/variables" }}
        />
      </PageShell>
    );
  }

  const count = Array.isArray(usedBy) ? usedBy.length : null;

  return (
    <PageShell>
      <PageHeader
        title={t("usage.title")}
        description={t("usage.description", { name: variable.name })}
        breadcrumb={{ label: t("title"), href: "/variables" }}
      />

      {/* Quiet summary strip — no card wrapper (philosophy §4). */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-mono font-medium">{variable.name}</span>
        <Badge variant={variable.encrypted ? "default" : "outline"}>
          {variable.encrypted ? t("type.secret") : t("type.plain")}
        </Badge>
        {count !== null ? (
          <Badge variant="secondary" className="font-normal">
            {t("usage.countShort", { count })}
          </Badge>
        ) : (
          <span className="text-muted-foreground">
            {t("usedBy.unavailable")}
          </span>
        )}
      </div>

      <UsageList usedBy={usedBy} />
    </PageShell>
  );
}
