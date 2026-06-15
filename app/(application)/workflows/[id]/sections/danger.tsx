"use client";

/**
 * Danger Zone — destructive ops live at L3+ per philosophy §2 (the ladder).
 * Today this is just Delete; future routine-level destructive actions (e.g.
 * purge run history) belong here too. Hidden when !access.canDelete.
 *
 * Delete action opens the existing DeleteRoutineDialog via workbench
 * (preserves the same type-to-confirm UX the list page uses).
 */

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";

import type { RoutineSectionProps } from "./types";

export function DangerSection({ workbench }: RoutineSectionProps) {
  const t = useTranslations("routines");

  if (!workbench.access.canDelete) return null;

  return (
    <section id="danger" className="scroll-mt-20 space-y-4" tabIndex={-1}>
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-destructive">
          {t("editor.danger.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("editor.danger.description")}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">{t("delete.action")}</p>
          <p className="text-xs text-muted-foreground">
            {t("editor.danger.deleteHint")}
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={() => workbench.setDeleteOpen(true)}
        >
          <Trash2 aria-hidden="true" className="mr-2 size-4" />
          {t("delete.action")}
        </Button>
      </div>
    </section>
  );
}
