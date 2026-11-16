"use client";

/**
 * WorkStatusesSection — the routine's own work statuses (backend spec
 * 2026-11-16-routine-work-status-design): the list people work the runs with
 * ("Neu", "Angebot im ERP angelegt", "Erledigt"), which of them count as
 * done, and the status a new run starts with.
 *
 * Saves on its own, independent of the page-level SaveBar: the list is one
 * JSON value on the routine, validated as a whole. A status key is derived
 * from the label while the status is new and never changes after the first
 * save — runs and tool code refer to statuses by key.
 */

import { useMutation } from "@apollo/client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deriveStatusKey,
  validateWorkStatusDraft,
  WORK_STATUS_COLORS,
  WORK_STATUS_DOT_CLASS,
  type WorkStatusColor,
  type WorkStatusConfig,
} from "@/lib/routine-runs/work-status";
import { cn } from "@/lib/utils";

import { UPDATE_WORKFLOW_TEMPLATE } from "../../queries";

interface Row {
  /** Stable React key; the status key itself changes while a row is new. */
  id: string;
  key: string;
  label: string;
  color: WorkStatusColor;
  done: boolean;
  isNew: boolean;
}

interface Draft {
  rows: Row[];
  default: string | null;
}

const toDraft = (config: WorkStatusConfig): Draft => ({
  rows: config.statuses.map((status) => ({
    id: status.key,
    key: status.key,
    label: status.label,
    color: status.color ?? "gray",
    done: status.done === true,
    isNew: false,
  })),
  default: config.default,
});

const toConfig = (draft: Draft): WorkStatusConfig => ({
  statuses: draft.rows.map(({ key, label, color, done }) => ({ key, label: label.trim(), color, done })),
  default: draft.default,
});

/** The default must be an open status: keep it when it still is one, else the first open row. */
const withValidDefault = (draft: Draft): Draft => {
  const current = draft.rows.find((row) => row.key === draft.default);
  if (current && !current.done) return draft;
  return { ...draft, default: draft.rows.find((row) => !row.done)?.key ?? null };
};

export interface WorkStatusesSectionProps {
  routineId: string;
  /** The config as last saved. */
  saved: WorkStatusConfig;
  canWrite: boolean;
  onSaved: (config: WorkStatusConfig) => void;
  /** Lets the page guard navigation while status edits are unsaved. */
  onDirtyChange?: (dirty: boolean) => void;
}

