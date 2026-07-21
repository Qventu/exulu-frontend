"use client";

/**
 * TriggersSection — per-routine email trigger editor for /workflows/[id]
 * (email-routines design §7.1). Mirrors the ScheduleSection pattern:
 * anchored <section> for useScrollSpy, DetailSection wrapper, Apollo
 * queries/mutations with the standard toast contract, ConfirmDialog delete.
 *
 * - "Not configured" CTA: emailInboundConfig is super_admin-only, so ONLY a
 *   definitive SA answer can veto the form. Non-SA admins get an authz error
 *   (errorPolicy "all") and see the form optimistically — the upsert
 *   mutation is the authoritative server-side gate and surfaces "email
 *   inbound not configured" as a save error.
 * - No RBAC payload: the server checks routine write access (incl. teams)
 *   + workflows:write and captures run_as_user/run_as_role itself (§3.1).
 * - The address is generated server-side on first save; the form is
 *   remounted per trigger identity (key=) so state hydrates without effects.
 */

import { useMutation, useQuery } from "@apollo/client";
import { Mail, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { CopyField } from "@/components/primitives/copy-field";
import { DetailSection } from "@/components/primitives/detail-section";
import { EmptyState } from "@/components/primitives/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  EMAIL_INBOUND_CONFIG,
  type EmailInboundConfig,
} from "@/lib/email-inbound/queries";

import {
  DELETE_WORKFLOW_TRIGGER,
  GET_WORKFLOW_TRIGGERS,
  UPSERT_WORKFLOW_EMAIL_TRIGGER,
} from "../../queries";
import type { Routine, RoutineAccess } from "../../types";
import {
  DEFAULT_EMAIL_TRIGGER_CONFIG,
  FILTER_FIELDS,
  isValidSenderEntry,
  normalizeEmailTriggerConfig,
  validateFilterPattern,
  type EmailTriggerFilterRule,
  type FilterField,
  type WorkflowTriggerRow,
} from "./trigger-config";

export interface TriggersSectionProps {
  routine: Routine;
  access: RoutineAccess;
}

export function TriggersSection({ routine, access }: TriggersSectionProps) {
  const t = useTranslations("routines");
  const userContext = React.useContext(UserContext);
  const isSuperAdmin = userContext?.user?.super_admin === true;

  const configQuery = useQuery<{
    emailInboundConfig?: EmailInboundConfig | null;
  }>(EMAIL_INBOUND_CONFIG, {
    fetchPolicy: "cache-first",
    errorPolicy: "all",
  });

  const { data, loading, refetch } = useQuery<{
    workflowTriggers?: WorkflowTriggerRow[];
  }>(GET_WORKFLOW_TRIGGERS, {
    variables: { workflow: routine.id },
    fetchPolicy: "cache-and-network",
  });

  const trigger =
    (data?.workflowTriggers ?? []).find((row) => row.type === "email") ?? null;
  const inbound = configQuery.data?.emailInboundConfig;
  const knownNotConfigured =
    !configQuery.loading &&
    !configQuery.error &&
    (!inbound || inbound.enabled !== true || !inbound.inbound_domain);

  return (
    <section id="triggers" className="scroll-mt-20" tabIndex={-1}>
      <DetailSection
        title={t("triggers.title")}
        defaultOpen={true}
        meta={
          trigger
            ? trigger.enabled
              ? t("triggers.metaEnabled")
              : t("triggers.metaDisabled")
            : t("triggers.metaNone")
        }
      >
        {knownNotConfigured ? (
          <EmptyState
            variant="quiet"
            icon={Mail}
            title={t("triggers.notConfigured.title")}
            description={t("triggers.notConfigured.description")}
            action={
              isSuperAdmin
                ? {
                    label: t("triggers.notConfigured.cta"),
                    href: "/configuration/email",
                  }
                : undefined
            }
          />
        ) : loading && !data ? (
          <p className="text-sm text-muted-foreground">
            {t("triggers.loading")}
          </p>
        ) : (
          <TriggerForm
            key={trigger?.id ?? "new"}
            routine={routine}
            access={access}
            trigger={trigger}
            onSaved={refetch}
          />
        )}
      </DetailSection>
    </section>
  );
}

