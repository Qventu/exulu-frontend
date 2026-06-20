"use client";

/**
 * Data hooks for /keys (codebase-structure §3.2: redesigned pages never call
 * useQuery(GET_X) inline). Owns: fetch policies, the 30 s poll (unchanged data
 * behavior, keys-token.md ladder row 13), pagination via pageInfo (fixes U2),
 * mutations + refetch wiring, and the key-generation logic.
 *
 * Key generation (keys-token.md §4 interim fix for U4/U8):
 * - plaintext sourced from crypto.getRandomValues (CSPRNG) instead of
 *   Math.random — SAME `sk_<13>_<13>/<postfix>` shape and charset as before,
 *   so the backend's hash-compare + postfix parsing contract is untouched;
 * - postfix slug sanitized to [a-z0-9_-] (U16);
 * - bcrypt hashing stays in the browser (the documented acceptable interim —
 *   the preferred backend-side generation is a backend work item).
 */

import { useMutation, useQuery } from "@apollo/client";
import bcrypt from "bcryptjs";
import * as React from "react";

import type { PageInfo } from "@/components/primitives/data-table";

import {
  CREATE_API_KEY,
  GET_API_KEYS,
  GET_KEY_AGENTS,
  GET_KEY_PROJECTS,
  GET_KEY_ROLES,
  GET_KEY_TEAMS,
  REMOVE_API_KEY,
  UPDATE_API_KEY_ATTRIBUTION,
  UPDATE_API_KEY_ROLE,
} from "./queries";

export const KEYS_PAGE_SIZE = 10;
const POLL_INTERVAL_MS = 30_000;
const SALT_ROUNDS = 12;
// We never decrypt — the plain key is shown exactly once at creation.

export type KeyScopeMode = "admin" | "agents";

// NOTE: no `email` — the synthetic email embeds the bcrypt credential hash
// and must never be selected by GET_API_KEYS (keys-token.md §4 / U4b).
export interface ApiKeyRow {
  id: string;
  name?: string | null;
  firstname?: string | null;
  last_used?: string | null;
  createdAt: string;
  type?: string | null;
  super_admin?: boolean | null;
  scope_mode?: string | null;
  agent_ids?: string[] | null;
  role?: string | null;
  /** Optional attribution targets (uuid) for LiteLLM cost tracking. */
  team?: string | null;
  project?: string | null;
}

export interface CreateKeyInput {
  name: string;
  scopeMode: KeyScopeMode;
  roleId?: string;
  agentIds?: string[];
  /** Optional attribution targets (uuid). */
  teamId?: string;
  projectId?: string;
}

/** Display name of a key row (name wins over the stored firstname). */
export function keyDisplayName(key: ApiKeyRow): string {
  return key.name || key.firstname || key.id;
}

/**
 * Postfix slug, matching creation: lowercase, spaces→underscores, then
 * restricted to [a-z0-9_-] (keys-token.md §4 / U16). Falls back to "key" so
 * the postfix is never empty.
 */
export function slugifyPostfix(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replaceAll(" ", "_")
    .replace(/[^a-z0-9_-]/g, "");
  return slug || "key";
}

/**
 * The PRE-redesign postfix rule: lowercase, trim, spaces→underscores — other
 * characters (e.g. "Prod/EU", "Köln") flowed through raw (legacy page.tsx
 * behavior / U16). Keys created before sanitization carry THIS postfix in
 * their stored `apikey`, so when it differs from `slugifyPostfix` the detail
 * panel surfaces the legacy variant too — the mask stays matchable in logs
 * for old keys (keys-token.md "NEW: detail panel" row).
 */
export function legacyPostfix(name: string): string {
  return name.toLowerCase().trim().replaceAll(" ", "_");
}

const BASE36 = "abcdefghijklmnopqrstuvwxyz0123456789";

/** CSPRNG base36 string (rejection-sampled — no modulo bias). */
function randomBase36(length: number): string {
  let out = "";
  // 252 = largest multiple of 36 below 256; reject bytes above it.
  const max = 252;
  while (out.length < length) {
    const bytes = new Uint8Array(length * 2);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < max) {
        out += BASE36[byte % 36];
        if (out.length === length) break;
      }
    }
  }
  return out;
}

interface ApiKeysConnection {
  pageInfo: PageInfo;
  items: ApiKeyRow[];
}