export function WorkStatusesSection({ routineId, saved, canWrite, onSaved, onDirtyChange }: WorkStatusesSectionProps) {
  const t = useTranslations("routines.workStatus");
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(saved));
  const [baseline, setBaseline] = React.useState(() => JSON.stringify(toConfig(toDraft(saved))));
  const nextId = React.useRef(0);
  const [save, { loading: saving }] = useMutation(UPDATE_WORKFLOW_TEMPLATE);

  const config = toConfig(draft);
  const { errors, warnings } = validateWorkStatusDraft(config);
  const dirty = JSON.stringify(config) !== baseline;
  const reportDirty = React.useRef(onDirtyChange);
  reportDirty.current = onDirtyChange;
  React.useEffect(() => {
    reportDirty.current?.(dirty);
  }, [dirty]);

  const patchRow = (id: string, patch: Partial<Row>) =>
    setDraft((current) => {
      const before = current.rows.find((row) => row.id === id);
      if (!before) return current;
      const others = current.rows.filter((row) => row.id !== id).map((row) => row.key);
      const next: Row = { ...before, ...patch };
      if (next.isNew && patch.label !== undefined) next.key = deriveStatusKey(next.label, others);
      const rows = current.rows.map((row) => (row.id === id ? next : row));
      // The default follows a new row through its key changes.
      const def = current.default === before.key ? next.key : current.default;
      return withValidDefault({ rows, default: def });
    });

  const addRow = () =>
    setDraft((current) => {
      const key = deriveStatusKey("", current.rows.map((row) => row.key));
      const row: Row = { id: `new-${nextId.current++}`, key, label: "", color: "gray", done: false, isNew: true };
      return withValidDefault({ ...current, rows: [...current.rows, row] });
    });

  const removeRow = (id: string) =>
    setDraft((current) => withValidDefault({ ...current, rows: current.rows.filter((row) => row.id !== id) }));

  const moveRow = (index: number, by: -1 | 1) =>
    setDraft((current) => {
      const target = index + by;
      if (target < 0 || target >= current.rows.length) return current;
      const rows = [...current.rows];
      [rows[index], rows[target]] = [rows[target], rows[index]];
      return { ...current, rows };
    });

  const handleSave = async () => {
    const value = config.statuses.length > 0 ? config : null;
    try {
      await save({ variables: { id: routineId, work_statuses: value } });
      setDraft((current) => ({ ...current, rows: current.rows.map((row) => ({ ...row, isNew: false })) }));
      setBaseline(JSON.stringify(config));
      onSaved(config);
      toast.success(t("saved"));
    } catch (error) {
      toast.error(t("saveFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <section id="workStatuses" className="scroll-mt-20 space-y-4" tabIndex={-1}>
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        {!canWrite ? <p className="text-sm text-muted-foreground">{t("readOnly")}</p> : null}
      </div>

      {draft.rows.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border">
          {draft.rows.map((row, index) => (
            <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
              {canWrite ? (
                <div className="flex flex-col">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-5"
                    aria-label={t("moveUp")}
                    disabled={index === 0}
                    onClick={() => moveRow(index, -1)}
                  >
                    <ArrowUp aria-hidden className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-5"
                    aria-label={t("moveDown")}
                    disabled={index === draft.rows.length - 1}
                    onClick={() => moveRow(index, 1)}
                  >
                    <ArrowDown aria-hidden className="size-3" />
                  </Button>
                </div>
              ) : null}

              <div className="min-w-40 flex-1 space-y-0.5">
                <Input
                  value={row.label}
                  placeholder={t("labelPlaceholder")}
                  aria-label={t("labelPlaceholder")}
                  disabled={!canWrite}
                  onChange={(event) => patchRow(row.id, { label: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {t("key")}: <code data-testid="status-key" className="font-mono">{row.key}</code>
                </p>
              </div>

              <div role="radiogroup" aria-label={t("color")} className="flex items-center gap-1">
                {WORK_STATUS_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={row.color === color}
                    aria-label={color}
                    disabled={!canWrite}
                    onClick={() => patchRow(row.id, { color })}
                    className={cn(
                      "size-4 rounded-full ring-offset-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      WORK_STATUS_DOT_CLASS[color],
                      row.color === color && "ring-2 ring-foreground",
                    )}
                  />
                ))}
              </div>

              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={row.done}
                  disabled={!canWrite}
                  onChange={(event) => patchRow(row.id, { done: event.target.checked })}
                />
                {t("done")}
              </label>

              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name={`work-status-default-${routineId}`}
                  className="size-4 accent-primary"
                  checked={draft.default === row.key}
                  disabled={!canWrite || row.done}
                  onChange={() => setDraft((current) => ({ ...current, default: row.key }))}
                />
                {t("default")}
              </label>

              {canWrite ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("remove")}
                  onClick={() => removeRow(row.id)}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {errors.map((error) => (
        <p key={error} role="alert" className="text-sm text-destructive">
          {t(`validation.${error}`)}
        </p>
      ))}
      {warnings.map((warning) => (
        <p key={warning} className="text-sm text-muted-foreground">
          {t(`validation.${warning}`)}
        </p>
      ))}

      {canWrite ? (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus aria-hidden className="mr-1 size-4" />
            {t("add")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!dirty || errors.length > 0 || saving}
            onClick={() => void handleSave()}
          >
            {t("save")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
