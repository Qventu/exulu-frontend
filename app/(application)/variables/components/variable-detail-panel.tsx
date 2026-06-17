"use client";

/**
 * VariableDetailPanel — read-side detail surface for a selected variable
 * (Phase 4.5 redesign, variables.md §3).
 *
 * Mounted by the list page through ListDetail (panel mode). At lg+ it docks
 * right inside the ListDetail aside; at <lg the ListDetail's built-in Sheet
 * renders the same content (right at md–lg, bottom <md).
 *
 * Sections:
 *  1) Header — mono name + Type badge.
 *  2) Value — SecretField. `getValue` fetches GET_VARIABLE_VALUE under
 *     fetchPolicy: "no-cache" so Apollo never caches the secret. Re-masks
 *     after 30s. Hidden entirely in read-only mode.
 *  3) Usage — calls GET_VARIABLE_USAGE; degrades to "Usage unavailable" on
 *     field-missing error (BE-1 not shipped), shows EmptyState when used_by
 *     is an empty array, and lists "type/id" entries when populated. The
 *     "View full usage" link deep-links to /variables/usage/[id].
 *  4) Meta — Created, Last updated (RelativeTime + absolute tooltip), ID
 *     (CopyField).
 *  5) Footer — Edit + Delete actions (Delete uses ConfirmDialog). Both hidden
 *     in read-only mode.
 */

import { useApolloClient, useMutation, useQuery } from "@apollo/client";
import { Edit, ExternalLink, Lock, Trash2, Unlock } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { CopyField } from "@/components/primitives/copy-field";
import { EmptyState } from "@/components/primitives/empty-state";
import { RelativeTime } from "@/components/primitives/relative-time";
import { SecretField } from "@/components/primitives/secret-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GET_VARIABLE_USAGE,
  GET_VARIABLE_VALUE,
  GET_VARIABLES_LIST,
  REMOVE_VARIABLE_BY_ID,
} from "@/queries/queries";

import { Variable } from "./columns";

export interface VariableDetailPanelProps {
  variable: Variable;
  readOnly?: boolean;
  /** Called after a successful delete so the parent can clear selection. */
  onDeleted?: () => void;
}

function TypeBadge({ encrypted }: { encrypted: boolean }) {
  const t = useTranslations();
  if (encrypted) {
    return (
      <Badge variant="outline" className="gap-1.5">
        <Lock aria-hidden="true" className="size-3.5" strokeWidth={1} />
        {t("variables.type.secret")}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-950/50 dark:text-amber-300"
    >
      <Unlock aria-hidden="true" className="size-3.5" strokeWidth={1} />
      {t("variables.type.plain")}
    </Badge>
  );
}

interface UsageSectionProps {
  variableId: string;
}

function UsageSection({ variableId }: UsageSectionProps) {
  const t = useTranslations();

  // The query is guarded — if the backend has not landed `used_by` on
  // Variable, the resolver errors with a "field missing" GraphQL error and
  // we render the "Usage unavailable" branch. Once BE-1 ships, `data.used_by`
  // is an array of "type/id" strings.
  const { data, loading, error } = useQuery(GET_VARIABLE_USAGE, {
    variables: { id: variableId },
    fetchPolicy: "cache-first",
    errorPolicy: "all",
  });

  if (loading && !data) {
    return (
      <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
    );
  }

  const fieldMissing = Boolean(
    error?.graphQLErrors?.some(
      (e) =>
        e?.message?.toLowerCase?.().includes("used_by") ||
        e?.message?.toLowerCase?.().includes("cannot query field"),
    ),
  );

  // No data at all AND error → treat as unavailable.
  const usedBy: string[] | null | undefined = data?.variableById?.used_by;
  if (fieldMissing || (error && usedBy === undefined)) {
    return (
      <p className="text-sm italic text-muted-foreground">
        {t("variables.usedBy.unavailableBody")}
      </p>
    );
  }

  if (!usedBy || usedBy.length === 0) {
    return (
      <EmptyState
        variant="quiet"
        title={t("variables.usage.empty.title")}
        description={t("variables.usage.empty.body")}
      />
    );
  }

  const preview = usedBy.slice(0, 6);
  const overflow = usedBy.length - preview.length;
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5">
        {preview.map((entry, index) => {
          const [type, ...rest] = entry.split("/");
          const id = rest.join("/");
          return (
            <li
              key={`${entry}-${index}`}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="text-muted-foreground capitalize">{type}</span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {id}
              </span>
            </li>
          );
        })}
      </ul>
      {overflow > 0 && (
        <p className="text-xs text-muted-foreground">
          +{overflow} more
        </p>
      )}
      <Link
        href={`/variables/usage/${variableId}`}
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        {t("variables.detail.usage")}
        <ExternalLink aria-hidden="true" className="size-3.5" />
      </Link>
    </div>
  );
}

