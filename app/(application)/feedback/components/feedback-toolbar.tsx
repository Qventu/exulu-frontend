"use client";

/**
 * FeedbackToolbar — the search + filters strip for /feedback. Renders the
 * shared <Toolbar/> primitive with:
 *  - debounced search (300 ms via Toolbar itself),
 *  - Type tabs (All | Negative | Positive),
 *  - Agent EntityCombobox + User EntityCombobox (async, server-filtered).
 *
 * Apollo lives here, not in EntityCombobox — the primitive stays pure
 * (components/primitives/README.md §5 import boundaries).
 */

import { useApolloClient } from "@apollo/client";
import { useTranslations } from "next-intl";
import * as React from "react";

import { EntityCombobox } from "@/components/primitives/entity-combobox";
import { Toolbar } from "@/components/primitives/toolbar";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { GET_AGENTS, GET_USERS } from "@/queries/queries";

import type {
  FeedbackTypeFilter,
  UseFeedbackQueryResult,
} from "./use-feedback-query";

export interface FeedbackToolbarProps {
  query: UseFeedbackQueryResult;
}

export function FeedbackToolbar({ query }: FeedbackToolbarProps) {
  const t = useTranslations("feedbackReview");
  const apolloClient = useApolloClient();

  const fetchAgents = React.useCallback(
    async (q: string) => {
      const { data } = await apolloClient.query({
        query: GET_AGENTS,
        variables: {
          page: 1,
          limit: 20,
          filters: q ? [{ name: { contains: q } }] : [],
        },
        fetchPolicy: "cache-first",
      });
      const items: Array<{ id: string; name: string }> =
        data?.agentsPagination?.items ?? [];
      return items.map((a) => ({ id: a.id, label: a.name }));
    },
    [apolloClient],
  );

  const fetchUsers = React.useCallback(
    async (q: string) => {
      const { data } = await apolloClient.query({
        query: GET_USERS,
        variables: {
          page: 1,
          limit: 20,
          filters: q ? [{ name: { contains: q } }] : [],
        },
        fetchPolicy: "cache-first",
      });
      const items: Array<{
        id: string;
        name?: string | null;
        email?: string | null;
      }> = data?.usersPagination?.items ?? [];
      return items.map((u) => ({
        id: u.id,
        label: u.name || u.email || u.id,
        sublabel: u.name && u.email ? u.email : undefined,
      }));
    },
    [apolloClient],
  );

  const resolveAgentLabel = React.useCallback(
    async (id: string) => {
      const { data } = await apolloClient.query({
        query: GET_AGENTS,
        variables: { page: 1, limit: 1, filters: [{ id: { eq: id } }] },
        fetchPolicy: "cache-first",
      });
      const found = data?.agentsPagination?.items?.[0];
      return found ? { label: found.name } : null;
    },
    [apolloClient],
  );

  const resolveUserLabel = React.useCallback(
    async (id: string) => {
      const { data } = await apolloClient.query({
        query: GET_USERS,
        variables: { page: 1, limit: 1, filters: [{ id: { eq: id } }] },
        fetchPolicy: "cache-first",
      });
      const found = data?.usersPagination?.items?.[0];
      if (!found) return null;
      return {
        label: found.name || found.email || found.id,
        sublabel: found.name && found.email ? found.email : undefined,
      };
    },
    [apolloClient],
  );

  const activeFilterCount =
    (query.search.trim().length > 0 ? 1 : 0) +
    (query.type !== "all" ? 1 : 0) +
    (query.agentId ? 1 : 0) +
    (query.userId ? 1 : 0);

  const filters = (
    <>
      <Tabs
        value={query.type}
        onValueChange={(value) => query.setType(value as FeedbackTypeFilter)}
        className="md:w-auto"
      >
        <TabsList>
          <TabsTrigger value="all">{t("toolbar.typeAll")}</TabsTrigger>
          <TabsTrigger value="negative">
            {t("toolbar.typeNegative")}
          </TabsTrigger>
          <TabsTrigger value="positive">
            {t("toolbar.typePositive")}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <EntityCombobox
        value={query.agentId}
        onChange={query.setAgentId}
        fetchOptions={fetchAgents}
        resolveLabel={resolveAgentLabel}
        placeholder={t("toolbar.agentPlaceholder")}
        emptyMessage={t("toolbar.agentEmpty")}
      />
      <EntityCombobox
        value={query.userId}
        onChange={query.setUserId}
        fetchOptions={fetchUsers}
        resolveLabel={resolveUserLabel}
        placeholder={t("toolbar.userPlaceholder")}
        emptyMessage={t("toolbar.userEmpty")}
      />
    </>
  );

  return (
    <Toolbar
      search={{
        value: query.search,
        onChange: query.setSearch,
        placeholder: t("toolbar.searchPlaceholder"),
      }}
      filters={filters}
      activeFilterCount={activeFilterCount}
      onResetFilters={
        activeFilterCount > 0 ? () => query.resetFilters() : undefined
      }
    />
  );
}
