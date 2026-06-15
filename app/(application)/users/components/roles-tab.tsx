"use client";

/**
 * Roles tab (access.md §3 — "Roles tab"). Surfaces the redesigned roles list:
 *  - Toolbar (client-side name search across the loaded page).
 *  - DataTable: Role (Shield + name + "System" badge), Permissions (covers
 *    ALL 7 areas including Evals + Budgets — fixes U3), Updated.
 *  - Row click + "New role" both open the RoleDetailPanel (Sheet); creating
 *    uses a sentinel selection.
 *  - Pagination via DataTable footer; primary action is rendered by
 *    AccessSurface in the PageHeader.
 */

import type { ColumnDef } from "@tanstack/react-table";
import { Shield } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/types/models/user-role";

import { useUserRolesQuery } from "../hooks";
import { RoleDetailPanel } from "./role-detail-panel";

export interface RolesTabProps {
  /** "create" sentinel triggers a fresh RoleDetailPanel in create mode. */
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

// Tab-namespaced URL key — switching to another tab and back preserves this.
const PARAM_SEARCH = "rolesQ";
const RESERVED = new Set(["admin", "default"]);

type RoleArea =
  | "agents"
  | "workflows"
  | "variables"
  | "users"
  | "api"
  | "evals"
  | "budget_management";

const AREA_KEYS: ReadonlyArray<{ field: RoleArea; key: string }> = [
  { field: "agents", key: "agents" },
  { field: "workflows", key: "workflows" },
  { field: "variables", key: "variables" },
  { field: "users", key: "users" },
  { field: "api", key: "api" },
  { field: "evals", key: "evals" },
  { field: "budget_management", key: "budgets" },
];

function formatPermissionLevel(value: string | null | undefined): "write" | "read" | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (
    v.includes("write") ||
    v.includes("create") ||
    v.includes("update") ||
    v.includes("delete")
  ) {
    return "write";
  }
  if (v.includes("read") || v.includes("view")) return "read";
  return null;
}

export function RolesTab({ createOpen, onCreateOpenChange }: RolesTabProps) {
  const t = useTranslations("access.roles");
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

  const { roles, pageInfo, loading, error, refetch, setPage } =
    useUserRolesQuery();

  const filteredRoles = React.useMemo(() => {
    if (!roles) return undefined;
    if (!urlSearch.trim()) return roles;
    const needle = urlSearch.trim().toLowerCase();
    return roles.filter((role) =>
      role.name.toLowerCase().includes(needle),
    );
  }, [roles, urlSearch]);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Sentinel for create mode — when createOpen is true we render a synthetic
  // "selected" item to drive ListDetail into the panel.
  const CREATE_SENTINEL = "__create__";

  const selected = React.useMemo<UserRole | null>(() => {
    if (createOpen) {
      return {
        id: CREATE_SENTINEL,
        name: "",
      } as UserRole;
    }
    return (
      filteredRoles?.find((role) => role.id === selectedId) ?? null
    );
  }, [createOpen, filteredRoles, selectedId]);

  const columns = React.useMemo<ColumnDef<UserRole>[]>(
    () => [
      {
        id: "role",
        header: t("columns.role"),
        cell: ({ row }) => {
          const role = row.original;
          const reserved = RESERVED.has(role.name);
          return (
            <div className="flex min-w-0 items-center gap-2">
              <Shield className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate font-medium">{role.name}</span>
              {reserved ? (
                <Badge variant="outline" className="text-xs">
                  {t("systemRole")}
                </Badge>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "permissions",
        header: t("columns.permissions"),
        cell: ({ row }) => {
          const role = row.original;
          const items: Array<{ key: string; level: "read" | "write" }> = [];
          for (const { field, key } of AREA_KEYS) {
            const level = formatPermissionLevel(role[field]);
            if (level) items.push({ key, level });
          }
          if (items.length === 0) {
            return (
              <Badge variant="outline" className="text-xs">
                {t("noPermissions")}
              </Badge>
            );
          }
          return (
            <div className="flex flex-wrap gap-1">
              {items.map((item) => (
                <Badge
                  key={item.key}
                  variant="secondary"
                  className="text-xs font-normal"
                >
                  {t(`permissionAreas.${item.key}`)}
                  {" · "}
                  {item.level === "write" ? t("rw") : t("r")}
                </Badge>
              ))}
            </div>
          );
        },
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

      <ListDetail<UserRole>
        detailPresentation="sheet"
        items={filteredRoles}
        selected={selected}
        onSelect={(item) => {
          if (createOpen) onCreateOpenChange(false);
          setSelectedId(item ? (item.id === CREATE_SENTINEL ? null : item.id) : null);
        }}
        getItemId={(item) => item.id}
        detailTitle={(item) =>
          item.id === CREATE_SENTINEL ? t("detail.createTitle") : item.name
        }
        detail={(item) => (
          <RoleDetailPanel
            role={item.id === CREATE_SENTINEL ? null : item}
            onSaved={(id) => {
              onCreateOpenChange(false);
              setSelectedId(id || null);
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
          <DataTable<UserRole>
            columns={columns}
            data={filteredRoles}
            loading={loading}
            error={
              error && !roles
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
              title: urlSearch
                ? t("empty.filteredTitle")
                : t("empty.title"),
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
            mobileCard={(row) => {
              const reserved = RESERVED.has(row.name);
              const items: Array<{ key: string; level: "read" | "write" }> = [];
              for (const { field, key } of AREA_KEYS) {
                const level = formatPermissionLevel(row[field]);
                if (level) items.push({ key, level });
              }
              return (
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate font-medium">
                      {row.name}
                    </span>
                    {reserved ? (
                      <Badge variant="outline" className="text-xs">
                        {t("systemRole")}
                      </Badge>
                    ) : null}
                  </div>
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("noPermissions")}
                    </p>
                  ) : (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {items
                        .map(
                          (item) =>
                            `${t(`permissionAreas.${item.key}`)} ${
                              item.level === "write" ? t("rw") : t("r")
                            }`,
                        )
                        .join(" · ")}
                    </p>
                  )}
                </div>
              );
            }}
          />
        }
      />
    </div>
  );
}