export function useApiKeys() {
  const [page, setPage] = React.useState(1);

  const { data, previousData, loading, error, refetch } = useQuery(
    GET_API_KEYS,
    {
      fetchPolicy: "cache-first",
      nextFetchPolicy: "network-only",
      variables: {
        page,
        limit: KEYS_PAGE_SIZE,
        filters: [{ type: { eq: "api" } }],
      },
      // Unchanged data behavior (keys-token.md row 13): keeps last_used and
      // the list fresh; polls re-request the CURRENT page's variables.
      pollInterval: POLL_INTERVAL_MS,
    },
  );

  const connection: ApiKeysConnection | undefined =
    data?.usersPagination ?? previousData?.usersPagination;
  const keys: ApiKeyRow[] | undefined = connection?.items;
  const pageInfo: PageInfo | undefined = connection?.pageInfo;

  const [createApiKey] = useMutation(CREATE_API_KEY);
  const [updateApiKeyRole] = useMutation(UPDATE_API_KEY_ROLE);
  const [updateApiKeyAttribution] = useMutation(UPDATE_API_KEY_ATTRIBUTION);
  const [removeApiKey] = useMutation(REMOVE_API_KEY);

  /**
   * Generates + stores a key, returning the plaintext exactly once.
   * Mutation contract identical to the legacy page: bcrypt hash + "/" +
   * name slug in `apikey`, synthetic hash-based email, role only for admin
   * scope, `super_admin` true for admin scope (the honest UI copy covers
   * this until the backend's scope-semantics decision lands — U1).
   */
  const createKey = React.useCallback(
    async (input: CreateKeyInput): Promise<string> => {
      const plainKey = `sk_${randomBase36(13)}_${randomBase36(13)}`;
      const postfix = `/${slugifyPostfix(input.name)}`;
      const hash = await bcrypt.hash(plainKey, SALT_ROUNDS);
      await createApiKey({
        variables: {
          firstname: input.name,
          type: "api",
          apikey: `${hash}${postfix}`,
          email: `${hash}@exulu-api-user.com`,
          role:
            input.scopeMode === "admin" ? input.roleId || undefined : undefined,
          super_admin: input.scopeMode === "admin",
          scope_mode: input.scopeMode,
          agent_ids: input.scopeMode === "agents" ? input.agentIds : undefined,
          team: input.teamId || undefined,
          project: input.projectId || undefined,
        },
      });
      await refetch();
      return `${plainKey}${postfix}`;
    },
    [createApiKey, refetch],
  );

  const updateRole = React.useCallback(
    async (id: string, roleId: string | null): Promise<void> => {
      await updateApiKeyRole({ variables: { id, role: roleId } });
      await refetch();
    },
    [updateApiKeyRole, refetch],
  );

  const updateAttribution = React.useCallback(
    async (
      id: string,
      next: { teamId?: string | null; projectId?: string | null },
    ): Promise<void> => {
      await updateApiKeyAttribution({
        variables: {
          id,
          team: next.teamId ?? null,
          project: next.projectId ?? null,
        },
      });
      await refetch();
    },
    [updateApiKeyAttribution, refetch],
  );

  const deleteKey = React.useCallback(
    async (id: string): Promise<void> => {
      await removeApiKey({ variables: { id } });
      // Deleting the last row of a later page steps back instead of leaving
      // a ghost-empty page (keys-token.md §4 risks).
      if ((keys?.length ?? 0) <= 1 && page > 1) {
        setPage(page - 1);
      } else {
        await refetch();
      }
    },
    [removeApiKey, refetch, keys, page],
  );

  return {
    keys,
    pageInfo,
    loading,
    error,
    refetch,
    page,
    setPage,
    createKey,
    updateRole,
    updateAttribution,
    deleteKey,
  };
}

/** Team / project id → name lookups for the attribution selectors. */
export function useKeyEntities() {
  const teamsQuery = useQuery(GET_KEY_TEAMS, {
    fetchPolicy: "cache-first",
    variables: { page: 1, limit: 200 },
  });
  const projectsQuery = useQuery(GET_KEY_PROJECTS, {
    fetchPolicy: "cache-first",
    variables: { page: 1, limit: 200 },
  });

  const teams: Array<{ id: string; name: string }> = React.useMemo(
    () => teamsQuery.data?.teamsPagination?.items ?? [],
    [teamsQuery.data],
  );
  const projects: Array<{ id: string; name: string }> = React.useMemo(
    () => projectsQuery.data?.projectsPagination?.items ?? [],
    [projectsQuery.data],
  );

  return { teams, projects };
}

/** Agent id → name lookup for the allowlist builder and the detail panel. */
export function useAgentNames() {
  const { data } = useQuery(GET_KEY_AGENTS, {
    fetchPolicy: "cache-first",
    variables: { page: 1, limit: 500 },
  });

  const agents: Array<{ id: string; name: string }> = React.useMemo(
    () => data?.agentsPagination?.items ?? [],
    [data],
  );

  const agentName = React.useCallback(
    (id: string) => agents.find((agent) => agent.id === id)?.name ?? id,
    [agents],
  );

  return { agents, agentName };
}

/** Role id → name lookup (RoleSelector fetches its own list internally). */
export function useKeyRoles() {
  const { data } = useQuery(GET_KEY_ROLES, {
    fetchPolicy: "cache-first",
    variables: { page: 1, limit: 100 },
  });

  const roles: Array<{ id: string; name: string }> = React.useMemo(
    () => data?.rolesPagination?.items ?? [],
    [data],
  );

  const roleName = React.useCallback(
    (id: string) => roles.find((role) => role.id === id)?.name ?? id,
    [roles],
  );

  return { roles, roleName };
}
