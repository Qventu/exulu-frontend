"use client";

/**
 * ItemFieldsView — the read-mode rendering of an item's fields on the detail
 * page. Schema-adaptive: it renders whatever the context's ExuluContext
 * defines, choosing a presentation per field *type* rather than dumping every
 * value as text in a label/value grid.
 *
 * Strategy (design pass 1 — "render the schema, not a layout"):
 *  - pickLeadFileField → the first populated `file` field becomes a hero card
 *    (the document IS the item). Contexts without a file field simply have no
 *    hero and lead straight into the tiles.
 *  - Remaining populated fields render as type-aware tiles (icon + label +
 *    typed value) in a responsive grid — reads like a friendly record card,
 *    not a database row dump.
 *  - Empty-but-editable fields are tucked behind a quiet "+ N empty fields"
 *    expander so view mode stays clean while data-stewards can still see
 *    what's fillable. Empty + non-editable fields are dropped entirely.
 *
 * Edit mode still uses the shared ItemFormFields (the form), and the creation
 * dialog / selection modal are untouched — this view is detail-page only.
 */

import {
  AlignLeft,
  Braces,
  Check,
  Code,
  FileText,
  Hash,
  Plus,
  Tag,
  Tags,
  ToggleLeft,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { CopyButton } from "@/components/primitives/copy-button";
import { FileDataCard } from "@/components/primitives/file-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ExuluFieldTypes } from "@/lib/enums/field-types";
import { cn } from "@/lib/utils";
import type { Context } from "@/types/models/context";
import type { Item } from "@/types/models/item";

type DisplayKind = ExuluFieldTypes | "tags";

interface DisplayField {
  name: string;
  label: string;
  kind: DisplayKind;
  value: unknown;
  editable: boolean;
  /** Long values (text/file/code…) span the full grid width. */
  full: boolean;
}

const ICONS: Record<DisplayKind, LucideIcon> = {
  text: Type,
  shortText: Type,
  longText: AlignLeft,
  markdown: AlignLeft,
  number: Hash,
  boolean: ToggleLeft,
  enum: Tag,
  code: Code,
  json: Braces,
  file: FileText,
  tags: Tags,
};

const FULL_WIDTH_KINDS = new Set<DisplayKind>([
  "longText",
  "markdown",
  "code",
  "json",
  "file",
]);

const COPYABLE_KINDS = new Set<DisplayKind>([
  "text",
  "shortText",
  "longText",
  "markdown",
  "number",
  "enum",
  "code",
  "json",
]);

function isEmpty(kind: DisplayKind, value: unknown): boolean {
  if (kind === "tags") return !Array.isArray(value) || value.length === 0;
  if (kind === "boolean") return value === undefined || value === null;
  return value === undefined || value === null || String(value).trim() === "";
}

/** The first populated `file` field — promoted to the hero card. */
export function pickLeadFileField(
  context: Context,
  values: Partial<Item>,
): string | null {
  const record = values as Record<string, unknown>;
  const lead = (context.fields ?? []).find(
    (f) =>
      f.type === "file" &&
      !f.calculated &&
      !isEmpty("file", record[f.name]),
  );
  return lead?.name ?? null;
}

/**
 * Flatten the core fields + custom (non-calculated) context fields into one
 * ordered display list. Name is intentionally omitted — it's the page H1.
 */
function collectDisplayFields(
  context: Context,
  values: Partial<Item>,
  labels: { tags: string; description: string; externalId: string },
): DisplayField[] {
  const record = values as Record<string, unknown>;
  const out: DisplayField[] = [];

  // A context could redefine a core field name as a custom field; let the
  // custom definition win so we never render the same name twice.
  const customNames = new Set((context.fields ?? []).map((f) => f.name));

  // Core meaningful fields first (Name is the H1, so it's skipped).
  if (!customNames.has("description")) {
    out.push({
      name: "description",
      label: labels.description,
      kind: "longText",
      value: values.description,
      editable: true,
      full: true,
    });
  }
  if (!customNames.has("tags")) {
    out.push({
      name: "tags",
      label: labels.tags,
      kind: "tags",
      value: values.tags,
      editable: true,
      full: false,
    });
  }

  // Custom, author-defined fields in schema order.
  for (const field of context.fields ?? []) {
    if (field.calculated) continue;
    out.push({
      name: field.name,
      label: field.label,
      kind: field.type,
      value: record[field.name],
      editable: field.editable !== false,
      full: FULL_WIDTH_KINDS.has(field.type),
    });
  }

  // External ID last — the most technical of the core fields.
  if (!customNames.has("external_id")) {
    out.push({
      name: "external_id",
      label: labels.externalId,
      kind: "text",
      value: values.external_id,
      editable: true,
      full: true,
    });
  }

  return out;
}

export interface ItemFieldsViewProps {
  context: Context;
  values: Partial<Item>;
  /** Click an empty field tile to jump into edit mode focused on that field. */
  onEditField?: (fieldName: string) => void;
}

export function ItemFieldsView({
  context,
  values,
  onEditField,
}: ItemFieldsViewProps) {
  const t = useTranslations("knowledge");
  const [showEmpty, setShowEmpty] = React.useState(false);

  const leadFile = pickLeadFileField(context, values);

  const fields = collectDisplayFields(context, values, {
    tags: t("workspace.fields.tags"),
    description: t("workspace.fields.description"),
    externalId: t("workspace.fields.externalId"),
  });

  const populated: DisplayField[] = [];
  const empty: DisplayField[] = [];
  for (const f of fields) {
    if (f.name === leadFile) continue; // hero, rendered separately
    if (isEmpty(f.kind, f.value)) {
      if (f.editable) empty.push(f);
    } else {
      populated.push(f);
    }
  }

  // The lead file is promoted to a hero above the Fields section
  // (ItemDocumentHero, rendered by the detail page), so it's excluded here.
  const showNoFields =
    !leadFile && populated.length === 0 && empty.length === 0;

  return (
    <div className="space-y-4">
      {populated.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {populated.map((f) => (
            <FieldTile key={f.name} field={f} />
          ))}
        </div>
      ) : null}

      {showNoFields ? (
        <p className="text-sm text-muted-foreground">
          {t("workspace.fields.noFields")}
        </p>
      ) : null}

      {empty.length > 0 ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowEmpty((v) => !v)}
            aria-expanded={showEmpty}
          >
            <Plus
              aria-hidden="true"
              className={cn(
                "mr-1 size-3.5 transition-transform",
                showEmpty && "rotate-45",
              )}
            />
            {t("workspace.fields.emptyFields", { count: empty.length })}
          </Button>
          {showEmpty ? (
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {empty.map((f) => (
                <FieldTile
                  key={f.name}
                  field={f}
                  empty
                  onEdit={onEditField ? () => onEditField(f.name) : undefined}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The promoted document hero — the first populated `file` field, rendered as a
 * labeled card directly under the pipeline (above the Fields section). Renders
 * nothing when the context has no file field (or it's empty), so file-less
 * contexts simply have no hero.
 */
export function ItemDocumentHero({
  context,
  values,
}: {
  context: Context;
  values: Partial<Item>;
}) {
  const leadFile = pickLeadFileField(context, values);
  if (!leadFile) return null;
  const field = (context.fields ?? []).find((f) => f.name === leadFile);
  if (!field) return null;
  return (
    <div className="space-y-1.5">
      <FieldLabel icon={FileText} label={field.label} />
      <FileDataCard
        s3key={String((values as Record<string, unknown>)[leadFile] ?? "")}
      />
    </div>
  );
}

function FieldLabel({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <Icon aria-hidden="true" className="size-3.5" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function FieldTile({
  field,
  empty,
  onEdit,
}: {
  field: DisplayField;
  empty?: boolean;
  onEdit?: () => void;
}) {
  const t = useTranslations("knowledge");
  const Icon = ICONS[field.kind] ?? Type;
  const copyable =
    !empty && COPYABLE_KINDS.has(field.kind) && typeof field.value !== "object";

  // Empty + clickable → an inviting "Add" affordance that opens edit mode
  // focused on this field.
  if (empty && onEdit) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className={cn(
          "group min-w-0 rounded-lg border border-dashed bg-card/20 p-3 text-left",
          "transition-colors duration-150 ease-in-out hover:border-primary/50 hover:bg-accent/40 motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          field.full && "sm:col-span-2",
        )}
      >
        <div className="mb-1.5">
          <FieldLabel icon={Icon} label={field.label} />
        </div>
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground/70 transition-colors group-hover:text-primary">
          <Plus
            aria-hidden="true"
            className="size-3.5 transition-transform duration-200 ease-out group-hover:rotate-90 motion-reduce:transition-none"
          />
          {t("workspace.fields.add")}
        </span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "group min-w-0 rounded-lg border bg-card/40 p-3",
        "transition-colors duration-150 ease-in-out hover:border-foreground/15 hover:bg-card/70 motion-reduce:transition-none",
        field.full && "sm:col-span-2",
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <FieldLabel icon={Icon} label={field.label} />
        {copyable ? (
          <CopyButton
            value={String(field.value ?? "")}
            label={t("workspace.fields.copyValue", { label: field.label })}
            size="icon"
            className="ml-auto size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none"
          />
        ) : null}
      </div>
      <div className="min-w-0">
        {empty ? (
          <p className="text-sm text-muted-foreground/60">
            {t("workspace.fields.notSet")}
          </p>
        ) : (
          <FieldValue field={field} />
        )}
      </div>
    </div>
  );
}

function FieldValue({ field }: { field: DisplayField }) {
  const { kind, value } = field;

  if (kind === "tags") {
    const tags = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-wrap gap-1">
        {tags.map((tag, i) => (
          <Badge key={`${tag}-${i}`} variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>
    );
  }

  if (kind === "file") {
    return <FileDataCard s3key={String(value ?? "")} />;
  }

  if (kind === "enum") {
    return <Badge variant="secondary">{String(value)}</Badge>;
  }

  if (kind === "boolean") {
    const on = !!value;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-sm",
          on ? "text-success" : "text-muted-foreground",
        )}
      >
        {on ? (
          <Check aria-hidden="true" className="size-4" />
        ) : (
          <X aria-hidden="true" className="size-4" />
        )}
      </span>
    );
  }

  if (kind === "number") {
    return <span className="text-sm tabular-nums">{String(value)}</span>;
  }

  if (kind === "code" || kind === "json") {
    return (
      <pre className="max-h-48 overflow-auto rounded bg-muted px-2 py-1.5 font-mono text-xs">
        {String(value)}
      </pre>
    );
  }

  // text / shortText / longText / markdown
  return (
    <p className="line-clamp-6 whitespace-pre-wrap break-words text-sm">
      {String(value)}
    </p>
  );
}
