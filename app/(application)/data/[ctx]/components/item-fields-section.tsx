"use client";

/**
 * ItemFieldsSection — DetailSection "Fields" body. Default open (the
 * primary surface).
 *
 * Both read and edit mode render the shared ItemFormFields in the same
 * labelled-row layout — read mode shows disabled, click-to-edit controls — so
 * the page doesn't shift when toggling edit. File fields render inline as
 * regular rows. The "Process" action surfaces inline when the context has a
 * processor.
 *
 * Inventory items: 40, 42 (custom typed fields, view + edit), 45 (Process
 * action shown only when context.processor exists).
 */

import { Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { type UseFormReturn } from "react-hook-form";

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
  /** Enter edit mode focused on a specific field (empty-tile click-to-edit). */
  onEditField?: (fieldName: string) => void;
  /** Field to focus once edit mode opens. */
  focusField?: string | null;
}

export function ItemFieldsSection({
  context,
  item,
  draft,
  editing,
  onDraftChange,
  onProcess,
  processPending,
  form: _form,
  onEditField,
  focusField,
}: ItemFieldsSectionProps) {
  const t = useTranslations("knowledge");

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
      {/* One layout for both modes: read mode shows disabled, click-to-edit
          controls (driven by the saved item); edit mode swaps to the draft and
          enables the inputs. File fields render inline as regular rows. */}
      <ItemFormFields
        context={context}
        data={editing ? draft : item}
        newItem={false}
        editing={editing}
        onDataChange={onDraftChange}
        onStartEdit={onEditField}
        focusField={focusField}
      />
    </DetailSection>
  );
}
