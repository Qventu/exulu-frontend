"use client";

/**
 * UsageList — shared "where is this variable referenced?" surface.
 *
 * Consumers: the standalone /variables/usage/[id] page AND the variables
 * detail-panel's Usage section. Accepts the raw `used_by` array (string[] of
 * "type/id" pairs) and resolves friendly names via BATCH queries.
 *
 * States (variables.md §3, Phase 4.5):
 *   - null | undefined    → "Usage unavailable" muted state (BE-1 not shipped).
 *   - []                  → quiet EmptyState ("Not referenced …").
 *   - populated           → table of resources, 10/page (client-side).
 *
 * Resolution: a single GET_USERS_BY_IDS and a single GET_AGENTS_BY_IDS call
 * (workflows piggy-back on the agent resolver per the legacy mapping) — never
 * useQuery inside a forEach (the previous bug, U5).
 */

import { useQuery } from "@apollo/client";
import { Bot, User, Workflow } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";

import { CopyButton } from "@/components/primitives/copy-button";
import { EmptyState } from "@/components/primitives/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { GET_AGENTS_BY_IDS, GET_USERS_BY_IDS } from "@/queries/queries";

type ResourceType = "user" | "agent" | "workflow";

interface ParsedResource {
  raw: string;
  type: ResourceType;
  id: string;
}

function parseResource(raw: string): ParsedResource {
  const [typeRaw, ...rest] = raw.split("/");
  const type = (typeRaw as ResourceType) ?? "agent";
  return { raw, type, id: rest.join("/") };
}

function getHref(parsed: ParsedResource): string {
  switch (parsed.type) {
    case "user":
      return `/users/${parsed.id}`;
    case "agent":
      return `/agents/edit/${parsed.id}`;
    case "workflow":
      return `/workflows/${parsed.id}`;
    default:
      return "#";
  }
}

function ResourceIcon({ type }: { type: ResourceType }) {
  switch (type) {
    case "user":
      return <User aria-hidden="true" className="size-4" />;
    case "agent":
      return <Bot aria-hidden="true" className="size-4" />;
    case "workflow":
      return <Workflow aria-hidden="true" className="size-4" />;
    default:
      return null;
  }
}

export interface UsageListProps {
  /**
   * The raw `used_by` array. Pass `null`/`undefined` when the backend has not
   * returned the field (BE-1 unavailable) to render the unavailable state.
   */
  usedBy: string[] | null | undefined;
  pageSize?: number;
  className?: string;
}

export function UsageList({ usedBy, pageSize = 10, className }: UsageListProps) {
  const t = useTranslations("variables");
  const [page, setPage] = React.useState(1);

  // Backend hasn't shipped the field at all → "unavailable" (never "0").
  if (usedBy === null || usedBy === undefined) {
    return (
      <div className={cn("rounded-md border border-dashed p-6", className)}>
        <p className="text-sm text-muted-foreground">
          {t("usedBy.unavailable")}
        </p>
      </div>
    );
  }

  if (usedBy.length === 0) {
    return (
      <EmptyState
        variant="quiet"
        title={t("usage.empty.title")}
        description={t("usage.empty.body")}
        className={className}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(usedBy.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, usedBy.length);
  const currentPage = usedBy.slice(startIndex, endIndex).map(parseResource);

  // Single hook per resource family — never inside a loop (U5).
  const userIds = currentPage.filter((r) => r.type === "user").map((r) => r.id);
  const agentlikeIds = currentPage
    .filter((r) => r.type === "agent" || r.type === "workflow")
    .map((r) => r.id);

  const usersQuery = useQuery<{
    userByIds: Array<{
      id: string;
      name?: string | null;
      firstname?: string | null;
      lastname?: string | null;
      email?: string | null;
    }>;
  }>(GET_USERS_BY_IDS, {
    variables: { ids: userIds },
    skip: userIds.length === 0,
  });

  const agentsQuery = useQuery<{
    agentByIds: Array<{ id: string; name: string }>;
  }>(GET_AGENTS_BY_IDS, {
    variables: { ids: agentlikeIds },
    skip: agentlikeIds.length === 0,
  });

  const userMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const u of usersQuery.data?.userByIds ?? []) {
      const display =
        [u.firstname, u.lastname].filter(Boolean).join(" ").trim() ||
        u.name ||
        u.email ||
        u.id;
      map.set(u.id, display);
    }
    return map;
  }, [usersQuery.data]);

  const agentMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agentsQuery.data?.agentByIds ?? []) {
      map.set(a.id, a.name);
    }
    return map;
  }, [agentsQuery.data]);

  const resolveName = (parsed: ParsedResource): {
    name: string;
    loading: boolean;
    unknown: boolean;
  } => {
    if (parsed.type === "user") {
      if (usersQuery.loading) return { name: "", loading: true, unknown: false };
      const name = userMap.get(parsed.id);
      return name
        ? { name, loading: false, unknown: false }
        : { name: t("usage.unknownUser"), loading: false, unknown: true };
    }
    if (parsed.type === "agent" || parsed.type === "workflow") {
      if (agentsQuery.loading) return { name: "", loading: true, unknown: false };
      const name = agentMap.get(parsed.id);
      if (name) return { name, loading: false, unknown: false };
      return {
        name:
          parsed.type === "agent"
            ? t("usage.unknownAgent")
            : t("usage.unknownRoutine"),
        loading: false,
        unknown: true,
      };
    }
    return { name: parsed.id, loading: false, unknown: true };
  };

  const typeLabel = (type: ResourceType): string => {
    switch (type) {
      case "user":
        return t("usage.resourceType.user");
      case "agent":
        return t("usage.resourceType.agent");
      case "workflow":
        return t("usage.resourceType.workflow");
      default:
        return type;
    }
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <ul className="divide-y rounded-md border">
        {currentPage.map((parsed) => {
          const resolved = resolveName(parsed);
          const href = getHref(parsed);
          const showAsLink = !resolved.unknown;
          const RowOuter: React.ElementType = showAsLink ? Link : "div";
          const rowProps = showAsLink ? { href } : {};
          return (
            <li key={parsed.raw} className="block">
              <RowOuter
                {...rowProps}
                className={cn(
                  "flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3",
                  showAsLink &&
                    "transition-colors duration-150 ease-in-out hover:bg-muted/50 motion-reduce:transition-none",
                )}
              >
                <div className="flex items-center gap-2 sm:w-40">
                  <ResourceIcon type={parsed.type} />
                  <Badge variant="outline" className="font-normal">
                    {typeLabel(parsed.type)}
                  </Badge>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {resolved.loading ? (
                    <Skeleton className="h-4 w-32" />
                  ) : (
                    <span
                      className={cn(
                        "min-w-0 truncate text-sm",
                        resolved.unknown && "text-muted-foreground",
                      )}
                    >
                      {resolved.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="truncate font-mono text-muted-foreground">
                    {parsed.id}
                  </span>
                  <CopyButton
                    value={parsed.id}
                    label={t("usage.copyId")}
                    variant="ghost"
                    size="icon"
                  />
                </div>
              </RowOuter>
            </li>
          );
        })}
      </ul>

      {totalPages > 1 ? (
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {t("usage.range", {
              start: startIndex + 1,
              end: endIndex,
              total: usedBy.length,
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              {t("usage.previous")}
            </Button>
            <span className="text-sm">
              {t("usage.pageOf", { page: safePage, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              {t("usage.next")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
