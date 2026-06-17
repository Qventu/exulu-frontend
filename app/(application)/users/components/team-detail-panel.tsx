"use client";

/**
 * Team detail panel (L2) — access.md §3 "Team panel". Wraps the existing
 * TeamForm shared widget UNCHANGED. Adds Sheet chrome + meta block, and a
 * Danger-zone delete with blast-radius copy (U15).
 */

import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { FormSection } from "@/components/primitives/form-section";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Button } from "@/components/ui/button";
import { TeamForm } from "@/components/team-form";
import type { Team } from "@/types/models/team";

import {
  type TeamFormPayload,
  useCreateTeam,
  useRemoveTeam,
  useUpdateTeam,
} from "../hooks";

export interface TeamDetailPanelProps {
  team: Team | null;
  onSaved: (id: string) => void;
  onDeleted: () => void;
  onCancelCreate?: () => void;
}

export function TeamDetailPanel({
  team,
  onSaved,
  onDeleted,
  onCancelCreate,
}: TeamDetailPanelProps) {
  const t = useTranslations("access.teams.detail");
  const tConfirm = useTranslations("access.teams");
  const [createTeam, creating] = useCreateTeam();
  const [updateTeam, updating] = useUpdateTeam();
  const [removeTeam, removing] = useRemoveTeam();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const isCreate = team === null;
  const submitting = creating || updating;

  const handleSubmit = React.useCallback(
    async (payload: TeamFormPayload) => {
      try {
        if (isCreate) {
          const result = await createTeam(payload);
          const id = (result.data?.teamsCreateOne?.item?.id ?? "") as string;
          toast.success(t("createdTitle"));
          onSaved(id);
        } else if (team) {
          const result = await updateTeam(team.id, payload);
          const id = (result.data?.teamsUpdateOneById?.item?.id ??
            team.id) as string;
          toast.success(t("updatedTitle"));
          onSaved(id);
        }
      } catch (error) {
        toast.error(t("saveFailedTitle"), {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    },
    [isCreate, createTeam, updateTeam, team, t, onSaved],
  );

  return (
    <div className="flex flex-col gap-6 p-4">
      <p className="min-w-0 truncate text-lg font-semibold">
        {team?.name ?? t("createTitle")}
      </p>

      {!isCreate ? (
        <FormSection title={t("meta")}>
          <dl className="flex flex-col gap-2 text-sm">
            {team?.createdAt ? (
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">{t("created")}</dt>
                <dd>
                  <RelativeTime date={team.createdAt} />
                </dd>
              </div>
            ) : null}
            {team?.updatedAt ? (
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">{t("updated")}</dt>
                <dd>
                  <RelativeTime date={team.updatedAt} />
                </dd>
              </div>
            ) : null}
          </dl>
        </FormSection>
      ) : null}

      <TeamForm
        initialData={team ?? undefined}
        loading={submitting}
        onSubmit={handleSubmit}
        onCancel={() => {
          if (isCreate && onCancelCreate) onCancelCreate();
        }}
      />

      {!isCreate && team ? (
        <section
          aria-labelledby="team-danger-title"
          className="flex flex-col gap-3 rounded-md border border-destructive/20 bg-destructive/[0.02] p-4"
        >
          <h2
            id="team-danger-title"
            className="text-base font-medium text-destructive"
          >
            {t("dangerZone")}
          </h2>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            className="w-full justify-center text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {removing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="mr-2 size-4" />
            )}
            {t("deleteTeam")}
          </Button>

          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            variant="destructive"
            title={tConfirm("confirmDeleteTitle")}
            description={tConfirm("confirmDeleteDescription", {
              name: team.name,
            })}
            warning={tConfirm("confirmDeleteWarning", { name: team.name })}
            confirmLabel={tConfirm("confirmDeleteConfirm")}
            onConfirm={async () => {
              try {
                await removeTeam(team.id);
                toast.success(tConfirm("deletedTitle"));
                onDeleted();
              } catch (error) {
                toast.error(tConfirm("deleteFailedTitle"), {
                  description:
                    error instanceof Error ? error.message : undefined,
                });
                throw error;
              }
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
