"use client";

/**
 * ItemFormFields — route-local absorption of the legacy
 * `components/item-form-fields.tsx`. The single creation/edit form shared
 * by NewItemDialog (workspace) and the cross-page ItemsSelectionModal
 * consumer (chat + projects), reached via the
 * `app/(application)/data/components/item-form-fields-shim.ts` re-export.
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
}

export function ItemFormFields({
  context,
  data,
  editing,
  newItem,
  onDataChange,
}: ItemFormFieldsProps) {
  const t = useTranslations("knowledge");
  const [expanded, setExpanded] = React.useState<{
    name: string;
    label: string;
    value: string;
    mode: "text" | "markdown";
  } | null>(null);

  const handleTags = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    if (!value) return;
    if (e.key === "Enter") {
      e.preventDefault();
      const next = Array.isArray(data?.tags) ? [...data.tags, value] : [value];
      onDataChange({ ...data, tags: next });
      e.currentTarget.value = "";
    }
  };

  const removeTag = (index: number) => {
    const next = [...(data.tags ?? [])];
    next.splice(index, 1);
    onDataChange({ ...data, tags: next });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Name */}
      <Row label={t("workspace.fields.name")}>
        {editing ? (
          <Input
            type="text"
            value={data.name ?? ""}
            onChange={(e) => onDataChange({ ...data, name: e.target.value })}
            placeholder={t("workspace.fields.namePlaceholder")}
          />
        ) : (
          <p className="text-sm">{data.name ?? ""}</p>
        )}
      </Row>

      {/* Tags */}
      <Row label={t("workspace.fields.tags")}>
        {editing && (
          <Input
            type="text"
            onKeyUp={handleTags}
            placeholder={t("workspace.fields.tagsPlaceholder")}
          />
        )}
        {data.tags && data.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {data.tags.map((tag, i) => (
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
      <Row label={t("workspace.fields.description")}>
        {editing ? (
          <div className="relative">
            <Textarea
              rows={4}
              value={data.description ?? ""}
              onChange={(e) =>
                onDataChange({ ...data, description: e.target.value })
              }
              placeholder={t("workspace.fields.descriptionPlaceholder")}
              className="resize-none"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 size-7 p-0"
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
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm">{data.description ?? ""}</p>
        )}
      </Row>

      {/* External ID */}
      <Row label={t("workspace.fields.externalId")}>
        {editing ? (
          <Input
            type="text"
            value={data.external_id ?? ""}
            onChange={(e) =>
              onDataChange({ ...data, external_id: e.target.value })
            }
            placeholder="xxxx-xxxx-xxxx-xxxx"
          />
        ) : (
          <p className="text-sm">{data.external_id ?? ""}</p>
        )}
      </Row>

      {/* Custom typed fields */}
      {context.fields?.map((field, index) => {
        if (newItem && field.editable === false) return null;
        if (field.calculated) return null;

        const value = (data as Record<string, unknown>)[field.name];

        return (
          <Row key={index} label={field.label}>
            {!editing ? (
              <ReadValue field={field} value={value} />
            ) : (
              <EditValue
                field={field}
                value={value}
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
              />
            )}
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 md:grid-cols-[140px_1fr] md:items-start md:gap-3">
      <div className="text-sm font-medium capitalize text-muted-foreground md:pt-2">
        {label}
      </div>
      <div className="min-w-0">{children}</div>
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

function ReadValue({ field, value }: { field: ContextField; value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <p className="text-sm text-muted-foreground">—</p>;
  }
  if (field.type === "file") {
    return <FileDataCard s3key={String(value)} />;
  }
  if (field.type === "enum") {
    return <Badge variant="secondary">{String(value)}</Badge>;
  }
  if (field.type === "boolean") {
    return <p className="text-sm">{String(value)}</p>;
  }
  return <p className="whitespace-pre-wrap text-sm">{String(value)}</p>;
}

function EditValue({
  field,
  value,
  onChange,
  onExpand,
  itemId,
}: {
  field: ContextField;
  value: unknown;
  onChange: (next: unknown) => void;
  onExpand: (label: string, value: unknown) => void;
  itemId: string;
}) {
  if (
    field.type === "code" ||
    field.type === "json" ||
    field.type === "text" ||
    field.type === "longText" ||
    field.type === "markdown" ||
    field.type === "shortText"
  ) {
    return (
      <div className="relative">
        <Textarea
          rows={field.type === "shortText" ? 2 : 7}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="resize-none"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 size-7 p-0"
          onClick={() => onExpand(field.label, value)}
          aria-label="Expand"
        >
          <Expand className="size-3" />
        </Button>
      </div>
    );
  }
  if (field.type === "number") {
    return (
      <Input
        type="number"
        value={(value as number) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === "boolean") {
    return (
      <Switch
        checked={!!value}
        onCheckedChange={(v) => onChange(v)}
      />
    );
  }
  if (field.type === "enum") {
    return (
      <Select
        value={(value as string) ?? ""}
        onValueChange={(v) => onChange(v.toUpperCase())}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a value" />
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
        <FilePicker
          id={`item-${itemId}-${field.name}`}
          selectionLimit={1}
          dependencies={[]}
          allowedFileTypes={field.allowedFileTypes}
          onConfirm={(keys) => onChange(keys[0])}
        />
      </FileDataCard>
    );
  }
  // Unknown type — fall back to a plain textarea.
  return (
    <Textarea
      rows={3}
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="resize-none"
    />
  );
}
