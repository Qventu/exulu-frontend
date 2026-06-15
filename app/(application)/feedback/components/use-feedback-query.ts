"use client";

/**
 * useFeedbackQuery — the Apollo-owning hook behind the /feedback review
 * console. Keeps Apollo out of the toolbar/list/detail components so the
 * primitives stay pure (codebase-structure §1.2 import boundaries).
 *
 * Responsibilities:
 * - Owns filters[] in the FilterFeedback shape (description / score /
 *   agent / user). Search edits the description filter (removing it when
 *   empty — U15). User id is passed verbatim — no parseFloat (U12).
 * - Drives GET_FEEDBACK with cache-and-network + 30 s polling, returning a
 *   stale-while-loading items/pageCount pair.
 * - Owns the two summary probes (positive + negative totals) for the
 *   PageHeader's percent-negative stat.
 */

import { useQuery } from "@apollo/client";
import * as React from "react";

import { GET_FEEDBACK } from "@/queries/queries";
import type { FilterOperator } from "@/types/models/filter";

export type FeedbackTypeFilter = "all" | "positive" | "negative";

export type FeedbackFilters = {
  agent?: FilterOperator;
  user?: FilterOperator;
  score?: FilterOperator;
  description?: FilterOperator;
};

export type FeedbackItem = {
  id: string;
  description: string;
  session: string;
  score: number;
  user: number;
  agent: string;
  createdAt: string;
  status?: string | null;
};

export interface FeedbackSummary {
  positive: number;
  negative: number;
  total: number;
  percent: number;
  loading: boolean;
}

export interface UseFeedbackQueryResult {
  items: FeedbackItem[];
  loading: boolean;
  pageCount: number;
  page: number;
  setPage: (page: number) => void;
  search: string;
  type: FeedbackTypeFilter;
  agentId: string | null;
  userId: string | null;
  setSearch: (value: string) => void;
  setType: (value: FeedbackTypeFilter) => void;
  setAgentId: (value: string | null) => void;
  setUserId: (value: string | null) => void;
  resetFilters: () => void;
  refetch: () => Promise<unknown>;
  summary: FeedbackSummary;
}

export function useFeedbackQuery(): UseFeedbackQueryResult {
  const [search, setSearchState] = React.useState("");
  const [type, setTypeState] = React.useState<FeedbackTypeFilter>("all");
  const [agentId, setAgentIdState] = React.useState<string | null>(null);
  const [userId, setUserIdState] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);

  const filters = React.useMemo<FeedbackFilters[]>(() => {
    const next: FeedbackFilters[] = [];
    const trimmed = search.trim();
    if (trimmed.length > 0) {
      next.push({ description: { contains: trimmed } });
    }
    if (type === "positive") {
      next.push({ score: { eq: 1 } });
    } else if (type === "negative") {
      next.push({ score: { eq: 0 } });
    }
    if (agentId) {
      next.push({ agent: { eq: agentId } });
    }
    if (userId) {
      // U12: pass id verbatim — no parseFloat, no number-coerce.
      next.push({ user: { eq: userId } });
    }
    return next;
  }, [search, type, agentId, userId]);

  const { data, previousData, loading, refetch } = useQuery(GET_FEEDBACK, {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
    variables: {
      page,
      limit: 20,
      sort: { field: "createdAt", direction: "DESC" },
      filters,
    },
    pollInterval: 30000,
  });

  const itemsSource =
    data?.feedbackPagination?.items ??
    previousData?.feedbackPagination?.items ??
    [];
  const pageCount: number =
    data?.feedbackPagination?.pageInfo?.pageCount ??
    previousData?.feedbackPagination?.pageInfo?.pageCount ??
    1;
  const items = itemsSource as FeedbackItem[];

  // Summary probes — itemCount only, so limit:1 is enough.
  const positiveProbe = useQuery(GET_FEEDBACK, {
    fetchPolicy: "cache-and-network",
    variables: {
      page: 1,
      limit: 1,
      sort: { field: "createdAt", direction: "DESC" },
      filters: [{ score: { eq: 1 } }],
    },
    pollInterval: 30000,
  });
  const negativeProbe = useQuery(GET_FEEDBACK, {
    fetchPolicy: "cache-and-network",
    variables: {
      page: 1,
      limit: 1,
      sort: { field: "createdAt", direction: "DESC" },
      filters: [{ score: { eq: 0 } }],
    },
    pollInterval: 30000,
  });

  const positive: number =
    positiveProbe.data?.feedbackPagination?.pageInfo?.itemCount ??
    positiveProbe.previousData?.feedbackPagination?.pageInfo?.itemCount ??
    0;
  const negative: number =
    negativeProbe.data?.feedbackPagination?.pageInfo?.itemCount ??
    negativeProbe.previousData?.feedbackPagination?.pageInfo?.itemCount ??
    0;
  const total = positive + negative;
  const percent = total > 0 ? Math.round((positive / total) * 100) : 0;

  const setSearch = React.useCallback(
    (value: string) => {
      setSearchState(value);
      setPage(1);
    },
    [],
  );
  const setType = React.useCallback((value: FeedbackTypeFilter) => {
    setTypeState(value);
    setPage(1);
  }, []);
  const setAgentId = React.useCallback((value: string | null) => {
    setAgentIdState(value);
    setPage(1);
  }, []);
  const setUserId = React.useCallback((value: string | null) => {
    setUserIdState(value);
    setPage(1);
  }, []);
  const resetFilters = React.useCallback(() => {
    setSearchState("");
    setTypeState("all");
    setAgentIdState(null);
    setUserIdState(null);
    setPage(1);
  }, []);

  return {
    items,
    loading,
    pageCount,
    page,
    setPage,
    search,
    type,
    agentId,
    userId,
    setSearch,
    setType,
    setAgentId,
    setUserId,
    resetFilters,
    refetch,
    summary: {
      positive,
      negative,
      total,
      percent,
      loading: positiveProbe.loading || negativeProbe.loading,
    },
  };
}
