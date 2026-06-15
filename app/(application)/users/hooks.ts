"use client";

/**
 * Data hooks for /users + the consolidated Roles/Teams tabs (codebase-structure
 * §3.2: redesigned pages do not call useQuery(GET_X) inline). Owns:
 * fetch policies, page state, mutations with refetch wiring, and the secure
 * (CSPRNG) password generator shared across the add-user and reset-password
 * dialogs (U14).
 *
 * Behavior changes from the legacy page:
 * - U10/U19: 30s poll dropped in favor of cache-and-network + refetch-on-focus.
 *   Searching/filtering resets page to 1 (no more landing on empty pages).
 * - U4: bulk remove reports per-item failures (Promise.allSettled) and toasts
 *   only after resolution.
 * - U16: pagination uses pageInfo from the connection (no dead closure).
 *
 * The mandatory `type ne "api"` filter is composed inside the hook and CANNOT
 * be removed by callers — API-key accounts must never appear in the Users tab.
 */

import { useMutation, useQuery } from "@apollo/client";
import * as React from "react";

import type { PageInfo } from "@/components/primitives/data-table";
import type { User } from "@EXULU_SHARED/models/user";
import type { Team } from "@/types/models/team";
import type { UserRole } from "@/types/models/user-role";

import {
  CREATE_TEAM,
  CREATE_USER,
  CREATE_USER_ROLE,
  GET_TEAMS,
  GET_USER_ROLES,
  GET_USERS,
  REMOVE_TEAM_BY_ID,
  REMOVE_USER_BY_ID,
  REMOVE_USER_ROLE_BY_ID,
  RESET_USER_PASSWORD,
  ROLES_PAGE_SIZE,
  TEAMS_PAGE_SIZE,
  UPDATE_TEAM_BY_ID,
  UPDATE_USER_BY_ID,
  UPDATE_USER_ROLE_BY_ID,
  USERS_PAGE_SIZE,
} from "./queries";

/* ----------------------------- Shared helpers ----------------------------- */

/**
 * Cryptographically-secure 12-char password generator (U14). Rejection-sampled
 * to avoid modulo bias. Replaces the Math.random copies in add-user and
 * reset-password.
 */
const PASSWORD_CHARSET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";

export function generateSecurePassword(length = 12): string {
  const charset = PASSWORD_CHARSET;
  const max = 256 - (256 % charset.length); // rejection sampling threshold
  let out = "";
  while (out.length < length) {
    const bytes = new Uint8Array(length * 2);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < max) {
        out += charset[byte % charset.length];
        if (out.length === length) break;
      }
    }
  }
  return out;
}

/* --------------------------------- Users --------------------------------- */

/** Combined filter shape passed to GET_USERS' `[FilterUser]` variable. */
export interface UserFilters {
  email?: string;
  role?: string;
  team?: string;
}

interface UsersConnection {
  pageInfo: PageInfo;
  items: User[];
}

/**
 * Users tab query — debounced search lives in the consumer (Toolbar
 * primitive); this hook receives a stable filter object and resets the page
 * whenever the filters change (U10). The mandatory `{ type: { ne: "api" } }`
 * predicate is appended here and is never optional (architect risk).
 */
