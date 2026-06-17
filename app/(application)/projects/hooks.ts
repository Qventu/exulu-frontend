"use client";

/**
 * Data hooks for /projects (codebase-structure §3.2: redesigned pages never
 * call useQuery(GET_X) inline). Owns fetch policies, the "load more" growth
 * windows (fixes projects.md UX 11 — the silent 200/50 ceilings get a visible
 * affordance), the optimistic favorites toggle (inventory 3-4) and the
 * paginated delete cascade (ladder row 41 — iterates ALL sessions, not just
 * the loaded page).
 */

import { useApolloClient, useMutation, useQuery } from "@apollo/client";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";
import type { PageInfo } from "@/components/primitives/data-table";
import { filesApi } from "@/lib/api/files";
import type { AgentSession } from "@/types/models/agent-session";
import type { Project } from "@/types/models/project";

import {
  DELETE_ITEM,
  DELETE_PROJECT,
  GET_AGENT_SESSIONS,
  GET_PROJECT_AGENTS,
  GET_PROJECT_BY_ID,
  GET_PROJECTS,
  GET_PROJECTS_BY_IDS,
  GET_USER_FAVOURITE_PROJECTS,
  REMOVE_AGENT_SESSION_BY_ID,
  UPDATE_AGENT_SESSION_PROJECT,
  UPDATE_USER_FAVOURITE_PROJECTS,
} from "./queries";

/** Legacy list window (project-nav.tsx:51) — now a visible "Load more" step. */
export const PROJECTS_PAGE_SIZE = 200;
/** Legacy sessions window (project-details.tsx:71) — now a "Load more" step. */
export const SESSIONS_PAGE_SIZE = 50;
/** The "max 15 items" copy, finally enforced (projects.md ladder row 23). */
export const MAX_PROJECT_ITEMS = 15;

/** The monolith's Project model lacks `image`; the selection includes it. */
export type ProjectRow = Project & { image?: string | null };

interface ProjectsConnection {
  pageInfo: PageInfo;
  items: ProjectRow[];
}

/**
 * Index list: server-side name search (inventory 2), `cache-and-network`
 * freshness on mount (ladder row 9 — replaces the pathname-refetch hack) and
 * a growing window for >200 projects (UX 11).
 */
export function useProjectsIndex(search: string) {
  const [limit, setLimit] = React.useState(PROJECTS_PAGE_SIZE);

  // A new search resets the visible window.
  React.useEffect(() => {
    setLimit(PROJECTS_PAGE_SIZE);
  }, [search]);

  const { data, previousData, loading, error, refetch } = useQuery(
    GET_PROJECTS,
    {
      fetchPolicy: "cache-and-network",
      variables: {
        page: 1,
        limit,
        filters: search ? [{ name: { contains: search } }] : undefined,
      },
    },
  );

  const connection: ProjectsConnection | undefined =
    data?.projectsPagination ?? previousData?.projectsPagination;

  return {
    projects: connection?.items,
    pageInfo: connection?.pageInfo,
    loading,
    error,
    refetch,
    canLoadMore: connection?.pageInfo?.hasNextPage === true,
    loadMore: () => setLimit((current) => current + PROJECTS_PAGE_SIZE),
  };
}

/* ------------------- favorites: ONE shared source of truth ------------------- */

/**
 * Module-scoped favorites store shared by every `useFavoriteProjects`
 * instance. UserContext is a once-per-login server snapshot
 * (app/(application)/layout.tsx) with no setter and no Apollo backing, so
 * seeding component-local state from it made every hook instance diverge
 * after the first toggle — and the full-array UPDATE_USER_FAVOURITE_PROJECTS
 * write then silently wiped stars set elsewhere. All instances now read this
 * one store (index rows, the detail-header star and re-navigations always
 * agree); it is seeded from the snapshot, re-anchored to the backend on
 * mount (GET_USER_FAVOURITE_PROJECTS) and advanced by each toggle.
 */
let favoriteIdsStore: string[] | null = null;
let favoriteTogglesInFlight = 0;
const favoriteStoreListeners = new Set<() => void>();

function readFavoriteIdsStore(): string[] | null {
  return favoriteIdsStore;
}

function writeFavoriteIdsStore(ids: string[]) {
  favoriteIdsStore = ids;
  favoriteStoreListeners.forEach((listener) => listener());
}

function subscribeFavoriteIdsStore(listener: () => void): () => void {
  favoriteStoreListeners.add(listener);
  return () => {
    favoriteStoreListeners.delete(listener);
  };
}

