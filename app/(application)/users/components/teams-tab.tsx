"use client";

/**
 * Teams tab (access.md §3 — "Teams tab"):
 *  - Toolbar (search) + a quiet "Budgets →" link (#53 closes the loop the
 *    current copy only promises).
 *  - DataTable: Team (Building2 + name), Description, Updated.
 *  - Row click + "New team" both open TeamDetailPanel (Sheet).
 */

import type { ColumnDef } from "@tanstack/react-table";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import {
  DataTable,
  type PageInfo,
} from "@/components/primitives/data-table";
import { ListDetail } from "@/components/primitives/list-detail";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Toolbar } from "@/components/primitives/toolbar";
import type { Team } from "@/types/models/team";

import { useTeamsQuery } from "../hooks";
import { TeamDetailPanel } from "./team-detail-panel";

export interface TeamsTabProps {
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

// Tab-namespaced URL key — switching to another tab and back preserves this.
const PARAM_SEARCH = "teamsQ";
const CREATE_SENTINEL = "__create__";

export function TeamsTab({ createOpen, onCreateOpenChange }: TeamsTabProps) {
  const t = useTranslations("access.teams");
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlSearch = searchParams.get(PARAM_SEARCH) ?? "";
  const [searchInput, setSearchInput] = React.useState(urlSearch);
  React.useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  const updateSearch = React.useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(PARAM_SEARCH, value);
      else params.delete(PARAM_SEARCH);
      const query = params.toString();
      router.replace(query ? `?${query}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  const { teams, pageInfo, loading, error, refetch, setPage } =
    useTeamsQuery();

  const filteredTeams = React.useMemo(() => {
    if (!teams) return undefined;
    if (!urlSearch.trim()) return teams;
    const needle = urlSearch.trim().toLowerCase();
    return teams.filter((team) =>
      team.name.toLowerCase().includes(needle),
    );
  }, [teams, urlSearch]);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const selected = React.useMemo<Team | null>(() => {
    if (createOpen) {
      return { id: CREATE_SENTINEL, name: "" } as Team;
    }
    return filteredTeams?.find((team) => team.id === selectedId) ?? null;
  }, [createOpen, filteredTeams, selectedId]);

  const columns = React.useMemo<ColumnDef<Team>[]>(
    () => [
      {
        id: "team",
        header: t("columns.team"),
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate font-medium">
              {row.original.name}
            </span>
          </div>
        ),
      },
      {
        id: "description",
        header: t("columns.description"),
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-md text-sm text-muted-foreground">
            {row.original.description || "—"}
          </span>
        ),
      },
      {
        id: "updated",
        header: t("columns.updated"),
        cell: ({ row }) =>
          row.original.updatedAt ? (
            <RelativeTime
              date={row.original.updatedAt}
              className="text-sm text-muted-foreground"
            />
          ) : null,
      },
    ],
    [t],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Tab header strip: quiet "Budgets →" link sits in the tab header area
          (access.md §3 Teams tab — "A quiet header link Budgets → closes the
          loop"). Placement is above the toolbar so it never reflows under the
          table on short lists. */}
      <div className="flex items-center justify-end">
        <Link
          href="/budgets"
          className="text-xs text-muted-foreground underline-offset-2 transition-colors duration-150 hover:text-foreground hover:underline"
        >
          {t("budgetsLink")}
        </Link>
      </div>
      <Toolbar
        search={{
          value: searchInput,
          onChange: (value) => {
            setSearchInput(value);
            updateSearch(value);
          },
          placeholder: t("searchPlaceholder"),
        }}
      />

      <ListDetail<Team>
        detailPresentation="sheet"
        items={filteredTeams}
        selected={selected}
        onSelect={(item) => {
          if (createOpen) onCreateOpenChange(false);
          setSelectedId(
            item ? (item.id === CREATE_SENTINEL ? null : item.id) : null,
          );
        }}
        getItemId={(item) => item.id}
        detailTitle={(item) =>
          item.id === CREATE_SENTINEL ? t("detail.createTitle") : item.name
        }
        detail={(item) => (
          <TeamDetailPanel
            team={item.id === CREATE_SENTINEL ? null : item}
            onSaved={(id) => {
              // On CREATE: close the Sheet entirely (don't auto-edit the
              // new team — the brief flicker into edit mode reads as "the
              // sheet stays open"). On UPDATE: keep the panel on the just-
              // saved team so the user sees their changes persisted.
              if (createOpen) {
                onCreateOpenChange(false);
                setSelectedId(null);
              } else {
                setSelectedId(id || null);
              }
              refetch();
            }}
            onDeleted={() => {
              setSelectedId(null);
              refetch();
            }}
            onCancelCreate={() => onCreateOpenChange(false)}
          />
        )}
        list={
          <DataTable<Team>
            columns={columns}
            data={filteredTeams}
            loading={loading}
            error={
              error && !teams
                ? { message: error.message, onRetry: () => refetch() }
                : null
            }
            pagination={
              pageInfo
                ? { pageInfo: pageInfo as PageInfo, onPageChange: setPage }
                : undefined
            }
            onRowClick={(row) => {
              if (createOpen) onCreateOpenChange(false);
              setSelectedId(row.id);
            }}
            getRowId={(row) => row.id}
            empty={{
              title: urlSearch ? t("empty.filteredTitle") : t("empty.title"),
              description: urlSearch
                ? t("empty.filteredDescription")
                : t("empty.description"),
              action: urlSearch
                ? undefined
                : {
                    label: t("empty.action"),
                    onClick: () => onCreateOpenChange(true),
                  },
            }}
            mobileCard={(row) => (
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate font-medium">
                    {row.name}
                  </span>
                </div>
                {row.description ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {row.description}
                  </p>
                ) : null}
              </div>
            )}
          />
        }
      />

    </div>
  );
}
