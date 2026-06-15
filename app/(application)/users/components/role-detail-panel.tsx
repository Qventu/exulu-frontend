"use client";

/**
 * Role detail panel (L2) — access.md §3 "Role panel" + ladder #40.
 *
 * The first delivery deferred the PermissionMatrix as out-of-scope because
 * RoleForm was on the no-touch widget list. The verifier flagged that as a
 * must-fix: PermissionMatrix is the headline redesign deliverable for the
 * Roles tab (without it the legacy ~1400px stacked-cards layout ships). The
 * fix here is to STOP CONSUMING RoleForm (zero edits to it; the widget file
 * remains untouched on disk — and after this commit it has no importers in
 * the app, since role-form / team-form were only ever used by these pages —
 * access.md §4 explicitly anticipated this absorption).
 *
 * What lives here now:
 *  - Name Input with reserved-role lock (admin / default; muted helper text,
 *    not destructive red — fixes U8 colour gripe from the original spec).
 *  - PermissionMatrix (local component) — 7 rows × None/Read/Write segmented
 *    controls. ~320px instead of ~1400px (U11).
 *  - Info line: "Members see navigation changes immediately." (#50).
 *  - Meta block (created / updated) — L2 home of #35's timestamp columns.
 *  - Sticky SaveBar (primitive) — primary Save, secondary Discard; visible
 *    only while dirty (replaces the legacy form's inline footer).
 *  - Danger zone (border-destructive/20 framed section) — Delete role with
 *    ConfirmDialog; reserved roles get a disabled button + "System role"
 *    tooltip (#38).
 */