interface TriggerFormProps {
  routine: Routine;
  access: RoutineAccess;
  trigger: WorkflowTriggerRow | null;
  onSaved: () => Promise<unknown>;
}

function TriggerForm({ routine, access, trigger, onSaved }: TriggerFormProps) {
  const t = useTranslations("routines");
  const initial = React.useMemo(
    () =>
      trigger
        ? normalizeEmailTriggerConfig(trigger.config)
        : DEFAULT_EMAIL_TRIGGER_CONFIG,
    [trigger],
  );

  const [enabled, setEnabled] = React.useState(trigger?.enabled ?? false);
  const [senders, setSenders] = React.useState<string[]>(
    initial.allowed_senders,
  );
  const [senderInput, setSenderInput] = React.useState("");
  const [filters, setFilters] = React.useState<EmailTriggerFilterRule[]>(
    initial.filters,
  );
  const [retention, setRetention] = React.useState(
    initial.filtered_run_retention,
  );
  const [ratePerHour, setRatePerHour] = React.useState(
    initial.rate_limit_per_hour,
  );
  const [senderRate, setSenderRate] = React.useState(
    initial.sender_rate_limit_per_hour,
  );
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const [upsertMutate, upsertState] = useMutation(
    UPSERT_WORKFLOW_EMAIL_TRIGGER,
  );
  const [deleteMutate, deleteState] = useMutation(DELETE_WORKFLOW_TRIGGER);

  const config = {
    allowed_senders: senders,
    filters,
    filtered_run_retention: retention,
    rate_limit_per_hour: ratePerHour,
    sender_rate_limit_per_hour: senderRate,
  };
  const dirty =
    (trigger?.enabled ?? false) !== enabled ||
    JSON.stringify(config) !== JSON.stringify(initial);
  const filtersValid = filters.every(
    (rule) => validateFilterPattern(rule.pattern).ok,
  );
  const disabled =
    !access.canWrite || upsertState.loading || deleteState.loading;

  const addSender = () => {
    const value = senderInput.trim().toLowerCase();
    if (value === "") return;
    if (!isValidSenderEntry(value)) {
      toast.error(t("triggers.toast.invalidSender"));
      return;
    }
    if (!senders.includes(value)) setSenders((prev) => [...prev, value]);
    setSenderInput("");
  };

  const handleSave = async () => {
    if (!filtersValid) {
      toast.error(t("triggers.toast.invalidFilters"));
      return;
    }
    try {
      await upsertMutate({
        variables: { workflow: routine.id, enabled, config },
      });
      toast.success(t("triggers.toast.saved"));
      await onSaved();
    } catch (err) {
      toast.error(t("triggers.toast.saveFailed"), {
        description: (err as Error).message,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!trigger) return;
    try {
      await deleteMutate({ variables: { id: trigger.id } });
      toast.success(t("triggers.toast.deleted"));
      await onSaved();
    } catch (err) {
      toast.error(t("triggers.toast.deleteFailed"), {
        description: (err as Error).message,
      });
      throw err; // keep ConfirmDialog open
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Switch
          id="email-trigger-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={disabled}
        />
        <Label htmlFor="email-trigger-enabled">{t("triggers.enable")}</Label>
      </div>

      {trigger?.address ? (
        <CopyField value={trigger.address} label={t("triggers.addressLabel")} />
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("triggers.addressPending")}
        </p>
      )}

      {/* Allowed senders — chips (exact address or *@domain glob) */}
      <div className="space-y-2">
        <Label htmlFor="trigger-sender-input">
          {t("triggers.senders.label")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("triggers.senders.hint")}
        </p>
        {senders.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {senders.map((sender) => (
              <Badge
                key={sender}
                variant="secondary"
                className="gap-1 font-mono text-xs"
              >
                {sender}
                {access.canWrite ? (
                  <button
                    type="button"
                    aria-label={t("triggers.senders.remove", { sender })}
                    onClick={() =>
                      setSenders((prev) => prev.filter((s) => s !== sender))
                    }
                    className="ml-0.5 rounded-full hover:text-destructive"
                  >
                    <X aria-hidden="true" className="size-3" />
                  </button>
                ) : null}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("triggers.senders.empty")}
          </p>
        )}
        {access.canWrite ? (
          <div className="flex gap-2">
            <Input
              id="trigger-sender-input"
              value={senderInput}
              onChange={(e) => setSenderInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSender();
                }
              }}
              placeholder={t("triggers.senders.placeholder")}
              className="max-w-xs font-mono"
              disabled={disabled}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSender}
              disabled={disabled}
            >
              <Plus aria-hidden="true" className="mr-1 size-4" />
              {t("triggers.senders.add")}
            </Button>
          </div>
        ) : null}
      </div>

      {/* Filter rules — field select + regex input rows, validated live */}
      <div className="space-y-2">
        <Label>{t("triggers.filters.label")}</Label>
        <p className="text-xs text-muted-foreground">
          {t("triggers.filters.hint")}
        </p>
        {filters.map((rule, index) => {
          const validation = validateFilterPattern(rule.pattern);
          return (
            <div key={index} className="flex flex-wrap items-start gap-2">
              <Select
                value={rule.field}
                onValueChange={(field) =>
                  setFilters((prev) =>
                    prev.map((r, i) =>
                      i === index ? { ...r, field: field as FilterField } : r,
                    ),
                  )
                }
                disabled={disabled}
              >
                <SelectTrigger
                  className="w-44"
                  aria-label={t("triggers.filters.field")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_FIELDS.map((field) => (
                    <SelectItem key={field} value={field}>
                      {t(`triggers.filters.fields.${field}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Input
                  value={rule.pattern}
                  onChange={(e) =>
                    setFilters((prev) =>
                      prev.map((r, i) =>
                        i === index ? { ...r, pattern: e.target.value } : r,
                      ),
                    )
                  }
                  placeholder={t("triggers.filters.patternPlaceholder")}
                  className="font-mono"
                  aria-label={t("triggers.filters.pattern")}
                  disabled={disabled}
                />
                {!validation.ok ? (
                  <p className="text-xs text-destructive">
                    {t(`triggers.filters.invalid.${validation.reason}`)}
                  </p>
                ) : null}
              </div>
              {access.canWrite ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("triggers.filters.remove")}
                  onClick={() =>
                    setFilters((prev) => prev.filter((_, i) => i !== index))
                  }
                  disabled={disabled}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              ) : null}
            </div>
          );
        })}
        {access.canWrite ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setFilters((prev) => [...prev, { field: "subject", pattern: "" }])
            }
            disabled={disabled}
          >
            <Plus aria-hidden="true" className="mr-1 size-4" />
            {t("triggers.filters.add")}
          </Button>
        ) : null}
      </div>

      {/* Retention + rate limits */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="trigger-retention">
            {t("triggers.limits.retention")}
          </Label>
          <Input
            id="trigger-retention"
            type="number"
            min={0}
            value={retention}
            onChange={(e) =>
              setRetention(Math.max(0, parseInt(e.target.value || "0", 10)))
            }
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="trigger-rate">{t("triggers.limits.perHour")}</Label>
          <Input
            id="trigger-rate"
            type="number"
            min={1}
            value={ratePerHour}
            onChange={(e) =>
              setRatePerHour(Math.max(1, parseInt(e.target.value || "1", 10)))
            }
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="trigger-sender-rate">
            {t("triggers.limits.perSenderPerHour")}
          </Label>
          <Input
            id="trigger-sender-rate"
            type="number"
            min={1}
            value={senderRate}
            onChange={(e) =>
              setSenderRate(Math.max(1, parseInt(e.target.value || "1", 10)))
            }
            disabled={disabled}
          />
        </div>
      </div>

      {/* Operator hint (design §8): approval-gate externally-visible tools. */}
      <p className="text-xs text-muted-foreground">
        {t("triggers.securityHint")}
      </p>

      {access.canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSave}
            disabled={!dirty || !filtersValid || upsertState.loading}
          >
            {upsertState.loading
              ? t("triggers.saving")
              : trigger
                ? t("triggers.update")
                : t("triggers.save")}
          </Button>
          {trigger ? (
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(true)}
              disabled={deleteState.loading}
            >
              <Trash2 aria-hidden="true" className="mr-2 size-4" />
              {t("triggers.remove")}
            </Button>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("triggers.delete.title")}
        description={t("triggers.delete.description", { name: routine.name })}
        variant="destructive"
        onConfirm={handleConfirmDelete}
        confirmLabel={t("triggers.delete.confirmLabel")}
      />
    </div>
  );
}
