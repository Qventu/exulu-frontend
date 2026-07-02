"use client";

/**
 * Optional Team / Project selectors for an API key. The chosen ids are stored
 * on the key's user record (`team` / `project`) and emitted as
 * team_id_/project_id_ tags by the backend's buildTags for any request the key
 * triggers — so API usage can be attributed to a team or project in LiteLLM
 * cost tracking. Both are optional (clearing them sets null on the key).
 *
 * Uses EntityCombobox (async, server-filtered) so large orgs with many
 * projects or teams are fully searchable — the previous plain Select was
 * bounded by the 200-item eager fetch.
 */

import { useApolloClient } from "@apollo/client";
import { useTranslations } from "next-intl";
import * as React from "react";

import { EntityCombobox } from "@/components/primitives/entity-combobox";
import { Label } from "@/components/ui/label";

import {
  GET_KEY_PROJECT_BY_ID,
  GET_KEY_PROJECTS,
  GET_KEY_TEAM_BY_ID,
  GET_KEY_TEAMS,
} from "../queries";

export interface KeyAttributionSelectsProps {
  teamId: string | null | undefined;
  projectId: string | null | undefined;
  onTeamChange: (id: string | null) => void;
  onProjectChange: (id: string | null) => void;
  disabled?: boolean;
}

const COMBOBOX_PAGE_SIZE = 20;

export function KeyAttributionSelects({
  teamId,
  projectId,
  onTeamChange,
  onProjectChange,
  disabled,
}: KeyAttributionSelectsProps) {
  const t = useTranslations("keys");
  const apolloClient = useApolloClient();

  const fetchTeams = React.useCallback(
    async (q: string) => {
      const { data } = await apolloClient.query({
        query: GET_KEY_TEAMS,
        variables: {
          page: 1,
          limit: COMBOBOX_PAGE_SIZE,
          filters: q ? [{ name: { contains: q } }] : undefined,
        },
        fetchPolicy: "cache-first",
      });
      return (data?.teamsPagination?.items ?? []).map(
        (item: { id: string; name: string }) => ({
          id: item.id,
          label: item.name,
        }),
      );
    },
    [apolloClient],
  );

  const resolveTeamLabel = React.useCallback(
    async (id: string) => {
      const { data } = await apolloClient.query({
        query: GET_KEY_TEAM_BY_ID,
        variables: { id },
        fetchPolicy: "cache-first",
      });
      const found = data?.teamById;
      return found ? { label: found.name as string } : null;
    },
    [apolloClient],
  );

  const fetchProjects = React.useCallback(
    async (q: string) => {
      const { data } = await apolloClient.query({
        query: GET_KEY_PROJECTS,
        variables: {
          page: 1,
          limit: COMBOBOX_PAGE_SIZE,
          filters: q ? [{ name: { contains: q } }] : undefined,
        },
        fetchPolicy: "cache-first",
      });
      return (data?.projectsPagination?.items ?? []).map(
        (item: { id: string; name: string }) => ({
          id: item.id,
          label: item.name,
        }),
      );
    },
    [apolloClient],
  );

  const resolveProjectLabel = React.useCallback(
    async (id: string) => {
      const { data } = await apolloClient.query({
        query: GET_KEY_PROJECT_BY_ID,
        variables: { id },
        fetchPolicy: "cache-first",
      });
      const found = data?.projectById;
      return found ? { label: found.name as string } : null;
    },
    [apolloClient],
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label>{t("attribution.teamLabel")}</Label>
        <EntityCombobox
          value={teamId ?? null}
          onChange={onTeamChange}
          fetchOptions={fetchTeams}
          resolveLabel={resolveTeamLabel}
          placeholder={t("attribution.noTeam")}
          emptyMessage={t("attribution.teamEmpty")}
          searchPlaceholder={t("attribution.teamSearchPlaceholder")}
          disabled={disabled}
          triggerClassName="w-full"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("attribution.projectLabel")}</Label>
        <EntityCombobox
          value={projectId ?? null}
          onChange={onProjectChange}
          fetchOptions={fetchProjects}
          resolveLabel={resolveProjectLabel}
          placeholder={t("attribution.noProject")}
          emptyMessage={t("attribution.projectEmpty")}
          searchPlaceholder={t("attribution.projectSearchPlaceholder")}
          disabled={disabled}
          triggerClassName="w-full"
        />
      </div>
    </div>
  );
}
