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
 * Preset awareness (spec 2026-07-07-context-preset-management-design.md §3):
 * when the composer passes `activePreset`, a leading chip names the applied
 * preset (× deselects it), and when the pinned set diverges from the preset
 * (`presetDirty`) an "Update preset" action appears for users with write
 * access. All state and mutations live in the composer — this row stays
 * presentational.
 *
 * CONTRACT NOTE: `onSavePreset` and the preset-awareness props are ADDITIVE
 * optional props on top of the binding `{ controller }` shape — the
 * save-preset overlay flag and active-preset state are composer-local per the
 * architect's state-ownership map, so the row needs callbacks to reach them.
 * Flagged in the builder report.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { Bookmark, Check, Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SessionItemBadge } from "@/components/project-details";

import type { ChatSessionController } from "../hooks";

export interface PinnedContextRowProps {
  controller: ChatSessionController;
  /** Additive (flagged): opens the composer-owned SavePresetModal (item 68). */
  onSavePreset?: () => void;
  /** The preset last applied to this session (composer-local, ephemeral). */
  activePreset?: { id: string; name: string } | null;
  /** Pinned set differs from the active preset's items. */
  presetDirty?: boolean;
  /** Current user may write the active preset (checkPresetWriteAccess). */
  canUpdatePreset?: boolean;
  /** UPDATE_CONTEXT_PRESET in flight. */
  updatingPreset?: boolean;
  onDeselectPreset?: () => void;
  onUpdatePreset?: () => void;
}

export function PinnedContextRow({
  controller,
  onSavePreset,
  activePreset,
  presetDirty,
  canUpdatePreset,
  updatingPreset,
  onDeselectPreset,
  onUpdatePreset,
}: PinnedContextRowProps) {
  const t = useTranslations("chat");

  const items = controller.sessionItems;
  // Keep the row while a preset is active even if all badges were removed,
  // so "Update preset" / deselect stay reachable.
  if ((!items || items.length === 0) && !activePreset) return null;

  return (
    <div
      role="group"
      className="flex flex-wrap items-center gap-1.5 pt-2"
      aria-label={t("composer.pinnedContextLabel")}
    >
      {activePreset && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          aria-label={t("presets.activePresetLabel", { name: activePreset.name })}
        >
          <Bookmark className="size-3.5" aria-hidden="true" />
          <span className="max-w-40 truncate">{activePreset.name}</span>
          {presetDirty && (
            <span className="font-normal italic text-primary/70">
              {t("presets.modified")}
            </span>
          )}
          {onDeselectPreset && (
            <button
              type="button"
              onClick={onDeselectPreset}
              aria-label={t("presets.deselectPreset", { name: activePreset.name })}
              className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          )}
        </span>
      )}
      {(items || []).map((gid) => (
        <SessionItemBadge
          key={gid}
          gid={gid}
          onRemove={(removedGid) => void controller.removeSessionItem(removedGid)}
        />
      ))}
      {activePreset && presetDirty && canUpdatePreset && onUpdatePreset && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onUpdatePreset}
          disabled={updatingPreset}
          className="h-9 rounded-full text-xs md:h-7"
        >
          {updatingPreset ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="mr-1 size-3.5" aria-hidden="true" />
          )}
          {updatingPreset ? t("presets.updating") : t("presets.update")}
        </Button>
      )}
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
