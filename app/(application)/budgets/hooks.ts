"use client";

/**
 * Data hooks for /budgets — monitoring-first redesign (budgets.md §3).
 *
 * Three concerns:
 *  1. `useBudgetsAtRisk` — composes the 5 paginated GraphQL queries
 *     (limit=20) and runs `computeBudgetProjection` on every row, mapping
 *     warn/over results into `AttentionItem`s with deep-link `href`s into
 *     the L2 config table. Mirrors `(home)/hooks.ts useBudgetAlerts` to the
 *     byte (the AttentionList primitive's first dedicated consumer beyond
 *     the Today page). Documented limitation: scan caps at the first page
 *     per type, so a tenant with >20 entities of a type and a quiet first
 *     page can miss an over-budget row in the alert list — same fallback
 *     the Today page already accepts (dashboard.md).
 *  2. `useBudgetSettings` — single eager `getSettings` per page visit
 *     (budgets.md item 12); failure surfaces in the chip as "—" with an
 *     inline retry, fixing today's silently swallowed catch.
 *  3. `useEntityList` — wraps the L2 entity-config table's per-type paginated
 *     Apollo query. PAGE_SIZE = 10 per budgets.md Risk note (raising to 25
 *     pending backend batching/caching verification — each row triggers a
 *     live LiteLLM lookup, so 5→25 = 5× backend cost per page).
 */

import { useApolloClient, useQuery, type DocumentNode } from "@apollo/client";
import * as React from "react";

import { budgetsApi, type BudgetSettings } from "@/lib/api/budgets";
import {
  computeBudgetProjection,
  type BudgetEntityType,
  type BudgetInfo,
  type BudgetLevel,
} from "@/lib/budget";

import {
  GET_AGENTS_WITH_BUDGETS,
  GET_PROJECTS_WITH_BUDGETS,
  GET_ROLES_WITH_BUDGETS,
  GET_TEAMS_WITH_BUDGETS,
  GET_USERS_WITH_BUDGETS,
  GET_WORKFLOW_TEMPLATES_WITH_BUDGETS,
} from "./queries";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface EntityRow {
  id: string;
  label: string;
  /** Quiet second-line muted (used only for users where label != email). */
  secondaryLabel: string | null;
  budget: BudgetInfo | null;
}