/**
 * Favorites (inventory 3-4): ids live in the shared module store above,
 * persisted via UPDATE_USER_FAVOURITE_PROJECTS. The full-array write is
 * always computed from the latest shared state (never a stale per-mount
 * seed), and a failed mutation reverts only the toggled project so a
 * concurrent successful toggle is never clobbered.
 */
export function useFavoriteProjects() {
  const { user } = React.useContext(UserContext);
  const userId = user?.id;
  const seed: string[] | undefined = user?.favourite_projects;

  const storeIds = React.useSyncExternalStore(
    subscribeFavoriteIdsStore,
    readFavoriteIdsStore,
    readFavoriteIdsStore,
  );
  // Until the store is first written, fall back to the login-time snapshot.
  const favoriteIds = React.useMemo(
    () => storeIds ?? seed ?? [],
    [storeIds, seed],
  );

  // Re-anchor to the backend on mount: the snapshot can be stale (stars
  // toggled in another tab — or before this page got its own store writes).
  useQuery(GET_USER_FAVOURITE_PROJECTS, {
    fetchPolicy: "network-only",
    variables: { id: userId },
    skip: !userId,
    onCompleted: (result) => {
      const server = result?.userById?.favourite_projects;
      // Never clobber an optimistic toggle that is still in flight.
      if (Array.isArray(server) && favoriteTogglesInFlight === 0) {
        writeFavoriteIdsStore(server);
      }
    },
  });

  const { data, previousData, loading } = useQuery(GET_PROJECTS_BY_IDS, {
    fetchPolicy: "cache-and-network",
    variables: { ids: favoriteIds },
    skip: favoriteIds.length === 0,
  });

  const [updateFavorites] = useMutation(UPDATE_USER_FAVOURITE_PROJECTS);

  const toggleFavorite = React.useCallback(
    async (projectId: string) => {
      const base = readFavoriteIdsStore() ?? seed ?? [];
      const removing = base.includes(projectId);
      const next = removing
        ? base.filter((id) => id !== projectId)
        : [...base, projectId];
      writeFavoriteIdsStore(next);
      favoriteTogglesInFlight++;
      try {
        const { data: result } = await updateFavorites({
          variables: { id: userId, favourite_projects: next },
        });
        const confirmed = result?.usersUpdateOne?.item?.favourite_projects;
        // Adopt the server-confirmed array — unless a newer toggle is still
        // in flight (its optimistic state supersedes this response).
        if (Array.isArray(confirmed) && favoriteTogglesInFlight === 1) {
          writeFavoriteIdsStore(confirmed);
        }
      } catch (mutationError) {
        // Revert ONLY this project; concurrent toggles may have advanced the
        // store since.
        const current = readFavoriteIdsStore() ?? [];
        writeFavoriteIdsStore(
          removing
            ? current.includes(projectId)
              ? current
              : [...current, projectId]
            : current.filter((id) => id !== projectId),
        );
        throw mutationError;
      } finally {
        favoriteTogglesInFlight--;
      }
    },
    [updateFavorites, userId, seed],
  );

  const fetched: ProjectRow[] =
    data?.projectByIds ?? previousData?.projectByIds ?? [];
  // Client filter keeps un-starring instant while the query catches up.
  const favorites = fetched.filter((project) =>
    favoriteIds.includes(project.id),
  );

  return { favoriteIds, favorites, loading, toggleFavorite };
}

/** Detail load by id (inventory 15). */
export function useProject(projectId: string | undefined) {
  const { data, loading, error, refetch } = useQuery(GET_PROJECT_BY_ID, {
    fetchPolicy: "cache-and-network",
    variables: { id: projectId },
    skip: !projectId,
  });

  const project: ProjectRow | undefined = data?.projectById ?? undefined;
  return { project, loading, error, refetch };
}

interface SessionsConnection {
  pageInfo: PageInfo;
  items: AgentSession[];
}

/**
 * Sessions belonging to a project (inventory 29) with a growing window for
 * >50 sessions; `totalCount` feeds the delete-cascade checkbox copy (ladder
 * row 40 — pageInfo.itemCount, not just loaded rows).
 */
export function useProjectSessions(projectId: string | undefined) {
  const [limit, setLimit] = React.useState(SESSIONS_PAGE_SIZE);

  const { data, previousData, loading, error, refetch } = useQuery(
    GET_AGENT_SESSIONS,
    {
      fetchPolicy: "cache-and-network",
      variables: {
        page: 1,
        limit,
        filters: [{ project: { eq: projectId } }],
      },
      skip: !projectId,
    },
  );

  const connection: SessionsConnection | undefined =
    data?.agent_sessionsPagination ?? previousData?.agent_sessionsPagination;

  return {
    sessions: connection?.items,
    totalCount: connection?.pageInfo?.itemCount ?? connection?.items?.length ?? 0,
    loading,
    error,
    refetch,
    canLoadMore: connection?.pageInfo?.hasNextPage === true,
    loadMore: () => setLimit((current) => current + SESSIONS_PAGE_SIZE),
  };
}