export function VariableDetailPanel({
  variable,
  readOnly = false,
  onDeleted,
}: VariableDetailPanelProps) {
  const t = useTranslations();
  const router = useRouter();
  const client = useApolloClient();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const [removeVariable] = useMutation(REMOVE_VARIABLE_BY_ID, {
    refetchQueries: [GET_VARIABLES_LIST, "GetVariablesList"],
  });

  const fetchValue = React.useCallback(async () => {
    const result = await client.query({
      query: GET_VARIABLE_VALUE,
      variables: { id: variable.id },
      fetchPolicy: "no-cache",
    });
    const value = result?.data?.variableById?.value;
    return typeof value === "string" ? value : "";
  }, [client, variable.id]);

  const handleDelete = async () => {
    try {
      await removeVariable({ variables: { id: variable.id } });
      toast.success(t("variables.delete.success"));
      onDeleted?.();
    } catch (error) {
      toast.error(t("variables.delete.error"));
      throw error;
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-2 min-w-0">
          <h2 className="font-mono text-lg font-semibold truncate min-w-0">
            {variable.name}
          </h2>
          <div className="flex items-center gap-2">
            <TypeBadge encrypted={variable.encrypted} />
          </div>
        </div>

        {/* Value section — hidden in read-only mode (audit view) */}
        {!readOnly && variable.encrypted && (
          <section className="flex flex-col gap-2">
            <SecretField
              getValue={fetchValue}
              remaskAfterMs={30_000}
              canCopyWithoutReveal
              label={t("variables.detail.value")}
              copyLabel={t("variables.detail.copyValue")}
            />
          </section>
        )}
        {!readOnly && !variable.encrypted && (
          <section className="flex flex-col gap-2">
            {/* Plain-text values are not secret per se, but still go through
                the on-demand value fetch — same primitive, same audit point. */}
            <SecretField
              getValue={fetchValue}
              canCopyWithoutReveal
              label={t("variables.detail.value")}
              copyLabel={t("variables.detail.copyValue")}
            />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("variables.type.plainWarning")}
            </p>
          </section>
        )}

        {/* Usage */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-foreground">
            {t("variables.detail.usage")}
          </h3>
          <UsageSection variableId={variable.id} />
        </section>

        {/* Meta */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-foreground">
            {t("variables.detail.meta")}
          </h3>
          <dl className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">
                {t("variables.detail.created")}
              </dt>
              <dd className="text-foreground">
                <RelativeTime date={variable.createdAt} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">
                {t("variables.detail.updated")}
              </dt>
              <dd className="text-foreground">
                <RelativeTime date={variable.updatedAt} />
              </dd>
            </div>
            <div className="flex flex-col gap-1.5">
              <dt className="text-muted-foreground">
                {t("variables.detail.id")}
              </dt>
              <dd>
                <CopyField value={variable.id} mono />
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Footer */}
      {!readOnly && (
        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-background p-4">
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 size-4" strokeWidth={1} />
            {t("variables.actions.delete")}
          </Button>
          <Button
            onClick={() => router.push(`/variables/edit/${variable.id}`)}
          >
            <Edit className="mr-2 size-4" strokeWidth={1} />
            {t("variables.actions.edit")}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("variables.delete.title")}
        description={t("variables.delete.bodyUnused", { name: variable.name })}
        confirmLabel={t("variables.delete.confirm")}
        onConfirm={handleDelete}
      />
    </div>
  );
}
