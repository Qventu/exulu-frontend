"use client";

/**
 * ItemFieldsSection — DetailSection "Fields" body. Default open (the
 * primary surface). Core fields + custom typed fields, with per-row copy
 * buttons (visible, keyboard-accessible) and the "Process" action
 * surfaced inline when the context has a processor.
 *
 * Inventory items: 40, 41 (CopyButton per value — keyboard-accessible),
 * 42 (custom typed fields, view + edit), 45 (Process action shown only
 * when context.processor exists).
 */

import { Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { type UseFormReturn } from "react-hook-form";

import { CopyButton } from "@/components/primitives/copy-button";
import { DetailSection } from "@/components/primitives/detail-section";
import { Button } from "@/components/ui/button";
import type { Item } from "@EXULU_SHARED/models/item";
import type { Context } from "@/types/models/context";

import { ItemFormFields } from "./item-form-fields";

export interface ItemFieldsSectionProps {
  context: Context;
  item: Item;
  draft: Partial<Item>;
  editing: boolean;
  onDraftChange: (next: Partial<Item>) => void;
  onProcess?: () => void;
  processPending: boolean;
  form: UseFormReturn<Record<string, unknown>>;
}

export function ItemFieldsSection({
  context,
  item: _item,
  draft,
  editing,
  onDraftChange,
  onProcess,
  processPending,
  form: _form,
}: ItemFieldsSectionProps) {
  const t = useTranslations("knowledge");

  const fieldEntries: { label: string; value: string }[] = React.useMemo(() => {
    const out: { label: string; value: string }[] = [];
    if (draft.name) {
      out.push({ label: t("workspace.fields.name"), value: draft.name });
    }
    if (draft.external_id) {
      out.push({
        label: t("workspace.fields.externalId"),
        value: draft.external_id,
      });
    }
    return out;
  }, [draft.name, draft.external_id, t]);

  return (
    <DetailSection
      title={t("workspace.sections.fields")}
      defaultOpen={true}
      actions={
        onProcess && !editing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onProcess}
            disabled={processPending}
          >
            <Zap aria-hidden="true" className="mr-2 size-4" />
            {t("workspace.fields.process")}
          </Button>
        ) : null
      }
    >
      {/* View-mode copy actions surface above the form when not editing. */}
      {!editing && fieldEntries.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {fieldEntries.map((e) => (
            <div key={e.label} className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">{e.label}:</span>
              <code className="rounded bg-muted px-1.5 py-0.5">{e.value}</code>
              <CopyButton
                value={e.value}
                label={t("workspace.fields.copyValue", { label: e.label })}
                size="icon"
                className="size-6"
              />
            </div>
          ))}
        </div>
      )}
      <ItemFormFields
        context={context}
        data={draft}
        newItem={false}
        editing={editing}
        onDataChange={onDraftChange}
      />
    </DetailSection>
  );
}
