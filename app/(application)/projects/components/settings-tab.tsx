"use client";

/**
 * Settings tab — consolidates the legacy "Project information", "Access
 * control" and "Project settings" views (inventory 17-21, 35-39; ladder rows
 * 18-21, 35-39): three quiet sections (Details · Access · Danger zone), no
 * boxes-in-boxes (philosophy anti-pattern #6 — only the danger zone carries a
 * destructive border).
 *
 * Design-doc fixes baked in:
 * - Details and Access each own their UPDATE_PROJECT mutation hook, so the
 *   two save spinners no longer animate each other (fixes UX 9's shared
 *   `isSaving` flag).
 * - Access save finally reports success/error via toast (ladder row 38).
 * - The danger zone only frames the action — the ConfirmDialog with cascade
 *   options is owned by the detail view (one confirm pattern, ladder row 40).
 *
 * Mutation contracts unchanged: UPDATE_PROJECT with the same input shapes as
 * project-details.tsx handleSave (:98-107) and the access save (:527-541);
 * RBACControl consumed with the same allowedModes / initial values / onChange
 * wiring.
 */

import { useMutation } from "@apollo/client";
import { AlertTriangle, Loader2, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { RBACControl } from "@/components/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Project } from "@/types/models/project";

import type { ProjectRow } from "../hooks";
import { UPDATE_PROJECT } from "../queries";

type RbacUsers = NonNullable<NonNullable<Project["RBAC"]>["users"]>;
type RbacRoles = NonNullable<NonNullable<Project["RBAC"]>["roles"]>;

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-medium tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function SettingsTab({
  project,
  editing,
  onEditingChange,
  onUpdated,
  onRequestDelete,
}: {
  project: ProjectRow;
  /**
   * Edit mode is controlled by the detail view (URL-backed `?edit=1`), so
   * the header ⋯ "Edit details" deep-link always applies and Cancel/Save
   * clear the param (no stale `edit=1` re-opening edit mode on refresh).
   */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onUpdated: () => Promise<unknown>;
  onRequestDelete: () => void;
}) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");

  /* ---------------------------- Details (18-21) ---------------------------- */

  const [form, setForm] = React.useState({
    name: project.name || "",
    description: project.description || "",
    custom_instructions: project.custom_instructions || "",
  });

  // Re-sync read/edit baseline whenever the loaded project changes.
  React.useEffect(() => {
    setForm({
      name: project.name || "",
      description: project.description || "",
      custom_instructions: project.custom_instructions || "",
    });
  }, [project]);

  const [saveDetails, { loading: savingDetails }] = useMutation(UPDATE_PROJECT);

  const handleSaveDetails = async () => {
    if (!form.name.trim()) {
      toast.error(t("settings.nameRequired"));
      return;
    }
    try {
      await saveDetails({
        variables: {
          id: project.id,
          input: {
            name: form.name.trim(),
            description: form.description.trim() || null,
            custom_instructions: form.custom_instructions.trim() || null,
          },
        },
      });
      toast.success(t("settings.updateSuccess"));
      onEditingChange(false);
      await onUpdated();
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings.updateError"),
      );
    }
  };

  const handleCancelEdit = () => {
    setForm({
      name: project.name || "",
      description: project.description || "",
      custom_instructions: project.custom_instructions || "",
    });
    onEditingChange(false);
  };

  /* ----------------------------- Access (35-38) ---------------------------- */

  const [rbac, setRbac] = React.useState<{
    rights_mode: Project["rights_mode"];
    users?: RbacUsers;
    roles?: RbacRoles;
  }>({
    rights_mode: project.rights_mode,
    users: project.RBAC?.users,
    roles: project.RBAC?.roles,
  });

  const [saveAccess, { loading: savingAccess }] = useMutation(UPDATE_PROJECT);

  const handleSaveAccess = async () => {
    try {
      await saveAccess({
        variables: {
          id: project.id,
          input: {
            rights_mode: rbac.rights_mode,
            RBAC: {
              users: rbac.users,
              roles: rbac.roles,
            },
          },
        },
      });
      toast.success(t("settings.accessSaved"));
      await onUpdated();
    } catch (error) {
      console.error("Error saving access rights:", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings.accessError"),
      );
    }
  };

  return (
    <div className="space-y-10">
      {/* ------------------------------ Details ------------------------------ */}
      <section className="space-y-4">
        <SectionHeading
          title={t("settings.detailsTitle")}
          description={t("settings.detailsDescription")}
        />

        {editing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-name">{t("settings.nameLabel")}</Label>
              <Input
                id="settings-name"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                className="text-base md:text-sm"
                disabled={savingDetails}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-description">
                {t("settings.descriptionLabel")}
              </Label>
              <Textarea
                id="settings-description"
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                rows={3}
                className="text-base md:text-sm"
                disabled={savingDetails}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-instructions">
                {t("settings.instructionsLabel")}
              </Label>
              <Textarea
                id="settings-instructions"
                value={form.custom_instructions}
                onChange={(event) =>
                  setForm({
                    ...form,
                    custom_instructions: event.target.value,
                  })
                }
                rows={4}
                className="text-base md:text-sm"
                disabled={savingDetails}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                onClick={() => void handleSaveDetails()}
                disabled={savingDetails}
                className="w-full sm:w-auto"
              >
                {savingDetails && (
                  <Loader2
                    aria-hidden="true"
                    className="mr-2 size-4 animate-spin"
                  />
                )}
                {t("settings.save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={savingDetails}
                className="w-full sm:w-auto"
              >
                {tCommon("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <dl className="space-y-4">
              <div className="space-y-1">
                <dt className="text-sm font-medium">
                  {t("settings.nameLabel")}
                </dt>
                <dd className="text-sm text-muted-foreground">
                  {project.name}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-sm font-medium">
                  {t("settings.descriptionLabel")}
                </dt>
                <dd className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {project.description || t("settings.noDescription")}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-sm font-medium">
                  {t("settings.instructionsLabel")}
                </dt>
                <dd className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {project.custom_instructions ||
                    t("settings.noInstructions")}
                </dd>
              </div>
            </dl>
            <Button
              type="button"
              variant="outline"
              onClick={() => onEditingChange(true)}
            >
              <Pencil aria-hidden="true" className="mr-2 size-4" />
              {t("settings.edit")}
            </Button>
          </div>
        )}
      </section>

      {/* ------------------------------ Access ------------------------------- */}
      <section className="space-y-4">
        <SectionHeading
          title={t("settings.accessTitle")}
          description={t("settings.accessDescription")}
        />
        <RBACControl
          allowedModes={["private", "users", "roles"]}
          subjectLabel="project"
          initialRightsMode={project.rights_mode || "private"}
          initialUsers={project.RBAC?.users}
          initialRoles={project.RBAC?.roles}
          onChange={(rights_mode, users, roles) => {
            setRbac({ rights_mode, users, roles });
          }}
        />
        <Button
          type="button"
          onClick={() => void handleSaveAccess()}
          disabled={savingAccess}
          className="w-full sm:w-auto"
        >
          {savingAccess && (
            <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
          )}
          {t("settings.saveAccess")}
        </Button>
      </section>

      {/* ---------------------------- Danger zone ---------------------------- */}
      <section className="space-y-4 rounded-lg border border-destructive/30 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-destructive"
          />
          <div className="space-y-1">
            <h2 className="text-lg font-medium tracking-tight text-destructive">
              {t("danger.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("danger.description")}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="destructive"
          onClick={onRequestDelete}
          className="w-full sm:w-auto"
        >
          <Trash2 aria-hidden="true" className="mr-2 size-4" />
          {t("danger.deleteProject")}
        </Button>
      </section>
    </div>
  );
}