export function useUsersQuery(filters: UserFilters) {
  const [page, setPage] = React.useState(1);

  // Reset to page 1 whenever filters change (U10).
  const filtersKey = JSON.stringify(filters);
  React.useEffect(() => {
    setPage(1);
  }, [filtersKey]);

  const composedFilters = React.useMemo(() => {
    const out: Array<Record<string, unknown>> = [];
    if (filters.email && filters.email.trim().length > 0) {
      out.push({ email: { contains: filters.email.trim() } });
    }
    if (filters.role) out.push({ role: { eq: filters.role } });
    if (filters.team) out.push({ team: { eq: filters.team } });
    out.push({ type: { ne: "api" } });
    return out;
  }, [filters.email, filters.role, filters.team]);

  const { data, previousData, loading, error, refetch } = useQuery(GET_USERS, {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
    variables: {
      page,
      limit: USERS_PAGE_SIZE,
      sort: { field: "createdAt", direction: "DESC" },
      filters: composedFilters,
    },
  });

  // Refetch on tab focus (U19 replacement for the 30s poll).
  React.useEffect(() => {
    const onFocus = () => {
      refetch();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch]);

  const connection: UsersConnection | undefined =
    data?.usersPagination ?? previousData?.usersPagination;
  const users: User[] | undefined = connection?.items;
  const pageInfo: PageInfo | undefined = connection?.pageInfo;

  return {
    users,
    pageInfo,
    loading,
    error,
    refetch,
    page,
    setPage,
  };
}

/** Single-user mutation (role / team / super_admin). */
export function useUpdateUser() {
  const [mutate] = useMutation(UPDATE_USER_BY_ID, {
    refetchQueries: [GET_USERS, "GetUsers"],
  });
  return React.useCallback(
    (input: {
      id: string | number;
      role?: string;
      team?: string;
      super_admin?: boolean;
    }) => mutate({ variables: input }),
    [mutate],
  );
}

export interface BulkRemoveResult {
  successCount: number;
  errors: Array<{ id: string; email?: string; message: string }>;
}

/**
 * Bulk remove (U4 fix): Promise.allSettled with per-item error reporting so the
 * caller can render a per-item failure list in the ConfirmDialog `errors` prop.
 */
export function useRemoveUsers() {
  const [removeUser] = useMutation(REMOVE_USER_BY_ID, {
    refetchQueries: [GET_USERS, "GetUsers"],
    awaitRefetchQueries: true,
  });

  return React.useCallback(
    async (targets: Array<{ id: string | number; email?: string }>): Promise<BulkRemoveResult> => {
      const settled = await Promise.allSettled(
        targets.map((target) =>
          removeUser({ variables: { id: target.id } }).then(() => target),
        ),
      );

      const errors: BulkRemoveResult["errors"] = [];
      let successCount = 0;
      settled.forEach((result, index) => {
        const target = targets[index];
        if (result.status === "fulfilled") {
          successCount += 1;
        } else {
          const reason = result.reason;
          const message =
            reason instanceof Error
              ? reason.message
              : typeof reason === "string"
                ? reason
                : "Unknown error";
          errors.push({
            id: String(target.id),
            email: target.email,
            message,
          });
        }
      });
      return { successCount, errors };
    },
    [removeUser],
  );
}

export function useResetPassword() {
  const [mutate] = useMutation(RESET_USER_PASSWORD);
  return React.useCallback(
    (id: string | number, password: string) =>
      mutate({ variables: { id, password } }),
    [mutate],
  );
}

export function useCreateUser() {
  const [mutate] = useMutation(CREATE_USER, {
    refetchQueries: [GET_USERS, "GetUsers"],
    awaitRefetchQueries: true,
  });
  return React.useCallback(
    (input: {
      email: string;
      password?: string;
      type?: string;
      emailVerified?: string;
    }) => mutate({ variables: input }),
    [mutate],
  );
}

/* --------------------------------- Roles --------------------------------- */

interface RolesConnection {
  pageInfo: PageInfo;
  items: UserRole[];
}

export interface UseUserRolesQueryOptions {
  /** Skip the query entirely (e.g. when its consumer is gated off by a flag). */
  skip?: boolean;
}

export function useUserRolesQuery(options: UseUserRolesQueryOptions = {}) {
  const [page, setPage] = React.useState(1);

  const { data, previousData, loading, error, refetch } = useQuery(
    GET_USER_ROLES,
    {
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
      variables: { page, limit: ROLES_PAGE_SIZE },
      skip: options.skip,
    },
  );

  const connection: RolesConnection | undefined =
    data?.rolesPagination ?? previousData?.rolesPagination;

  return {
    roles: connection?.items as UserRole[] | undefined,
    pageInfo: connection?.pageInfo,
    loading,
    error,
    refetch,
    page,
    setPage,
  };
}

export interface RoleFormPayload {
  name: string;
  agents: string | null;
  workflows: string | null;
  variables: string | null;
  users: string | null;
  api: string | null;
  evals: string | null;
  budget_management: string | null;
}

export function useCreateUserRole() {
  const [mutate, { loading }] = useMutation(CREATE_USER_ROLE, {
    refetchQueries: [GET_USER_ROLES, "GetUserRoles"],
    awaitRefetchQueries: true,
  });
  const fn = React.useCallback(
    (input: RoleFormPayload) => mutate({ variables: input }),
    [mutate],
  );
  return [fn, loading] as const;
}

export function useUpdateUserRole() {
  const [mutate, { loading }] = useMutation(UPDATE_USER_ROLE_BY_ID, {
    refetchQueries: [GET_USER_ROLES, "GetUserRoles"],
    awaitRefetchQueries: true,
  });
  const fn = React.useCallback(
    (id: string, input: RoleFormPayload) =>
      mutate({ variables: { id, ...input } }),
    [mutate],
  );
  return [fn, loading] as const;
}

export function useRemoveUserRole() {
  const [mutate, { loading }] = useMutation(REMOVE_USER_ROLE_BY_ID, {
    refetchQueries: [GET_USER_ROLES, "GetUserRoles"],
    awaitRefetchQueries: true,
  });
  const fn = React.useCallback(
    (id: string) => mutate({ variables: { id } }),
    [mutate],
  );
  return [fn, loading] as const;
}

/* --------------------------------- Teams --------------------------------- */

interface TeamsConnection {
  pageInfo: PageInfo;
  items: Team[];
}

export interface UseTeamsQueryOptions {
  /** Skip the query entirely (e.g. when its consumer is gated off by a flag). */
  skip?: boolean;
}

export function useTeamsQuery(options: UseTeamsQueryOptions = {}) {
  const [page, setPage] = React.useState(1);

  const { data, previousData, loading, error, refetch } = useQuery(GET_TEAMS, {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    variables: { page, limit: TEAMS_PAGE_SIZE },
    skip: options.skip,
  });

  const connection: TeamsConnection | undefined =
    data?.teamsPagination ?? previousData?.teamsPagination;

  return {
    teams: connection?.items as Team[] | undefined,
    pageInfo: connection?.pageInfo,
    loading,
    error,
    refetch,
    page,
    setPage,
  };
}

export interface TeamFormPayload {
  name: string;
  description: string | null;
}

export function useCreateTeam() {
  const [mutate, { loading }] = useMutation(CREATE_TEAM, {
    refetchQueries: [GET_TEAMS, "GetTeams"],
    awaitRefetchQueries: true,
  });
  const fn = React.useCallback(
    (input: TeamFormPayload) => mutate({ variables: input }),
    [mutate],
  );
  return [fn, loading] as const;
}

export function useUpdateTeam() {
  const [mutate, { loading }] = useMutation(UPDATE_TEAM_BY_ID, {
    refetchQueries: [GET_TEAMS, "GetTeams"],
    awaitRefetchQueries: true,
  });
  const fn = React.useCallback(
    (id: string, input: TeamFormPayload) =>
      mutate({ variables: { id, ...input } }),
    [mutate],
  );
  return [fn, loading] as const;
}

export function useRemoveTeam() {
  const [mutate, { loading }] = useMutation(REMOVE_TEAM_BY_ID, {
    refetchQueries: [GET_TEAMS, "GetTeams"],
    awaitRefetchQueries: true,
  });
  const fn = React.useCallback(
    (id: string) => mutate({ variables: { id } }),
    [mutate],
  );
  return [fn, loading] as const;
}
