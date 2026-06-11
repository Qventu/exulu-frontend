"use client";

/**
 * PinnedContextRow — conditional chip row under the composer textarea
 * (chat.md items 67/68; replaces the pinned-badges block in chat.tsx:1277–1315).
 *
 * Renders one SessionItemBadge (imported as-is from components/project-details)
 * per controller.sessionItems gid ("ctx" or "ctx/item"), removable per badge
 * via controller.removeSessionItem. The "Save context preset" affordance sits
 * at the end of the row (item 68) and opens the composer-owned SavePresetModal.
 *
 * CONTRACT NOTE: `onSavePreset` is an ADDITIVE optional prop on top of the
 * binding `{ controller }` shape — the save-preset overlay flag is
 * composer-local state per the architect's state-ownership map, so the row
 * needs a callback to reach it. Flagged in the builder report.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SessionItemBadge } from "@/components/project-details";

import type { ChatSessionController } from "../hooks";

export interface PinnedContextRowProps {
  controller: ChatSessionController;
  /** Additive (flagged): opens the composer-owned SavePresetModal (item 68). */
  onSavePreset?: () => void;
}

export function PinnedContextRow({
  controller,
  onSavePreset,
}: PinnedContextRowProps) {
  const t = useTranslations("chat");

  const items = controller.sessionItems;
  if (!items || items.length === 0) return null;

  return (
    <div
      role="group"
      className="flex flex-wrap items-center gap-1.5 pt-2"
      aria-label={t("composer.pinnedContextLabel")}
    >
      {items.map((gid) => (
        <SessionItemBadge
          key={gid}
          gid={gid}
          onRemove={(removedGid) => void controller.removeSessionItem(removedGid)}
        />
      ))}
      {onSavePreset && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSavePreset}
          className="h-9 rounded-full text-xs md:h-7"
        >
          <Plus className="mr-1 size-3.5" aria-hidden="true" />
          {t("presets.savePresetAction")}
        </Button>
      )}
    </div>
  );
}