export interface ProjectAgent {
  id: string;
  name: string;
  description?: string | null;
  modelName?: string | null;
  image?: string | null;
  animation_idle?: string | null;
  animation_responding?: string | null;
}

/**
 * Agent identity join for SessionRow (projects.md §3 SessionRow data note:
 * GET_AGENT_SESSIONS returns only the agent id) and the new-session picker —
 * one cached fetch per page, no schema change.
 */
export function useProjectAgents() {
  const { data, loading } = useQuery(GET_PROJECT_AGENTS, {
    fetchPolicy: "cache-first",
    variables: { page: 1, limit: 100, filters: [] },
  });

  const agents: ProjectAgent[] = React.useMemo(
    () => data?.agentsPagination?.items ?? [],
    [data],
  );

  // Undefined (not the raw id) while resolving / when the agent was deleted.
  const agentName = React.useCallback(
    (id: string | undefined) =>
      id ? agents.find((agent) => agent.id === id)?.name : undefined,
    [agents],
  );

  return { agents, agentName, loading };
}

export interface DeleteProjectCascadeInput {
  project: ProjectRow;
  projectItems: string[];
  deleteItems: boolean;
  deleteSessions: boolean;
}

/**
 * Project deletion with opt-in cascades (inventory 40-41), fixed per the
 * design doc:
 * - item deletion tolerates orphaned gids (UX 4 — a failed DELETE_ITEM no
 *   longer aborts the cascade);
 * - sessions are processed through ALL pages, not only the 50 loaded rows
 *   (UX 11 — no sessions stranded pointing at a deleted project id);
 * - S3 cleanup behavior is unchanged (same DELETE_ITEM selection as legacy).
 */
export function useDeleteProjectCascade() {
  const apolloClient = useApolloClient();
  const [deleteProjectMutation] = useMutation(DELETE_PROJECT);
  const [detachSession] = useMutation(UPDATE_AGENT_SESSION_PROJECT);
  const [deleteSession] = useMutation(REMOVE_AGENT_SESSION_BY_ID);

  return React.useCallback(
    async ({
      project,
      projectItems,
      deleteItems,
      deleteSessions,
    }: DeleteProjectCascadeInput) => {
      if (deleteItems) {
        await Promise.all(
          projectItems.map(async (gid) => {
            const slashIdx = gid.indexOf("/");
            const context = slashIdx !== -1 ? gid.slice(0, slashIdx) : gid;
            const id = slashIdx !== -1 ? gid.slice(slashIdx + 1) : undefined;
            if (!context || !id) return;
            try {
              const { data } = await apolloClient.mutate({
                mutation: DELETE_ITEM(context, []),
                variables: { id },
              });
              const s3key = data?.[`${context}_itemsRemoveOneById`]?.s3key;
              if (s3key) {
                try {
                  await filesApi.delete(s3key);
                } catch (fileError) {
                  console.error(
                    "[EXULU] Error deleting file from s3 storage:",
                    fileError,
                  );
                }
              }
            } catch (itemError) {
              // Orphaned gid (item already deleted elsewhere) — continue.
              console.error("[EXULU] Error deleting project item:", itemError);
            }
          }),
        );
      }

      // Detached/deleted sessions drop out of the filter, so re-querying
      // page 1 walks the full set; the guard bounds a pathological backend.
      for (let guard = 0; guard < 1000; guard++) {
        const { data } = await apolloClient.query({
          query: GET_AGENT_SESSIONS,
          fetchPolicy: "network-only",
          variables: {
            page: 1,
            limit: SESSIONS_PAGE_SIZE,
            filters: [{ project: { eq: project.id } }],
          },
        });
        const sessions: AgentSession[] =
          data?.agent_sessionsPagination?.items ?? [];
        if (sessions.length === 0) break;
        await Promise.all(
          sessions.map((session) =>
            deleteSessions
              ? deleteSession({ variables: { id: session.id } })
              : detachSession({ variables: { id: session.id, project: null } }),
          ),
        );
      }

      await deleteProjectMutation({ variables: { id: project.id } });
    },
    [apolloClient, deleteProjectMutation, detachSession, deleteSession],
  );
}
