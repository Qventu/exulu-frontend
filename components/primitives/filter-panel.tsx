"use client";

/**
 * FilterPanel — declarative filter + preview + limit primitive.
 *
 * Spec: design/codebase-structure.md §2.3/§2.4 / design/pages/knowledge.md
 * §3 "Layout & components". Generalizes the old `app/(application)/data/
 * components/items-filter.tsx` so the bulk Process / Generate / Delete
 * dialogs share one shape, and any future list page (evals etc.) gets the
 * same affordance for free.
 *
 * Caller supplies a declarative `fields` array (text contains / datetime
 * gte+lte / number-range gte+lte). The right column is a render-slot —
 * the caller owns the preview query (knowledge passes a useQuery'd
 * preview render; primitives may never import Apollo themselves, per
 * components/primitives/README.md §"Import boundaries").
 *
 * Responsive: filters/preview stack < md; ≥ md they share a 2-column grid.
 * Fixes today's `grid-cols-${n}` JIT bug.
 *
 * The CTA label is supplied by the caller as a fully-rendered string so
 * the consumer can compute `min(limit, matched)` — fixing the page-doc's
 * #37 limit-vs-count ambiguity.
 *
 * i18n: only `common.*` keys are used internally (cancel/clear/apply etc.).
 * Field labels arrive resolved.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type FilterFieldType = "text" | "datetime" | "number-range";

export interface FilterFieldDef {
  /** Field identifier, e.g. "name", "createdAt". */
  id: string;
  /** Resolved label (caller does i18n). */
  label: string;
  type: FilterFieldType;
  /** Optional placeholder for `text` fields. */
  placeholder?: string;
  /**
   * GraphQL field key — separated from id to let consumers reshape filter
   * objects without re-keying the UI state.
   */
  graphqlField?: string;
}

export interface FilterPanelBatchLimit {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  /** Helper text under the limit input (already i18n-resolved). */
  hint?: string;
}

export interface FilterPanelProps<TValue extends Record<string, unknown>> {
  fields: FilterFieldDef[];
  value: TValue;
  onChange: (next: TValue) => void;
  /** When set, the right column renders this preview (knowledge bulk ops). */
  preview?: React.ReactNode;
  /** L3 bulk-op batch limit row (1–500). Omitted = no limit row. */
  batchLimit?: FilterPanelBatchLimit;
  /** Fully-resolved CTA copy — caller computes `min(limit, matched)`. */
  ctaLabel: string;
  /** Cancel-button copy. */
  cancelLabel: string;
  onCancel: () => void;
  onClear?: () => void;
  onConfirm: () => Promise<void> | void;
  loading?: boolean;
  className?: string;
}

/* -------------------------------------------------------------------------- */

function setKey<T extends Record<string, unknown>>(
  obj: T,
  key: string,
  next: unknown,
): T {
  const out: Record<string, unknown> = { ...obj };
  if (next === undefined || next === "" || next === null) {
    delete out[key];
  } else {
    out[key] = next;
  }
  return out as T;
}

function FieldRow<T extends Record<string, unknown>>({
  field,
  value,
  onChange,
}: {
  field: FilterFieldDef;
  value: T;
  onChange: (next: T) => void;
}) {
  const idGte = `${field.id}_gte`;
  const idLte = `${field.id}_lte`;

  if (field.type === "text") {
    const current = (value as Record<string, unknown>)[field.id] as
      | string
      | undefined;
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={field.id}>{field.label}</Label>
        <Input
          id={field.id}
          value={current ?? ""}
          onChange={(e) => onChange(setKey(value, field.id, e.target.value))}
          placeholder={field.placeholder}
        />
      </div>
    );
  }

  if (field.type === "datetime") {
    const gte = (value as Record<string, unknown>)[idGte] as string | undefined;
    const lte = (value as Record<string, unknown>)[idLte] as string | undefined;
    return (
      <div className="flex flex-col gap-2">
        <Label>{field.label}</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            type="datetime-local"
            value={gte ?? ""}
            onChange={(e) => onChange(setKey(value, idGte, e.target.value))}
            aria-label={`${field.label} — from`}
          />
          <Input
            type="datetime-local"
            value={lte ?? ""}
            onChange={(e) => onChange(setKey(value, idLte, e.target.value))}
            aria-label={`${field.label} — to`}
          />
        </div>
      </div>
    );
  }

  // number-range
  const gte = (value as Record<string, unknown>)[idGte] as number | undefined;
  const lte = (value as Record<string, unknown>)[idLte] as number | undefined;
  return (
    <div className="flex flex-col gap-2">
      <Label>{field.label}</Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          type="number"
          value={gte ?? ""}
          onChange={(e) =>
            onChange(
              setKey(
                value,
                idGte,
                e.target.value ? parseInt(e.target.value, 10) : undefined,
              ),
            )
          }
          aria-label={`${field.label} — min`}
          placeholder="Min"
        />
        <Input
          type="number"
          value={lte ?? ""}
          onChange={(e) =>
            onChange(
              setKey(
                value,
                idLte,
                e.target.value ? parseInt(e.target.value, 10) : undefined,
              ),
            )
          }
          aria-label={`${field.label} — max`}
          placeholder="Max"
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function FilterPanel<T extends Record<string, unknown>>({
  fields,
  value,
  onChange,
  preview,
  batchLimit,
  ctaLabel,
  cancelLabel,
  onCancel,
  onClear,
  onConfirm,
  loading,
  className,
}: FilterPanelProps<T>) {
  const t = useTranslations("common");
  const [busy, setBusy] = React.useState(false);
  const pending = loading || busy;

  const handleConfirm = async () => {
    if (pending) return;
    try {
      setBusy(true);
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-6", className)}>
      {/* Body — filters left, preview right (stacks below md). */}
      <div
        className={cn(
          "grid min-h-0 flex-1 gap-6 overflow-auto",
          preview ? "md:grid-cols-2" : "grid-cols-1",
        )}
      >
        {/* Filters column */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">{t("filters")}</h3>

          {fields.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              value={value}
              onChange={onChange}
            />
          ))}

          {batchLimit ? (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-panel-limit">
                  {t("limit")}
                  {batchLimit.hint ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {batchLimit.hint}
                    </span>
                  ) : null}
                </Label>
                <Input
                  id="filter-panel-limit"
                  type="number"
                  min={batchLimit.min ?? 1}
                  max={batchLimit.max ?? 500}
                  value={batchLimit.value || ""}
                  onChange={(e) =>
                    batchLimit.onChange(parseInt(e.target.value || "0", 10))
                  }
                />
              </div>
            </>
          ) : null}

          {onClear ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClear}
              className="w-full"
              disabled={pending}
            >
              {t("clearFilters")}
            </Button>
          ) : null}
        </div>

        {/* Preview column — caller-owned render slot. */}
        {preview ? (
          <div className="flex min-h-0 flex-col gap-4 md:border-l md:pl-6">
            <h3 className="text-sm font-semibold">{t("preview")}</h3>
            <div className="min-h-0 flex-1">{preview}</div>
          </div>
        ) : null}
      </div>

      {/* Footer — sticky CTA row. */}
      <div className="flex w-full items-center justify-between gap-2 border-t pt-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleConfirm}
          disabled={pending}
          aria-busy={pending}
        >
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}
