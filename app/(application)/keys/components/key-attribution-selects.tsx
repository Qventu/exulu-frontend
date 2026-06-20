"use client";

/**
 * Optional Team / Project selectors for an API key. The chosen ids are stored
 * on the key's user record (`team` / `project`) and emitted as
 * team_id_/project_id_ tags by the backend's buildTags for any request the key
 * triggers — so API usage can be attributed to a team or project in LiteLLM
 * cost tracking. Both are optional ("No team" / "No project" clears them).
 */

import { useTranslations } from "next-intl";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useKeyEntities } from "../hooks";

// Radix Select forbids an empty-string item value, so "unassigned" uses a
// sentinel that maps back to null on change.
const NONE = "__none__";

export interface KeyAttributionSelectsProps {
  teamId: string | null | undefined;
  projectId: string | null | undefined;
  onTeamChange: (id: string | null) => void;
  onProjectChange: (id: string | null) => void;
  disabled?: boolean;
}

export function KeyAttributionSelects({
  teamId,
  projectId,
  onTeamChange,
  onProjectChange,
  disabled,
}: KeyAttributionSelectsProps) {
  const t = useTranslations("keys");
  const { teams, projects } = useKeyEntities();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label>{t("attribution.teamLabel")}</Label>
        <Select
          value={teamId || NONE}
          onValueChange={(v) => onTeamChange(v === NONE ? null : v)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("attribution.noTeam")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("attribution.noTeam")}</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("attribution.projectLabel")}</Label>
        <Select
          value={projectId || NONE}
          onValueChange={(v) => onProjectChange(v === NONE ? null : v)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("attribution.noProject")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("attribution.noProject")}</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
