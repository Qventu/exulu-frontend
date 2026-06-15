"use client";

/**
 * /variables/edit/[id] — edit form (Phase 4.5 redesign per variables.md §3).
 *
 * Key behaviors:
 * - Initial load uses GET_VARIABLE_BY_ID (no value). The form's `value` field
 *   stays empty and is treated as "unchanged" unless the user opts into
 *   "Replace value".
 * - "Show current value" reveals on demand via GET_VARIABLE_VALUE with
 *   fetchPolicy: "no-cache" — secrets never sit in Apollo's normalized store
 *   between reveals (philosophy §9).
 * - Rename and Secret→Plain submissions trigger a single combined
 *   ConfirmDialog with bullet items (one overlay max).
 * - Error vs not-found gate is split (U19): connection failures render an
 *   inline error block with Retry; truly missing renders an EmptyState.
 * - Form-shaped Skeleton instead of a full-page spinner (#33).
 * - Client-side write-role redirect (the server route guard checks read-only).
 */

import { useApolloClient, useMutation, useQuery } from "@apollo/client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { CopyField } from "@/components/primitives/copy-field";
import { EmptyState } from "@/components/primitives/empty-state";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { can } from "@/lib/rights";
import { cn } from "@/lib/utils";
import {
  GET_VARIABLE_BY_ID,
  GET_VARIABLE_USAGE,
  GET_VARIABLE_VALUE,
  GET_VARIABLES_LIST,
  UPDATE_VARIABLE,
} from "@/queries/queries";

export const dynamic = "force-dynamic";

type FormErrors = { name?: string; value?: string };

function FormSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