import { Loader2, Shield, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { FormSection } from "@/components/primitives/form-section";
import { RelativeTime } from "@/components/primitives/relative-time";
import { SaveBar } from "@/components/primitives/save-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserRole } from "@/types/models/user-role";

import {
  type RoleFormPayload,
  useCreateUserRole,
  useRemoveUserRole,
  useUpdateUserRole,
} from "../hooks";
import {
  EMPTY_PERMISSIONS,
  normalizePermissionLevel,
  PermissionMatrix,
  type PermissionAreaKey,
  type PermissionState,
} from "./permission-matrix";

export interface RoleDetailPanelProps {
  /** Null for create mode. */
  role: UserRole | null;
  /** Called after a successful save (with the created/updated role id). */
  onSaved: (id: string) => void;
  /** Called after a successful delete. */
  onDeleted: () => void;
  /** Called when the user cancels the create flow. */
  onCancelCreate?: () => void;
}

const RESERVED = new Set(["admin", "default"]);

/** Hydrate the matrix state from a UserRole record. */
function permissionsFromRole(role: UserRole | null): PermissionState {
  if (!role) return { ...EMPTY_PERMISSIONS };
  return {
    agents: normalizePermissionLevel(role.agents),
    workflows: normalizePermissionLevel(role.workflows),
    variables: normalizePermissionLevel(role.variables),
    users: normalizePermissionLevel(role.users),
    api: normalizePermissionLevel(role.api),
    evals: normalizePermissionLevel(role.evals),
    budget_management: normalizePermissionLevel(role.budget_management),
  };
}

/** Project state -> RoleFormPayload (empty strings become null). */
function buildPayload(name: string, state: PermissionState): RoleFormPayload {
  const nullify = (v: string) => (v ? v : null);
  return {
    name: name.trim(),
    agents: nullify(state.agents),
    workflows: nullify(state.workflows),
    variables: nullify(state.variables),
    users: nullify(state.users),
    api: nullify(state.api),
    evals: nullify(state.evals),
    budget_management: nullify(state.budget_management),
  };
}

function stateEquals(a: PermissionState, b: PermissionState): boolean {
  const keys: PermissionAreaKey[] = [
    "agents",
    "workflows",
    "variables",
    "users",
    "api",
    "evals",
    "budget_management",
  ];
  return keys.every((k) => a[k] === b[k]);
}

export function RoleDetailPanel({
  role,
  onSaved,
  onDeleted,
  onCancelCreate,
}: RoleDetailPanelProps) {
  const t = useTranslations("access.roles.detail");
  const tArea = useTranslations("access.roles.permissionAreas");
  const tAreaDesc = useTranslations("access.roles.permissionAreaDescriptions");
  const tMatrix = useTranslations("access.roles.matrix");
  const tConfirm = useTranslations("access.roles");
  const [createRole, creating] = useCreateUserRole();
  const [updateRole, updating] = useUpdateUserRole();
  const [removeRole, removing] = useRemoveUserRole();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const isCreate = role === null;
  const reserved = role !== null && RESERVED.has(role.name);
  const submitting = creating || updating;

  // Local draft state — the Sheet remounts when `role` changes so React's
  // identity-based reset handles role-switching cleanly without an effect.
  const initialName = role?.name ?? "";
  const initialPermissions = React.useMemo(
    () => permissionsFromRole(role),
    [role],
  );

  const [name, setName] = React.useState(initialName);
  const [permissions, setPermissions] =
    React.useState<PermissionState>(initialPermissions);

  // Resync if the parent swaps the role under us (e.g. after a refetch).
  React.useEffect(() => {
    setName(initialName);
    setPermissions(initialPermissions);
  }, [initialName, initialPermissions]);

  const dirty =
    name.trim() !== initialName.trim() ||
    !stateEquals(permissions, initialPermissions);

  const canSave = name.trim().length > 0 && (dirty || isCreate);

  const handleSave = React.useCallback(async () => {
    if (!canSave) return;
    const payload = buildPayload(name, permissions);
    try {
      if (isCreate) {
        const result = await createRole(payload);
        const id = (result.data?.rolesCreateOne?.item?.id ?? "") as string;
        toast.success(t("createdTitle"));
        onSaved(id);
      } else if (role) {
        const result = await updateRole(role.id, payload);
        const id = (result.data?.rolesUpdateOneById?.item?.id ??
          role.id) as string;
        toast.success(t("updatedTitle"));
        onSaved(id);
      }
    } catch (error) {
      toast.error(t("saveFailedTitle"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }, [
    canSave,
    name,
    permissions,
    isCreate,
    role,
    createRole,
    updateRole,
    t,
    onSaved,
  ]);

  const handleDiscard = React.useCallback(() => {
    if (isCreate) {
      if (onCancelCreate) onCancelCreate();
      return;
    }
    setName(initialName);
    setPermissions(initialPermissions);
  }, [isCreate, onCancelCreate, initialName, initialPermissions]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        <div className="flex items-center gap-2">
          <p className="min-w-0 truncate text-lg font-semibold">
            {role?.name ?? t("createTitle")}
          </p>
          {reserved ? (
            <Badge variant="outline" className="text-xs">
              {t("systemRole")}
            </Badge>
          ) : null}
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="role-name">{t("nameLabel")}</Label>
          <Input
            id="role-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("namePlaceholder")}
            disabled={submitting || reserved}
            required
            aria-describedby={reserved ? "role-name-hint" : undefined}
          />
          {reserved ? (
            <p
              id="role-name-hint"
              className="text-xs text-muted-foreground"
            >
              {t("reservedNameHint")}
            </p>
          ) : null}
        </div>

        {/* Permissions matrix — replaces the legacy 7-card mega-dialog. */}
        <FormSection
          title={t("permissions")}
          description={t("permissionsDescription")}
        >
          <PermissionMatrix
            value={permissions}
            onChange={setPermissions}
            disabled={submitting}
            labels={{
              area: (key) => tArea(key === "budget_management" ? "budgets" : key),
              areaDescription: (key) =>
                tAreaDesc(key === "budget_management" ? "budgets" : key),
              none: tMatrix("none"),
              read: tMatrix("read"),
              write: tMatrix("write"),
              infoLabel: tMatrix("infoLabel"),
            }}
          />
          <p className="rounded-md border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Shield aria-hidden="true" className="mr-1 inline size-3.5" />
            {t("blastRadiusInfo")}
          </p>
        </FormSection>

        {!isCreate ? (
          <FormSection title={t("meta")}>
            <dl className="flex flex-col gap-2 text-sm">
              {role?.createdAt ? (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">{t("created")}</dt>
                  <dd>
                    <RelativeTime date={role.createdAt} />
                  </dd>
                </div>
              ) : null}
              {role?.updatedAt ? (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">{t("updated")}</dt>
                  <dd>
                    <RelativeTime date={role.updatedAt} />
                  </dd>
                </div>
              ) : null}
            </dl>
          </FormSection>
        ) : null}

        {/* Danger zone — destructive-bordered section per §3 "Role panel". */}
        {!isCreate && role ? (
          <section
            aria-labelledby="role-danger-title"
            className="flex flex-col gap-3 rounded-md border border-destructive/20 bg-destructive/[0.02] p-4"
          >
            <div className="space-y-1">
              <h2
                id="role-danger-title"
                className="text-base font-medium text-destructive"
              >
                {t("dangerZone")}
              </h2>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(true)}
              disabled={reserved || removing}
              className="w-full justify-center text-destructive hover:bg-destructive/10 hover:text-destructive"
              title={reserved ? t("reservedTooltip") : undefined}
            >
              {removing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" className="mr-2 size-4" />
              )}
              {t("deleteRole")}
            </Button>
            {reserved ? (
              <p className="text-xs text-muted-foreground">
                {t("reservedTooltip")}
              </p>
            ) : null}

            <ConfirmDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              variant="destructive"
              title={tConfirm("confirmDeleteTitle")}
              description={tConfirm("confirmDeleteDescription", {
                name: role.name,
              })}
              confirmLabel={tConfirm("confirmDeleteConfirm")}
              onConfirm={async () => {
                try {
                  await removeRole(role.id);
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

      {/* Sticky save bar — the SaveBar primitive renders null when nothing
          is dirty (and isn't dirty when create-mode is opened on a blank
          form), so the chrome only appears when there's something to save. */}
      <SaveBar
        dirty={dirty || (isCreate && name.trim().length > 0)}
        saving={submitting}
        onSave={handleSave}
        onDiscard={handleDiscard}
        summary={isCreate ? t("createSummary") : t("unsavedSummary")}
      />
    </div>
  );
}
