"use client";

/**
 * ItemFormFields — route-local absorption of the legacy
 * `components/item-form-fields.tsx`. The single creation/edit form shared
 * by NewItemDialog (workspace) and the cross-page ItemsSelectionModal
 * consumer (chat + projects), reached via the
 * `app/(application)/data/components/item-form-fields-shim.ts` re-export.
 *
 * The form renders the SAME labelled-row layout in both read and edit mode:
 * every field is the real control, `disabled` when not editing. This keeps the
 * detail page from shifting layout when toggling edit, and — on the detail page
 * — lets a user start editing by clicking any field (the row is a button that
 * calls `onStartEdit(fieldName)`; the host enters edit mode focused on it).
 *
 * Differences from the legacy global:
 * - File fields embed the promoted FilePicker primitive (rule 3).
 * - When `newItem` is true and a context field declares `editable === false`,
 *   it is hidden from the creation form (preserved from legacy).
 * - Expand-to-dialog editors for long-text/markdown delegate to the
 *   route-local `expand-editor-dialog.tsx`.
 *
 * Inventory items handled here: 22 (creation form replaces junk-record),
 * 40 (core fields), 42 (custom typed fields), 76 (FileDataCard inline),
 * 82 (single creation/edit form shared via shim).
 */

import { Expand, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import FilePicker, { FileDataCard } from "@/components/primitives/file-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Context } from "@/types/models/context";
import type { Item } from "@/types/models/item";

import { ExpandEditorDialog } from "./expand-editor-dialog";

export interface ItemFormFieldsProps {
  context: Context;
  data: Partial<Item>;
  /** When true, fields with `editable === false` are hidden. */
  newItem: boolean;
  editing: boolean;
  onDataChange: (data: Partial<Item>) => void;
  /** When set (and editing), focus + scroll to this field's input on mount.
   *  Used by the detail page's "click a field to edit it" affordance. */
  focusField?: string | null;
  /** Read mode: clicking a field row calls this to enter edit mode focused on
   *  that field. Omit (e.g. creation dialog) to disable click-to-edit. */
  onStartEdit?: (fieldName: string) => void;
  /** Field names to omit — e.g. the lead file promoted to a hero elsewhere on
   *  the detail page, so it isn't rendered twice. */
  hiddenFields?: string[];
}

export function ItemFormFields({
  context,
  data,
  editing,
  newItem,
  onDataChange,
  focusField,
  onStartEdit,
  hiddenFields,
}: ItemFormFieldsProps) {
  const t = useTranslations("knowledge");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = React.useState<{
    name: string;
    label: string;
    value: string;
    mode: "text" | "markdown";
  } | null>(null);

  const readOnly = !editing;

  // Tags can arrive as a comma string (raw item) or an array (seeded draft) —
  // normalise so read mode driven by the raw item still renders chips. The
  // typed shape is string[] only, so widen to unknown before sniffing.
  const rawTags = data.tags as unknown;
  const tags: string[] = Array.isArray(rawTags)
    ? (rawTags as string[])
    : typeof rawTags === "string" && rawTags.length > 0
      ? rawTags.split(",")
      : [];

  // In read mode, clicking a row enters edit mode focused on that field. File
  // fields keep their own interactions (open/preview), so they aren't wrapped.
  const activate = React.useCallback(
    (fieldName: string) =>
      readOnly && onStartEdit ? () => onStartEdit(fieldName) : undefined,
    [readOnly, onStartEdit],
  );

  // Jump straight to the requested field when edit mode opens from a row.
  React.useEffect(() => {
    if (!editing || !focusField) return;
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-field="${CSS.escape(focusField)}"] input, [data-field="${CSS.escape(focusField)}"] textarea`,
    );
    if (!el) return;
    el.focus();
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [editing, focusField]);

  const handleTags = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    if (!value) return;
    if (e.key === "Enter") {
      e.preventDefault();
      const next = [...tags, value];
      onDataChange({ ...data, tags: next });
      e.currentTarget.value = "";
    }
  };

  const removeTag = (index: number) => {
    const next = [...tags];
    next.splice(index, 1);
    onDataChange({ ...data, tags: next });
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-4">
      {/* Name */}
      <Row
        label={t("workspace.fields.name")}
        fieldName="name"
        onActivate={activate("name")}
      >
        <Input
          type="text"
          disabled={readOnly}
          value={data.name ?? ""}
          onChange={(e) => onDataChange({ ...data, name: e.target.value })}
          placeholder={t("workspace.fields.namePlaceholder")}
        />
      </Row>

      {/* Tags */}
      <Row
        label={t("workspace.fields.tags")}
        fieldName="tags"
        onActivate={activate("tags")}
      >
        <Input
          type="text"
          disabled={readOnly}
          onKeyUp={handleTags}
          placeholder={t("workspace.fields.tagsPlaceholder")}
        />
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {tag}
                {editing && (
                  <button
                    type="button"
                    onClick={() => removeTag(i)}
                    aria-label={t("workspace.fields.removeTag")}
                  >
                    <XCircle className="size-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        )}
      </Row>

      {/* Description */}
      <Row
        label={t("workspace.fields.description")}
        fieldName="description"
        onActivate={activate("description")}
      >
        <div className="relative">
          <Textarea
            rows={4}
            disabled={readOnly}
            value={data.description ?? ""}
            onChange={(e) =>
              onDataChange({ ...data, description: e.target.value })
            }
            placeholder={t("workspace.fields.descriptionPlaceholder")}
            className="resize-none"
          />
          {editing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 size-11 p-0 md:size-7"
              onClick={() =>
                setExpanded({
                  name: "description",
                  label: t("workspace.fields.description"),
                  value: data.description ?? "",
                  mode: "text",
                })
              }
              aria-label={t("workspace.fields.expand")}
            >
              <Expand className="size-3" />
            </Button>
          )}
        </div>
      </Row>

      {/* External ID */}
      <Row
        label={t("workspace.fields.externalId")}
        fieldName="external_id"
        onActivate={activate("external_id")}
      >
        <Input
          type="text"
          disabled={readOnly}
          value={data.external_id ?? ""}
          onChange={(e) =>
            onDataChange({ ...data, external_id: e.target.value })
          }
          placeholder="xxxx-xxxx-xxxx-xxxx"
        />
      </Row>

      {/* Custom typed fields */}
      {context.fields?.map((field, index) => {
        if (newItem && field.editable === false) return null;
        if (field.calculated) return null;
        if (hiddenFields?.includes(field.name)) return null;

        const value = (data as Record<string, unknown>)[field.name];
        // File fields stay interactive in read mode (open/preview), so they
        // aren't click-to-edit; use the Edit button to swap the file.
        const onActivate =
          field.type === "file" ? undefined : activate(field.name);

        return (
          <Row
            key={index}
            label={field.label}
            fieldName={field.name}
            onActivate={onActivate}
          >
            <FieldControl
              field={field}
              value={value}
              disabled={readOnly}
              onChange={(v) =>
                onDataChange({ ...data, [field.name]: v } as Partial<Item>)
              }
              onExpand={(label, current) =>
                setExpanded({
                  name: field.name,
                  label,
                  value: typeof current === "string" ? current : "",
                  mode: field.type === "markdown" ? "markdown" : "text",
                })
              }
              itemId={data.id ?? "new"}
              expandLabel={t("workspace.fields.expand")}
              selectPlaceholder={t("workspace.fields.selectPlaceholder")}
            />
          </Row>
        );
      })}

      <ExpandEditorDialog
        open={expanded !== null}
        onOpenChange={(o) => !o && setExpanded(null)}
        label={expanded?.label ?? ""}
        value={expanded?.value ?? ""}
        mode={expanded?.mode ?? "text"}
        onValueChange={(v) => {
          if (!expanded) return;
          setExpanded({ ...expanded, value: v });
          onDataChange({
            ...data,
            [expanded.name]: v,
          } as Partial<Item>);
        }}
      />
    </div>
  );
}

function Row({
  label,
  fieldName,
  onActivate,
  children,
}: {
  label: string;
  fieldName?: string;
  /** When set, the whole row is a button that enters edit mode (read mode). */
  onActivate?: () => void;
  children: React.ReactNode;
}) {
  const interactive = !!onActivate;
  return (
    <div
      data-field={fieldName}
      className={cn(
        "grid grid-cols-1 gap-1 md:grid-cols-[140px_1fr] md:items-start md:gap-3",
        interactive &&
          "-mx-2 cursor-pointer rounded-md px-2 py-1 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 motion-reduce:transition-none",
      )}
      {...(interactive
        ? {
            role: "button",
            tabIndex: 0,
            onClick: onActivate,
            onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onActivate?.();
              }
            },
          }
        : {})}
    >
      <div className="text-sm font-medium capitalize text-muted-foreground md:pt-2">
        {label}
      </div>
      {/* pointer-events-none lets row clicks fall through the disabled controls
          to the row's own onClick (read mode only). */}
      <div className={cn("min-w-0", interactive && "pointer-events-none")}>
        {children}
      </div>
    </div>
  );
}

interface ContextField {
  name: string;
  type?: string;
  label: string;
  allowedFileTypes?: string[];
  enumValues?: string[];
}

/**
 * The control for one typed field. Renders the real input in both modes;
 * `disabled` greys it out and locks it in read mode (click-to-edit lives on the
 * surrounding Row). File fields show the FilePicker only when editable.
 */
function FieldControl({
  field,
  value,
  disabled,
  onChange,
  onExpand,
  itemId,
  expandLabel,
  selectPlaceholder,
}: {
  field: ContextField;
  value: unknown;
  disabled: boolean;
  onChange: (next: unknown) => void;
  onExpand: (label: string, value: unknown) => void;
  itemId: string;
  expandLabel: string;
  selectPlaceholder: string;
}) {
  if (
    field.type === "code" ||
    field.type === "json" ||
    field.type === "text" ||
    field.type === "longText" ||
    field.type === "markdown" ||
    field.type === "shortText"
  ) {
    // json values arrive as objects/arrays — pretty-print them instead of
    // letting React coerce them to "[object Object]". Strings (already-stringified
    // json or the other text types) pass through unchanged.
    const textValue =
      field.type === "json" && value != null && typeof value !== "string"
        ? JSON.stringify(value, null, 2)
        : ((value as string) ?? "");
    return (
      <div className="relative">
        <Textarea
          rows={field.type === "shortText" ? 2 : 7}
          disabled={disabled}
          value={textValue}
          onChange={(e) => onChange(e.target.value)}
          className="resize-none"
        />
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 size-11 p-0 md:size-7"
            onClick={() => onExpand(field.label, textValue)}
            aria-label={expandLabel}
          >
            <Expand className="size-3" />
          </Button>
        )}
      </div>
    );
  }
  if (field.type === "number") {
    return (
      <Input
        type="number"
        disabled={disabled}
        value={(value as number) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === "boolean") {
    return (
      <Switch
        disabled={disabled}
        checked={!!value}
        onCheckedChange={(v) => onChange(v)}
      />
    );
  }
  if (field.type === "enum") {
    return (
      <Select
        disabled={disabled}
        value={(value as string) ?? ""}
        onValueChange={(v) => onChange(v.toUpperCase())}
      >
        <SelectTrigger>
          <SelectValue placeholder={selectPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {field.enumValues?.map((option) => (
            <SelectItem key={option} value={option.toUpperCase()}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (field.type === "file") {
    return (
      <FileDataCard s3key={(value as string) ?? ""}>
        {!disabled && (
          <FilePicker
            id={`item-${itemId}-${field.name}`}
            selectionLimit={1}
            dependencies={[]}
            allowedFileTypes={field.allowedFileTypes}
            onConfirm={(keys) => onChange(keys[0])}
          />
        )}
      </FileDataCard>
    );
  }
  // Unknown type — fall back to a plain textarea.
  return (
    <Textarea
      rows={3}
      disabled={disabled}
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="resize-none"
    />
  );
}
