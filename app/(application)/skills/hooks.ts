"use client";

/**
 * Data hooks for the /skills surface (codebase-structure §3.2 — redesigned
 * pages never call useQuery inline; agents/hooks.ts and prompts/hooks.ts are
 * the reference patterns).
 *
 * The cross-feature hook surface at `hooks/use-skills.tsx` STAYS in place
 * (parallel-protocol rule 3; brief rule 3). The redesigned routes import ONLY
 * from this file. ide imports useSkillById + useSkillFiles from here.
 *
 * Owns: 300ms debounced server search, page state, sort state, fetch policies,
 * previousData fallback so a page change never blanks the list.
 */

import { useMutation, useQuery } from "@apollo/client";
import * as React from "react";

import { skillsApi } from "@/lib/api/skills";

import {
  CREATE_SKILL_INDEX,
  DELETE_SKILL_INDEX,
  GET_SKILLS_INDEX,
  GET_SKILL_BY_ID_INDEX,
  UPDATE_SKILL_INDEX,
} from "./queries";
import type {
  Skill,
  SkillFilesResponse,
  SkillHistoryEntry,
  SkillRBACEntry,
  SkillRightsMode,
} from "./types";

export const SKILLS_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

export interface SkillsSort {
  field: "updatedAt" | "createdAt" | "name" | "usage_count";
  direction: "ASC" | "DESC";
}

export const DEFAULT_SKILLS_SORT: SkillsSort = {
  field: "updatedAt",
  direction: "DESC",
};

export interface SkillsPageInfo {
  pageCount: number;
  itemCount: number;
  currentPage: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

interface SkillsConnection {
  pageInfo: SkillsPageInfo;
  items: Skill[];
}

interface CreateSkillVars {
  name: string;
  description?: string;
  tags?: string[];
  rights_mode: SkillRightsMode;
  RBAC?: { users: SkillRBACEntry[]; roles: SkillRBACEntry[] };
}

interface UpdateSkillVars {
  id: string;
  name?: string;
  description?: string;
  tags?: string[];
  rights_mode?: SkillRightsMode;
  RBAC?: { users: SkillRBACEntry[]; roles: SkillRBACEntry[] };
  history?: SkillHistoryEntry[];
  current_version?: number;
}

/** List hook: debounced server search, pagination, sort. */
export function useSkillsIndex() {
  const [page, setPageState] = React.useState(1);
  const [search, setSearchState] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [sort, setSortState] = React.useState<SkillsSort>(DEFAULT_SKILLS_SORT);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  React.useEffect(() => () => clearTimeout(debounceRef.current), []);

  const setSearch = React.useCallback((value: string) => {
    setSearchState(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPageState(1);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const setSort = React.useCallback((next: SkillsSort) => {
    setSortState(next);
    setPageState(1);
  }, []);

  const setPage = React.useCallback((next: number) => {
    setPageState(Math.max(1, next));
  }, []);

  // Filters AND together per array entry (proven shape only — queries.ts).
  const filters = React.useMemo(() => {
    const list: Array<Record<string, unknown>> = [];
    const term = debouncedSearch.trim();
    if (term) list.push({ name: { contains: term } });
    return list;
  }, [debouncedSearch]);

  const { data, previousData, loading, error, refetch } = useQuery<{
    skillsPagination?: SkillsConnection;
  }>(GET_SKILLS_INDEX, {
    fetchPolicy: "cache-first",
    nextFetchPolicy: "network-only",
    variables: {
      page,
      limit: SKILLS_PAGE_SIZE,
      filters,
      sort: { field: sort.field, direction: sort.direction },
    },
  });

  const connection: SkillsConnection | undefined =
    data?.skillsPagination ?? previousData?.skillsPagination;

  return {
    items: connection?.items ?? [],
    pageInfo: connection?.pageInfo,
    loading,
    error,
    refetch,
    page,
    setPage,
    search,
    setSearch,
    sort,
    setSort,
  };
}

/** Single-skill hook (ide route). */
export function useSkillById(id: string) {
  const { data, loading, error, refetch } = useQuery<{ skillById?: Skill }>(
    GET_SKILL_BY_ID_INDEX,
    {
      variables: { id },
      skip: !id,
      fetchPolicy: "cache-first",
    },
  );
  return {
    skill: data?.skillById,
    loading,
    error,
    refetch,
  };
}

export function useCreateSkillLocal() {
  const [mutate, state] = useMutation<{ skillsCreateOne: { item: Skill } }>(
    CREATE_SKILL_INDEX,
    {
      refetchQueries: [
        {
          query: GET_SKILLS_INDEX,
          variables: {
            page: 1,
            limit: SKILLS_PAGE_SIZE,
            filters: [],
            sort: {
              field: DEFAULT_SKILLS_SORT.field,
              direction: DEFAULT_SKILLS_SORT.direction,
            },
          },
        },
      ],
    },
  );

  const create = React.useCallback(
    async (vars: CreateSkillVars): Promise<Skill> => {
      const result = await mutate({ variables: vars });
      const item = result.data?.skillsCreateOne?.item;
      if (!item) throw new Error("No skill returned");
      return item;
    },
    [mutate],
  );

  return [create, { loading: state.loading }] as const;
}

export function useUpdateSkillLocal() {
  const [mutate, state] =
    useMutation<{ skillsUpdateOneById: { item: Skill } }>(UPDATE_SKILL_INDEX);

  const update = React.useCallback(
    async (vars: UpdateSkillVars): Promise<Skill> => {
      const result = await mutate({ variables: vars });
      const item = result.data?.skillsUpdateOneById?.item;
      if (!item) throw new Error("No skill returned");
      return item;
    },
    [mutate],
  );

  return [update, { loading: state.loading }] as const;
}

export function useDeleteSkillLocal() {
  const [mutate, state] = useMutation<{ skillsRemoveOneById: { id: string } }>(
    DELETE_SKILL_INDEX,
    {
      refetchQueries: [
        {
          query: GET_SKILLS_INDEX,
          variables: {
            page: 1,
            limit: SKILLS_PAGE_SIZE,
            filters: [],
            sort: {
              field: DEFAULT_SKILLS_SORT.field,
              direction: DEFAULT_SKILLS_SORT.direction,
            },
          },
        },
      ],
    },
  );

  const remove = React.useCallback(
    async (id: string) => {
      const result = await mutate({ variables: { id } });
      const out = result.data?.skillsRemoveOneById;
      if (!out) throw new Error("No id returned");
      return out;
    },
    [mutate],
  );

  return [remove, { loading: state.loading }] as const;
}

/**
 * File-ops hook for the editor route. Owns load + refresh state so the
 * ide page and the file-sidebar footer share a single source of truth.
 */
export function useSkillFiles(skillId: string) {
  const [files, setFiles] = React.useState<SkillFilesResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const skillIdRef = React.useRef(skillId);
  skillIdRef.current = skillId;

  const reload = React.useCallback(async () => {
    if (!skillIdRef.current) return;
    setLoading(true);
    try {
      const result = (await skillsApi.files(
        skillIdRef.current,
      )) as SkillFilesResponse;
      setFiles(result);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!skillId) {
      setFiles(null);
      return;
    }
    void reload();
  }, [skillId, reload]);

  return { files, loading, reload };
}
