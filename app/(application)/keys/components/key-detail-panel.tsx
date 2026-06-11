"use client";

/**
 * Key detail content (L2) — keys-token.md §3 ladder rows 15–18 + "NEW: detail
 * panel". Rendered by ListDetail (docked panel ≥lg, right Sheet md–lg, bottom
 * Sheet <md — responsive.md T2). Sections: Identity → Scope → Role →
 * Activity → Danger zone.
 *
 * - Scope allowlist is plain text with copyable IDs — the hover-only tooltip
 *   is gone everywhere (T7, mobile-safe).
 * - Role reassignment is deliberate: selecting opens a ConfirmDialog before
 *   mutating (fixes U9); disabled with a caption for agents-scoped keys.
 * - Delete sits in the Danger zone behind the shared ConfirmDialog
 *   (destructive variant, names the key) — ONE dialog instance for the page,
 *   not one per row (fixes U15).
 */

import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { CopyButton } from "@/components/primitives/copy-button";
import { CopyField } from "@/components/primitives/copy-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  type ApiKeyRow,
  keyDisplayName,
  legacyPostfix,
  slugifyPostfix,
  useAgentNames,
  useKeyRoles,
} from "../hooks";
import { KeysRoleSelector } from "./keys-role-selector";
import { ScopeBadge } from "./scope-badge";

export interface KeyDetailPanelProps {
  apiKey: ApiKeyRow;
  onChangeRole: (id: string, roleId: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Called after a successful delete so the parent clears the selection. */
  onDeleted: () => void;
}

export function KeyDetailPanel({
  apiKey,
  onChangeRole,
  onDelete,
  onDeleted,
}: KeyDetailPanelProps) {
  const t = useTranslations("keys");
  const locale = useLocale();
  const { agentName } = useAgentNames();
  const { roleName } = useKeyRoles();

  const [pendingRoleId, setPendingRoleId] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const timestampFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const name = keyDisplayName(apiKey);
  const isAgentsScoped = apiKey.scope_mode === "agents";
  const scopedAgentIds: string[] = Array.isArray(apiKey.agent_ids)
    ? apiKey.agent_ids
    : [];

  // Keys created before postfix sanitization stored the legacy slug (spaces
  // replaced only — "Prod/EU" stayed "prod/eu"). The row carries no marker of
  // which rule minted it, so when the two derivations differ the panel shows
  // the legacy variant too — the mask stays matchable in logs either way.
  const postfix = slugifyPostfix(name);
  const oldPostfix = legacyPostfix(name);
  const postfixAmbiguous = oldPostfix !== postfix;

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Identity */}
      <Section label={t("detail.identity")}>
        {/* Key prefix mask — matchable against logs (postfix = name slug). */}
        <code className="break-all font-mono text-sm text-muted-foreground">
          {`sk_…/${postfix}`}
        </code>
        <p className="text-xs text-muted-foreground">{t("detail.keyMaskHint")}</p>
        {postfixAmbiguous ? (
          <p className="text-xs text-muted-foreground">
            {t("detail.keyMaskLegacyNote", {
              legacyMask: `sk_…/${oldPostfix}`,
            })}
          </p>
        ) : null}
        <CopyField value={apiKey.id} label={t("detail.keyId")} />
      </Section>

      {/* Scope */}
      <Section label={t("detail.scope")}>
        <div className="flex items-center gap-2">
          <ScopeBadge apiKey={apiKey} />
        </div>
        {isAgentsScoped ? (
          <ul className="flex flex-col">
            {scopedAgentIds.map((id) => (
              <li
                key={id}
                className="flex min-h-10 items-center justify-between gap-2 border-b border-border/50 py-1 last:border-b-0"
              >
                <span className="min-w-0 truncate text-sm">
                  {agentName(id)}
                </span>
                <CopyButton value={id} label={t("detail.copyAgentId")} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-warning">{t("detail.adminScopeNote")}</p>
        )}
      </Section>

      {/* Role */}
      <Section label={t("detail.role")}>
        <KeysRoleSelector
          value={apiKey.role ?? ""}
          onChange={(roleId) => {
            if (roleId && roleId !== apiKey.role) setPendingRoleId(roleId);
          }}
          placeholder={
            isAgentsScoped
              ? t("detail.roleNotUsed")
              : t("create.rolePlaceholder")
          }
          disabled={isAgentsScoped}
        />
        <p
          className={
            isAgentsScoped
              ? "text-xs text-muted-foreground"
              : "text-xs text-warning"
          }
        >
          {isAgentsScoped
            ? t("detail.roleNotUsedCaption")
            : t("adminRoleNotice")}
        </p>
      </Section>

      {/* Activity — exact timestamps (ladder row 17). */}
      <Section label={t("detail.activity")}>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{t("detail.created")}</dt>
            <dd>{timestampFormatter.format(new Date(apiKey.createdAt))}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{t("detail.lastUsed")}</dt>
            <dd>
              {apiKey.last_used ? (
                timestampFormatter.format(new Date(apiKey.last_used))
              ) : (
                <Badge variant="outline" className="text-xs">
                  {t("neverUsed")}
                </Badge>
              )}
            </dd>
          </div>
        </dl>
      </Section>

      {/* Danger zone */}
      <Section label={t("detail.dangerZone")}>
        <Button
          type="button"
          variant="outline"
          onClick={() => setDeleteOpen(true)}
          className="w-full justify-center text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 aria-hidden="true" className="mr-2 size-4" />
          {t("detail.deleteKey")}
        </Button>
      </Section>

      {/* Role change confirmation (fixes U9) */}
      <ConfirmDialog
        open={pendingRoleId !== null}
        onOpenChange={(next) => {
          if (!next) setPendingRoleId(null);
        }}
        variant="default"
        title={t("detail.changeRoleTitle")}
        description={t("detail.changeRoleDescription", {
          name,
          role: pendingRoleId ? roleName(pendingRoleId) : "",
        })}
        confirmLabel={t("detail.changeRoleConfirm")}
        onConfirm={async () => {
          if (!pendingRoleId) return;
          try {
            await onChangeRole(apiKey.id, pendingRoleId);
            toast.success(t("detail.roleUpdated"));
          } catch (error) {
            toast.error(t("detail.roleUpdateFailed"), {
              description: error instanceof Error ? error.message : undefined,
            });
            throw error;
          }
        }}
      />

      {/* Delete confirmation — the shared destructive pattern */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        variant="destructive"
        title={t("detail.deleteTitle")}
        description={t("detail.deleteDescription", { name })}
        confirmLabel={t("detail.deleteConfirm")}
        onConfirm={async () => {
          try {
            await onDelete(apiKey.id);
            toast.success(t("detail.deleted"));
            onDeleted();
          } catch (error) {
            toast.error(t("detail.deleteFailed"), {
              description: error instanceof Error ? error.message : undefined,
            });
            throw error;
          }
        }}
      />
    </div>
  );
}

/** Titled panel section: text-xs uppercase label + content (keys-token.md §3). */
function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      {children}
    </section>
  );
}
