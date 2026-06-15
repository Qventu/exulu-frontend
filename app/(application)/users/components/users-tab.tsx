"use client";

/**
 * Users tab (access.md §3 L1 — "Users tab"). Composes shared primitives:
 *
 *  - Toolbar (debounced search, Role/Team filter Selects gated by
 *    ACCESS_FILTER_*_SUPPORTED), column View slot empty for now.
 *  - DataTable: server-paginated, mobileCard for T1 card-list, EmptyState.
 *  - BulkActionBar: "n selected · Remove" → ConfirmDialog with per-item
 *    error reporting (U4).
 *  - ListDetail: row click opens UserDetailPanel; the panel covers ALL
 *    write actions (role/team change confirmations, reset, delete, danger
 *    zone) — the row OverflowMenu mirrors reset/delete as a quicker path.
 *  - Cross-tab state preservation: search/filter live in URL params under
 *    tab-scoped keys (q, role, team).
 */

import { Columns3, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { BulkActionBar } from "@/components/primitives/bulk-action-bar";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import {
  DataTable,
  type PageInfo,
} from "@/components/primitives/data-table";
import { ListDetail } from "@/components/primitives/list-detail";
import { StatusDot } from "@/components/primitives/status-dot";
import { Toolbar } from "@/components/primitives/toolbar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { User } from "@EXULU_SHARED/models/user";

import {
  ACCESS_FILTER_ROLE_SUPPORTED,
  ACCESS_FILTER_TEAM_SUPPORTED,
} from "../queries";
import {
  useRemoveUsers,
  useUserRolesQuery,
  useTeamsQuery,
  useUsersQuery,
} from "../hooks";
import { AddUserDialog } from "./add-user-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { UserDetailPanel } from "./user-detail-panel";
import { useUserColumns } from "./user-columns";

export interface UsersTabProps {
  viewerId: string | number | undefined;
  viewerIsSuperAdmin: boolean;
  addUserOpen: boolean;
  onAddUserOpenChange: (open: boolean) => void;
}

// Per-tab URL namespace so switching tabs preserves every tab's filters
// (architect contract: round-trip Users→Roles→Users keeps users-tab filters).
const PARAM_SEARCH = "usersQ";
const PARAM_ROLE = "usersRole";
const PARAM_TEAM = "usersTeam";

/** Toggleable user columns (matches column ids in useUserColumns). */
type HideableColumnId = "role" | "team" | "updated";
const HIDEABLE: ReadonlyArray<HideableColumnId> = ["role", "team", "updated"];

export function UsersTab({
  viewerId,
  viewerIsSuperAdmin,
  addUserOpen,
  onAddUserOpenChange,
}: UsersTabProps) {
  const t = useTranslations("access.users");
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-driven, tab-scoped state (only the active tab's params persist —
  // architect note on inactive-tab params).
  const urlSearch = searchParams.get(PARAM_SEARCH) ?? "";
  const urlRole = searchParams.get(PARAM_ROLE) ?? "";
  const urlTeam = searchParams.get(PARAM_TEAM) ?? "";

  const [searchInput, setSearchInput] = React.useState(urlSearch);
  React.useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  const updateUrl = React.useCallback(
    (next: { search?: string; role?: string; team?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      const apply = (key: string, value: string | undefined) => {
        if (value === undefined) return;
        if (value) params.set(key, value);
        else params.delete(key);
      };
      apply(PARAM_SEARCH, next.search);
      apply(PARAM_ROLE, next.role);
      apply(PARAM_TEAM, next.team);
      const query = params.toString();
      router.replace(query ? `?${query}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  const filters = React.useMemo(
    () => ({
      email: urlSearch,
      role: ACCESS_FILTER_ROLE_SUPPORTED ? urlRole || undefined : undefined,
      team: ACCESS_FILTER_TEAM_SUPPORTED ? urlTeam || undefined : undefined,
    }),
    [urlSearch, urlRole, urlTeam],
  );

  const {
    users,
    pageInfo,
    loading,
    error,
    refetch,
    setPage,
  } = useUsersQuery(filters);

  const removeUsers = useRemoveUsers();

  // Roles/teams used by the filter selects — ONLY fetch when the respective
  // schema flag is on, otherwise we'd waste two requests on every render of
  // the Users tab (the legacy bug the architect flagged).
  const rolesQuery = useUserRolesQuery({ skip: !ACCESS_FILTER_ROLE_SUPPORTED });
  const teamsQuery = useTeamsQuery({ skip: !ACCESS_FILTER_TEAM_SUPPORTED });

  // Column-visibility "View" menu (inventory #15) — local state, persisted in
  // sessionStorage so a tab-switch round-trip keeps the user's preference.
  const [hiddenColumns, setHiddenColumns] = React.useState<
    ReadonlySet<HideableColumnId>
  >(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.sessionStorage.getItem("access.users.hiddenColumns");
      if (!raw) return new Set();
      const parsed = JSON.parse(raw) as string[];
      return new Set(
        parsed.filter((id): id is HideableColumnId =>
          (HIDEABLE as readonly string[]).includes(id),
        ),
      );
    } catch {
      return new Set();
    }
  });
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        "access.users.hiddenColumns",
        JSON.stringify(Array.from(hiddenColumns)),
      );
    } catch {
      /* ignore quota */
    }
  }, [hiddenColumns]);
  const toggleColumn = React.useCallback((id: HideableColumnId) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = React.useState<
    string | number | null
  >(null);
  const [resetUser, setResetUser] = React.useState<User | null>(null);
  const [rowDelete, setRowDelete] = React.useState<User | null>(null);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkErrors, setBulkErrors] = React.useState<
    Array<{ item: string; message: string }>
  >([]);

  const selectedUser = React.useMemo(
    () =>
      users?.find((user) => String(user.id) === String(selectedUserId)) ?? null,
    [users, selectedUserId],
  );

  const columns = useUserColumns({
    viewerId,
    viewerIsSuperAdmin,
    onResetPassword: (user) => setResetUser(user),
    onDelete: (user) => setRowDelete(user),
    hiddenColumns,
  });

  const isFiltered =
    urlSearch.length > 0 || urlRole.length > 0 || urlTeam.length > 0;

  const filterControls = (
    <>
      {ACCESS_FILTER_ROLE_SUPPORTED ? (
        <Select
          value={urlRole || "all"}
          onValueChange={(value) =>
            updateUrl({ role: value === "all" ? "" : value })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("filters.allRoles")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allRoles")}</SelectItem>
            {(rolesQuery.roles ?? []).map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {ACCESS_FILTER_TEAM_SUPPORTED ? (
        <Select
          value={urlTeam || "all"}
          onValueChange={(value) =>
            updateUrl({ team: value === "all" ? "" : value })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("filters.allTeams")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allTeams")}</SelectItem>
            {(teamsQuery.teams ?? []).map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {isFiltered ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            updateUrl({ search: "", role: "", team: "" })
          }
        >
          {t("filters.clear")}
        </Button>
      ) : null}
    </>
  );

  const activeFilterCount =
    (ACCESS_FILTER_ROLE_SUPPORTED && urlRole ? 1 : 0) +
    (ACCESS_FILTER_TEAM_SUPPORTED && urlTeam ? 1 : 0);

  // Column-visibility "View" menu (inventory #15) — md+ only; below md the
  // mobile card list has no columns to toggle (responsive.md T1).
  const viewMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Columns3 aria-hidden="true" className="mr-2 size-4" />
          {t("view.label")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("view.toggleColumns")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {HIDEABLE.map((id) => (
          <DropdownMenuCheckboxItem
            key={id}
            checked={!hiddenColumns.has(id)}
            onCheckedChange={() => toggleColumn(id)}
            // Prevent the menu from closing on each toggle.
            onSelect={(event) => event.preventDefault()}
          >
            {t(`columns.${id}`)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        search={{
          value: searchInput,
          onChange: (value) => {
            setSearchInput(value);
            updateUrl({ search: value });
          },
          placeholder: t("searchPlaceholder"),
        }}
        filters={
          ACCESS_FILTER_ROLE_SUPPORTED || ACCESS_FILTER_TEAM_SUPPORTED
            ? filterControls
            : undefined
        }
        activeFilterCount={activeFilterCount}
        onResetFilters={
          isFiltered
            ? () => updateUrl({ search: "", role: "", team: "" })
            : undefined
        }
        view={viewMenu}
      />

      {/*
        Bulk selection bar. The "n selected" count INCLUDES the viewer's row
        if it was selected (e.g. via select-all-on-page) — but the bulk-remove
        action filters the viewer out of the targets, and the dialog warns
        when self-deletion was skipped. Closes the self-lockout hole the row
        OverflowMenu was already guarding against.
      */}
      <BulkActionBar
        count={selectedIds.length}
        onClear={() => setSelectedIds([])}
        actions={[
          {
            label: t("bulk.remove"),
            destructive: true,
            onClick: () => {
              setBulkErrors([]);
              setBulkOpen(true);
            },
          },
        ]}
      />

      <ListDetail<User>
        detailPresentation="sheet"
        items={users}
        selected={selectedUser}
        onSelect={(item) => setSelectedUserId(item ? item.id : null)}
        getItemId={(item) => String(item.id)}
        detailTitle={(item) => item.email}
        detail={(item) => (
          <UserDetailPanel
            user={item}
            viewerId={viewerId}
            viewerIsSuperAdmin={viewerIsSuperAdmin}
            onDelete={async (id) => {
              const result = await removeUsers([
                { id, email: item.email },
              ]);
              if (result.errors.length > 0) {
                throw new Error(result.errors[0].message);
              }
            }}
            onDeleted={() => setSelectedUserId(null)}
          />
        )}
        list={
          <DataTable<User>
            columns={columns}
            data={users}
            loading={loading}
            error={
              error && !users
                ? { message: error.message, onRetry: () => refetch() }
                : null
            }
            pagination={
              pageInfo
                ? { pageInfo: pageInfo as PageInfo, onPageChange: setPage }
                : undefined
            }
            selection={{
              selected: selectedIds,
              onChange: setSelectedIds,
            }}
            onRowClick={(row) => setSelectedUserId(row.id)}
            getRowId={(row) => String(row.id)}
            empty={{
              title: isFiltered ? t("empty.filteredTitle") : t("empty.title"),
              description: isFiltered
                ? t("empty.filteredDescription")
                : t("empty.description"),
              action:
                !isFiltered && viewerIsSuperAdmin
                  ? {
                      label: t("empty.action"),
                      onClick: () => onAddUserOpenChange(true),
                    }
                  : undefined,
            }}
            mobileCard={(row) => {
              const verified = Boolean(
                (row as User & { emailVerified?: unknown }).emailVerified,
              );
              return (
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">
                      {row.email}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      {viewerIsSuperAdmin && row.super_admin ? (
                        <Shield
                          aria-label={t("superAdmin.label")}
                          className="size-3.5 text-warning"
                        />
                      ) : null}
                      <StatusDot
                        status={verified ? "success" : "warning"}
                        label={verified ? t("verified") : t("pending")}
                        className="text-xs"
                      />
                    </div>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {(row.role || t("noRole")) +
                      " · " +
                      (row.team || t("noTeam"))}
                  </p>
                </div>
              );
            }}
          />
        }
      />

      {/* Row-action reset password */}
      {resetUser ? (
        <ResetPasswordDialog
          open={resetUser !== null}
          onOpenChange={(open) => {
            if (!open) setResetUser(null);
          }}
          user={{ id: resetUser.id, email: resetUser.email }}
        />
      ) : null}

      {/* Row-action delete (mirrors the panel's delete) */}
      <ConfirmDialog
        open={rowDelete !== null}
        onOpenChange={(open) => {
          if (!open) setRowDelete(null);
        }}
        variant="destructive"
        title={t("confirmDeleteTitle")}
        description={
          rowDelete
            ? t("confirmDeleteDescription", { email: rowDelete.email })
            : undefined
        }
        confirmLabel={t("confirmDeleteConfirm")}
        onConfirm={async () => {
          if (!rowDelete) return;
          const result = await removeUsers([
            { id: rowDelete.id, email: rowDelete.email },
          ]);
          if (result.errors.length > 0) {
            toast.error(t("deleteFailedTitle"), {
              description: result.errors[0].message,
            });
            throw new Error(result.errors[0].message);
          }
          toast.success(t("deletedTitle"), {
            description: t("deletedDescription", { email: rowDelete.email }),
          });
        }}
      />

      {/* Bulk remove */}
      {(() => {
        // Filter the viewer out of the targets before the dialog renders so
        // the warning + the actual mutation agree on the count. The viewer's
        // id is what the row OverflowMenu's `disabled` flag already protects
        // — the bulk path was the open hole.
        const viewerKey = viewerId !== undefined ? String(viewerId) : null;
        const includesViewer =
          viewerKey !== null && selectedIds.includes(viewerKey);
        const actionableIds = viewerKey
          ? selectedIds.filter((id) => id !== viewerKey)
          : selectedIds;
        return (
          <ConfirmDialog
            open={bulkOpen}
            onOpenChange={setBulkOpen}
            variant="destructive"
            title={t("confirmBulkDeleteTitle", {
              count: actionableIds.length,
            })}
            description={t("confirmBulkDeleteDescription", {
              count: actionableIds.length,
            })}
            warning={
              includesViewer ? t("bulk.selfSkippedWarning") : undefined
            }
            confirmLabel={t("confirmBulkDeleteConfirm")}
            errors={bulkErrors}
            onConfirm={async () => {
              if (actionableIds.length === 0) {
                // Nothing to do — surface why and bail cleanly.
                toast.warning(t("bulk.nothingToRemove"));
                throw new Error("Nothing to remove");
              }
              const targets = (users ?? [])
                .filter((user) => actionableIds.includes(String(user.id)))
                .map((user) => ({ id: user.id, email: user.email }));

              const result = await removeUsers(targets);
              if (result.errors.length > 0) {
                setBulkErrors(
                  result.errors.map((failure) => ({
                    item: failure.email ?? failure.id,
                    message: failure.message,
                  })),
                );
                // Surface partial-success in a non-toxic toast then keep dialog open.
                if (result.successCount > 0) {
                  toast.warning(
                    t("bulk.partialTitle", { count: result.successCount }),
                  );
                }
                throw new Error("Bulk remove had failures");
              }
              // Clear only the IDs that were actually removed; leave the
              // viewer selected if they were in the original selection.
              setSelectedIds((prev) =>
                prev.filter((id) => !actionableIds.includes(id)),
              );
              toast.success(
                t("bulk.successTitle", { count: result.successCount }),
              );
            }}
          />
        );
      })()}

      <AddUserDialog open={addUserOpen} onOpenChange={onAddUserOpenChange} />
    </div>
  );
}
