"use client";

/**
 * NewItemDialog — replaces the legacy silent "junk record" auto-create
 * (data-list.tsx:271-289). The user enters the required fields BEFORE the
 * mutation is fired. On success the route navigates to ?item=<id>.
 *
 * Inventory item #22 (Create item — junk-record anti-pattern killed) and
 * #80 (inline new-item dialog).
 */

import { useMutation } from "@apollo/client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Context } from "@/types/models/context";
import type { Item } from "@/types/models/item";

import { CREATE_ITEM, CREATE_ONE_POSTFIX } from "../../queries";

import { ItemFormFields } from "./item-form-fields";

export interface NewItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: Context;
  onCreated: (newItemId: string) => void;
}

export function NewItemDialog({
  open,
  onOpenChange,
  context,
  onCreated,
}: NewItemDialogProps) {
  const t = useTranslations("knowledge");
  const [draft, setDraft] = React.useState<Partial<Item>>({
    name: "",
    description: "",
    tags: [],
  });

  // Reset draft on (re)open.
  React.useEffect(() => {
    if (open) {
      setDraft({ name: "", description: "", tags: [] });
    }
  }, [open]);

  const [createItem, { loading }] = useMutation<{
    [key: string]: { item: { id: string }; job: string };
  }>(CREATE_ITEM(context.id, []), {
    onCompleted: (data) => {
      const id = data?.[context.id + CREATE_ONE_POSTFIX]?.item?.id;
      if (id) {
        toast.success(t("workspace.newItemDialog.created"));
        onCreated(id);
      }
    },
    onError: (error) => {
      toast.error(t("workspace.newItemDialog.error"), {
        description: error.message,
      });
    },
  });

  const handleCreate = () => {
    if (!draft.name) {
      toast.error(t("workspace.newItemDialog.nameRequired"));
      return;
    }
    const input: Record<string, unknown> = {
      name: draft.name,
      description: draft.description ?? "",
      external_id: draft.external_id ?? "",
      tags: Array.isArray(draft.tags) ? draft.tags.join(",") : "",
      source: "manual",
      textlength: typeof draft.description === "string"
        ? draft.description.length
        : 0,
      // Custom fields. defaultRightsMode is applied silently server-side
      // when not specified (#84 fallback behavior).
      ...(context.fields ?? []).reduce((acc, f) => {
        if (f.editable === false || f.calculated) return acc;
        const v = (draft as Record<string, unknown>)[f.name];
        if (v !== undefined) acc[f.name] = v;
        return acc;
      }, {} as Record<string, unknown>),
    };

    void createItem({ variables: { input } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] max-w-3xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("workspace.newItemDialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ItemFormFields
            context={context}
            data={draft}
            newItem={true}
            editing={true}
            onDataChange={setDraft}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {t("workspace.newItemDialog.cancel")}
          </Button>
          <Button type="button" disabled={loading} onClick={handleCreate}>
            {loading
              ? t("workspace.newItemDialog.creating")
              : t("workspace.newItemDialog.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