export interface PageInfo {
  pageCount: number;
  itemCount: number;
  currentPage: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export const EMPTY_PAGE_INFO: PageInfo = {
  pageCount: 1,
  itemCount: 0,
  currentPage: 1,
  hasPreviousPage: false,
  hasNextPage: false,
};

/** L2 page size — 10, NOT 25. See budgets.md Risk note. */
export const ENTITY_PAGE_SIZE = 10;

interface EntitySourceMeta {
  query: DocumentNode;
  root: string;
  /** Server-side filter field for the search box. */
  searchField: string;
}

const ENTITY_SOURCES: Record<BudgetEntityType, EntitySourceMeta> = {
  user: { query: GET_USERS_WITH_BUDGETS, root: "usersPagination", searchField: "email" },
  role: { query: GET_ROLES_WITH_BUDGETS, root: "rolesPagination", searchField: "name" },
  team: { query: GET_TEAMS_WITH_BUDGETS, root: "teamsPagination", searchField: "name" },
  project: { query: GET_PROJECTS_WITH_BUDGETS, root: "projectsPagination", searchField: "name" },
  agent: { query: GET_AGENTS_WITH_BUDGETS, root: "agentsPagination", searchField: "name" },
  routine: { query: GET_WORKFLOW_TEMPLATES_WITH_BUDGETS, root: "workflow_templatesPagination", searchField: "name" },
};

interface EntityItem {
  id: string | number;
  name?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  email?: string | null;
  budget?: BudgetInfo | null;
}

/** Display-name fallback chain — mirrors (home)/hooks.ts and the legacy page.tsx label fn. */
function entityLabel(item: EntityItem): string {
  return (
    item.name ||
    [item.firstname, item.lastname].filter(Boolean).join(" ") ||
    item.email ||
    String(item.id)
  );
}

// ---------------------------------------------------------------------------
// 1. useBudgetsAtRisk — L1 "Budgets at risk" AttentionList
// ---------------------------------------------------------------------------

export interface BudgetAlert {
  id: string;
  entityType: BudgetEntityType;
  name: string;
  level: Exclude<BudgetLevel, "ok">;
  percentUsed: number;
  resetAt: string | null;
}

interface BudgetEntitiesResult {
  [root: string]:
    | { items?: EntityItem[] | null }
    | undefined;
}

const BUDGET_SCAN_VARIABLES = { page: 1, limit: 20, filters: [] };

const BUDGET_SOURCES: Array<{
  entityType: BudgetEntityType;
  query: DocumentNode;
  root: string;
}> = [
  { entityType: "user", query: GET_USERS_WITH_BUDGETS, root: "usersPagination" },
  { entityType: "role", query: GET_ROLES_WITH_BUDGETS, root: "rolesPagination" },
  { entityType: "team", query: GET_TEAMS_WITH_BUDGETS, root: "teamsPagination" },
  { entityType: "project", query: GET_PROJECTS_WITH_BUDGETS, root: "projectsPagination" },
  { entityType: "agent", query: GET_AGENTS_WITH_BUDGETS, root: "agentsPagination" },
  { entityType: "routine", query: GET_WORKFLOW_TEMPLATES_WITH_BUDGETS, root: "workflow_templatesPagination" },
];

/**
 * Composes the 5 entity-type queries and surfaces every row whose budget is
 * at/over its warning band (≥80% used or over-pace/over-budget per
 * `computeBudgetProjection`). Same scan shape as `(home)/hooks.ts
 * useBudgetAlerts` — intentionally duplicated until both consumers prove out
 * (consolidating now risks regressing the Today page).
 */
export function useBudgetsAtRisk(enabled: boolean): {
  alerts: BudgetAlert[];
  loading: boolean;
  error: boolean;
} {
  const options = { variables: BUDGET_SCAN_VARIABLES, skip: !enabled };
  const users = useQuery<BudgetEntitiesResult>(GET_USERS_WITH_BUDGETS, options);
  const roles = useQuery<BudgetEntitiesResult>(GET_ROLES_WITH_BUDGETS, options);
  const teams = useQuery<BudgetEntitiesResult>(GET_TEAMS_WITH_BUDGETS, options);
  const projects = useQuery<BudgetEntitiesResult>(GET_PROJECTS_WITH_BUDGETS, options);
  const agents = useQuery<BudgetEntitiesResult>(GET_AGENTS_WITH_BUDGETS, options);
  const routines = useQuery<BudgetEntitiesResult>(GET_WORKFLOW_TEMPLATES_WITH_BUDGETS, options);
  const results = [users, roles, teams, projects, agents, routines];

  const alerts = React.useMemo<BudgetAlert[]>(() => {
    if (!enabled) return [];
    const data = [users.data, roles.data, teams.data, projects.data, agents.data, routines.data];
    const rows: BudgetAlert[] = [];
    BUDGET_SOURCES.forEach(({ entityType, root }, index) => {
      const items = data[index]?.[root]?.items ?? [];
      for (const item of items) {
        if (!item.budget) continue;
        const projection = computeBudgetProjection(item.budget);
        if (projection.level === "ok") continue;
        rows.push({
          id: `${entityType}-${item.id}`,
          entityType,
          name: entityLabel(item),
          level: projection.level,
          percentUsed: Math.round(projection.percentUsed),
          resetAt: item.budget.budget_reset_at ?? null,
        });
      }
    });
    // Worst first, then by usage.
    return rows.sort((a, b) =>
      a.level === b.level
        ? b.percentUsed - a.percentUsed
        : a.level === "over"
          ? -1
          : 1,
    );
  }, [enabled, users.data, roles.data, teams.data, projects.data, agents.data, routines.data]);

  return {
    alerts,
    loading: enabled && results.some((result) => result.loading && !result.data),
    error: enabled && results.every((result) => Boolean(result.error)),
  };
}

// ---------------------------------------------------------------------------
// 2. useBudgetSettings — eager getSettings on mount + save
// ---------------------------------------------------------------------------

export interface UseBudgetSettingsResult {
  settings: BudgetSettings | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  save: (next: BudgetSettings) => Promise<void>;
}

export function useBudgetSettings(enabled: boolean): UseBudgetSettingsResult {
  const [settings, setSettings] = React.useState<BudgetSettings | null>(null);
  const [loading, setLoading] = React.useState<boolean>(enabled);
  const [error, setError] = React.useState<Error | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    budgetsApi
      .getSettings()
      .then((next) => {
        if (cancelled) return;
        setSettings(next);
      })
      .catch((err) => {
        if (cancelled) return;
        // Fix: budgets.md item 12 — today's `.catch(() => {})` swallows
        // failures so an admin can edit and save over settings that never
        // loaded. Surface it instead.
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, reloadKey]);

  const refetch = React.useCallback(() => {
    setReloadKey((n) => n + 1);
  }, []);

  const save = React.useCallback(async (next: BudgetSettings) => {
    const persisted = await budgetsApi.saveSettings(next);
    setSettings(persisted);
  }, []);

  return { settings, loading, error, refetch, save };
}

// ---------------------------------------------------------------------------
// 3. useEntityList — per-entity-type paginated query (L2 config table)
// ---------------------------------------------------------------------------

export interface UseEntityListResult {
  entities: EntityRow[];
  pageInfo: PageInfo;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useEntityList(
  activeType: BudgetEntityType,
  page: number,
  search: string,
  enabled: boolean,
): UseEntityListResult {
  const client = useApolloClient();
  const [entities, setEntities] = React.useState<EntityRow[]>([]);
  const [pageInfo, setPageInfo] = React.useState<PageInfo>(EMPTY_PAGE_INFO);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const load = React.useCallback(async () => {
    if (!enabled) return;
    const meta = ENTITY_SOURCES[activeType];
    const term = search.trim();
    const filters = term ? [{ [meta.searchField]: { contains: term } }] : [];
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.query({
        query: meta.query,
        variables: { page, limit: ENTITY_PAGE_SIZE, filters },
        fetchPolicy: "network-only",
      });
      const root = data?.[meta.root];
      const items: EntityItem[] = root?.items ?? [];
      const rows: EntityRow[] = items.map((item) => {
        const label = entityLabel(item);
        const secondary =
          activeType === "user" && item.email && item.email !== label
            ? item.email
            : null;
        return {
          id: String(item.id),
          label,
          secondaryLabel: secondary,
          budget: (item.budget as BudgetInfo | null) ?? null,
        };
      });
      setEntities(rows);
      setPageInfo(root?.pageInfo ?? EMPTY_PAGE_INFO);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setEntities([]);
      setPageInfo(EMPTY_PAGE_INFO);
    } finally {
      setLoading(false);
    }
  }, [client, enabled, activeType, page, search]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const refetch = React.useCallback(async () => {
    await load();
  }, [load]);

  return { entities, pageInfo, loading, error, refetch };
}