export default function EditVariablePage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("variables");
  const tCommon = useTranslations("common");
  const apollo = useApolloClient();
  const userContext = React.useContext(UserContext);

  const variableId = params.variable_id as string;

  const [formData, setFormData] = React.useState({
    name: "",
    value: "",
    encrypted: false,
  });
  const [originalName, setOriginalName] = React.useState("");
  const [originalEncrypted, setOriginalEncrypted] = React.useState(false);
  const [replaceMode, setReplaceMode] = React.useState(false);
  const [revealedValue, setRevealedValue] = React.useState<string | null>(null);
  const [revealing, setRevealing] = React.useState(false);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [redirected, setRedirected] = React.useState(false);

  const canWrite = React.useMemo(() => {
    const user = userContext?.user;
    if (!user) return false;
    return can(
      { super_admin: user.super_admin === true, role: user.role },
      { area: "variables", level: "write" },
    );
  }, [userContext]);

  React.useEffect(() => {
    if (!userContext?.user) return;
    if (canWrite) return;
    if (redirected) return;
    setRedirected(true);
    toast.info(t("readOnly.redirect"));
    router.replace(`/variables?selected=${variableId}`);
  }, [canWrite, redirected, router, t, userContext?.user, variableId]);

  const {
    loading: queryLoading,
    error,
    data,
    refetch,
  } = useQuery(GET_VARIABLE_BY_ID, {
    variables: { id: variableId },
    skip: !variableId,
  });

  const variable = data?.variableById as
    | {
        id: string;
        name: string;
        encrypted: boolean;
        createdAt: string;
        updatedAt: string;
      }
    | null
    | undefined;

  // Usage (BE-1 guarded). Errors are caught — we render "unavailable" in the
  // meta block (never a fake 0).
  const usageQuery = useQuery(GET_VARIABLE_USAGE, {
    variables: { id: variableId },
    skip: !variableId,
    errorPolicy: "all",
  });
  const usedBy: string[] | null | undefined =
    (usageQuery.data?.variableById as { used_by?: string[] | null } | null)
      ?.used_by ?? (usageQuery.error ? null : undefined);
  const usedByCount = Array.isArray(usedBy) ? usedBy.length : null;

  React.useEffect(() => {
    if (variable) {
      setFormData({
        name: variable.name || "",
        value: "",
        encrypted: variable.encrypted || false,
      });
      setOriginalName(variable.name || "");
      setOriginalEncrypted(variable.encrypted || false);
    }
  }, [variable]);

  const [updateVariable, { loading: updateLoading }] = useMutation(
    UPDATE_VARIABLE,
    {
      refetchQueries: [
        { query: GET_VARIABLES_LIST, variables: { page: 1, limit: 10 } },
        "GetVariablesList",
        "GetVariablesLite",
      ],
    },
  );

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!formData.name.trim()) {
      next.name = t("form.nameRequired");
    }
    if (replaceMode && !formData.value.trim()) {
      next.value = t("form.valueRequired");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const setField = <K extends keyof typeof formData>(
    key: K,
    value: (typeof formData)[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (key === "name" || key === "value") {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const hasRename =
    originalName.trim() !== "" && originalName.trim() !== formData.name.trim();
  const hasSecretToPlain = originalEncrypted && !formData.encrypted;
  const needsConfirm = hasRename || hasSecretToPlain;

  const performUpdate = async () => {
    try {
      const vars: Record<string, unknown> = {
        id: variableId,
        name: formData.name.trim(),
        encrypted: formData.encrypted,
      };
      // Only send the value when the user opted into replacement — backend
      // treats undefined as "unchanged" (UPDATE_VARIABLE plan, point 6).
      if (replaceMode) {
        vars.value = formData.value;
      }
      await updateVariable({ variables: vars });
      toast.success(t("edit.success", { name: formData.name.trim() }));
      router.push(`/variables?selected=${variableId}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("edit.errorGeneric");
      toast.error(tCommon("somethingWentWrong"), { description: message });
      throw err;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (needsConfirm) {
      setConfirmOpen(true);
      return;
    }
    void performUpdate();
  };

  const handleShowCurrentValue = async () => {
    if (revealing) return;
    if (revealedValue !== null) {
      setRevealedValue(null);
      return;
    }
    setRevealing(true);
    try {
      const result = await apollo.query<{
        variableById: { id: string; value: string };
      }>({
        query: GET_VARIABLE_VALUE,
        variables: { id: variableId },
        fetchPolicy: "no-cache",
      });
      const value = result.data?.variableById?.value ?? "";
      setRevealedValue(value);
      // Auto-remask after 30s — secret never sits in memory longer than the
      // reveal window (variables.md §3).
      window.setTimeout(() => setRevealedValue(null), 30_000);
    } catch {
      toast.error(t("edit.revealFailed"));
    } finally {
      setRevealing(false);
    }
  };

  // Hide nothing of substance while the redirect runs.
  if (userContext?.user && !canWrite) {
    return null;
  }

  if (queryLoading) {
    return (
      <PageShell variant="narrow">
        <PageHeader
          title={t("edit.title")}
          breadcrumb={{ label: t("title"), href: "/variables" }}
        />
        <FormSkeleton />
      </PageShell>
    );
  }

  // U19: connection failure → inline error + Retry. Distinct from "missing".
  // We treat any GraphQL error with no resolved variable as the error gate.
  if (error && !variable) {
    return (
      <PageShell variant="narrow">
        <PageHeader
          title={t("edit.title")}
          breadcrumb={{ label: t("title"), href: "/variables" }}
        />
        <EmptyState
          variant="error"
          title={t("edit.loadErrorTitle")}
          description={t("edit.loadErrorBody")}
          action={{ label: tCommon("retry"), onClick: () => void refetch() }}
        />
      </PageShell>
    );
  }

  // U19: not-found gate (no error, just a null resolver).
  if (!variable) {
    return (
      <PageShell variant="narrow">
        <PageHeader
          title={t("edit.title")}
          breadcrumb={{ label: t("title"), href: "/variables" }}
        />
        <EmptyState
          title={t("edit.notFoundTitle")}
          description={t("edit.notFoundBody")}
          action={{ label: t("actions.back"), href: "/variables" }}
        />
      </PageShell>
    );
  }

  const showValueField = replaceMode;

  return (
    <PageShell variant="narrow">
      <PageHeader
        title={t("edit.title")}
        description={t("edit.description", { name: variable.name })}
        breadcrumb={{ label: t("title"), href: "/variables" }}
      />

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Type */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t("form.type")}</Label>
          <RadioGroup
            value={formData.encrypted ? "secret" : "plain"}
            onValueChange={(value) =>
              setField("encrypted", value === "secret")
            }
            className="gap-3"
          >
            <div className="flex items-start gap-3 rounded-md border border-input p-3">
              <RadioGroupItem
                value="secret"
                id="type-secret"
                className="mt-0.5"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Label
                  htmlFor="type-secret"
                  className="cursor-pointer font-medium"
                >
                  {t("form.typeSecret")}
                </Label>
                <span className="text-sm text-muted-foreground">
                  {t("form.typeSecretDescription")}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-md border border-input p-3">
              <RadioGroupItem
                value="plain"
                id="type-plain"
                className="mt-0.5"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Label
                  htmlFor="type-plain"
                  className="cursor-pointer font-medium"
                >
                  {t("form.typePlain")}
                </Label>
                <span className="text-sm text-muted-foreground">
                  {t("form.typePlainDescription")}
                </span>
                <span
                  className={cn(
                    "mt-1 text-sm text-warning-foreground transition-opacity duration-150 ease-in-out motion-reduce:transition-none",
                    formData.encrypted ? "opacity-0" : "opacity-100",
                  )}
                  aria-hidden={formData.encrypted}
                >
                  {t("form.typePlainWarning")}
                </span>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            {t("form.name")}{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <Input
            id="name"
            type="text"
            className="font-mono"
            placeholder={t("form.namePlaceholder")}
            value={formData.name}
            onChange={(e) => setField("name", e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : "name-help"}
            autoComplete="off"
            spellCheck={false}
          />
          {errors.name ? (
            <p id="name-error" className="text-sm text-destructive">
              {errors.name}
            </p>
          ) : (
            <p id="name-help" className="text-sm text-muted-foreground">
              {t("form.nameHelper")}
            </p>
          )}
        </div>

        {/* Value — collapsed "Replace value" by default. */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {t("form.value")}
          </Label>
          {!showValueField ? (
            <div className="space-y-2 rounded-md border border-dashed p-3">
              <p className="text-sm text-muted-foreground">
                {t("edit.replaceValueHelp")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReplaceMode(true)}
              >
                {t("actions.replaceValue")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                id="value"
                className="font-mono"
                placeholder={t("form.valuePlaceholder")}
                value={revealedValue ?? formData.value}
                onChange={(e) => setField("value", e.target.value)}
                rows={4}
                aria-invalid={Boolean(errors.value)}
                aria-describedby={errors.value ? "value-error" : "value-help"}
                readOnly={revealedValue !== null}
                spellCheck={false}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  id="value-help"
                  className={cn(
                    "text-sm",
                    errors.value ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {errors.value
                    ? errors.value
                    : formData.encrypted
                      ? t("form.valueHelperSecret")
                      : t("form.valueHelperPlain")}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={handleShowCurrentValue}
                    disabled={revealing}
                    className="h-auto p-0"
                  >
                    {revealedValue !== null
                      ? t("edit.replaceValueHide")
                      : revealing
                        ? t("edit.replaceValueLoading")
                        : t("edit.replaceValueShow")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReplaceMode(false);
                      setRevealedValue(null);
                      setField("value", "");
                    }}
                  >
                    {tCommon("cancel")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t bg-background p-4 md:-mx-8 md:px-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/variables?selected=${variableId}`)}
            disabled={updateLoading}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={updateLoading}>
            {updateLoading ? t("edit.submitting") : t("edit.submit")}
          </Button>
        </div>
      </form>

      {/* Meta block — plain section, no card wrapper. */}
      <section className="space-y-3 border-t pt-6">
        <h2 className="text-lg font-medium">{t("edit.metaTitle")}</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground">
              {t("edit.metaCreated")}
            </dt>
            <dd className="text-sm">
              <RelativeTime date={variable.createdAt} />
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground">
              {t("edit.metaUpdated")}
            </dt>
            <dd className="text-sm">
              <RelativeTime date={variable.updatedAt} />
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground">
              {t("edit.metaUsedBy")}
            </dt>
            <dd className="text-sm">
              {usedByCount === null ? (
                <span className="text-muted-foreground">
                  {t("usedBy.unavailable")}
                </span>
              ) : usedByCount === 0 ? (
                <span className="text-muted-foreground">
                  {t("edit.metaUsedByNone")}
                </span>
              ) : (
                <Link
                  href={`/variables/usage/${variableId}`}
                  className="text-sm underline-offset-4 hover:underline"
                >
                  {t("edit.metaUsedByCount", { count: usedByCount })}
                </Link>
              )}
            </dd>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <CopyField
              label={t("edit.metaId")}
              value={variable.id}
              mono
            />
          </div>
        </dl>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        variant="default"
        title={t("edit.confirmTitle")}
        confirmLabel={t("edit.submit")}
        onConfirm={async () => {
          await performUpdate();
        }}
      >
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {hasRename ? (
            <li>
              <span>
                {t("rename.body", {
                  oldName: originalName,
                  newName: formData.name.trim(),
                })}
              </span>{" "}
              {Array.isArray(usedBy) && usedBy.length > 0 ? (
                <>
                  <span className="block text-muted-foreground">
                    {t("edit.confirmRename", { count: usedBy.length })}
                  </span>
                  <Link
                    href={`/variables/usage/${variableId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {t("edit.confirmViewUsage")}
                  </Link>
                </>
              ) : null}
            </li>
          ) : null}
          {hasSecretToPlain ? <li>{t("edit.confirmSecretToPlain")}</li> : null}
        </ul>
      </ConfirmDialog>
    </PageShell>
  );
}
