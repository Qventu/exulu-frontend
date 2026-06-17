"use client";

/**
 * ExpandEditorDialog — full-size dialog for editing long-text / markdown /
 * description fields. MarkdownEditor renders with live preview at 500px.
 *
 * One overlay rule: the item panel is a panel (not a modal), so it is safe
 * for this dialog to open over it without nesting modal-on-modal.
 *
 * Inventory item #44 (expand-to-dialog editors).
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { MarkdownEditor } from "@/components/primitives/markdown-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export interface ExpandEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  value: string;
  onValueChange: (next: string) => void;
  mode: "text" | "markdown";
}

export function ExpandEditorDialog({
  open,
  onOpenChange,
  label,
  value,
  onValueChange,
  mode,
}: ExpandEditorDialogProps) {
  const t = useTranslations("knowledge");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] max-w-4xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>
            {t("workspace.expandEditor.title", { label })}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {mode === "markdown" ? (
            <MarkdownEditor
              value={value}
              onChange={(v) => onValueChange(v ?? "")}
              height={500}
              preview="live"
            />
          ) : (
            <Textarea
              rows={20}
              className="min-h-[400px] resize-none"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
