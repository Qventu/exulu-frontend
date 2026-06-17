"use client";

/**
 * Files tab (inventory 22-28; ladder rows 22-28). The L2 curation surface:
 * - mini-toolbar with the live "n / 15" counter (the 15-item copy is finally
 *   TRUE — ladder row 23) and the "Add files" trigger, disabled at the limit
 *   with an always-reachable explanation (Tooltip + visible helper on touch);
 * - responsive card grid (1 → sm:2 → lg:3, fixes the cramped 2-col-at-390px);
 * - the shared ItemsSelectionModal with BOTH dead halves of UX 3 wired:
 *   `onApplyPreset` AND `onSelectContext`, mirroring chat's wiring
 *   (chat/components/composer.tsx:618-624) — full-context entries are
 *   addable again (ladder row 25).
 *
 * Cap semantics (ladder row 23): every add path is atomic against the cap —
 * if the batch would push past 15, nothing is applied and the user learns
 * how many slots remain (presets reject by throwing so the modal surfaces
 * the message; browse/select-all reject with a toast here).
 */

import { Files, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { ItemsSelectionModal } from "@/components/items-selection-modal";
import { EmptyState } from "@/components/primitives/empty-state";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { MAX_PROJECT_ITEMS } from "../hooks";
import { ProjectItemCard } from "./project-item-card";

export interface AddItemsOptions {
  /** Reject over-cap batches by throwing (the modal toasts the message). */
  throwOnLimit?: boolean;
  /** Skip the local success toast (the modal already announces presets). */
  silent?: boolean;
}

export function FilesTab({
  projectItems,
  onAddItems,
  onRemoveItem,
}: {
  projectItems: string[];
  onAddItems: (gids: string[], options?: AddItemsOptions) => Promise<void>;
  onRemoveItem: (gid: string) => void;
}) {
  const t = useTranslations("projects");
  const [modalOpen, setModalOpen] = React.useState(false);

  const atLimit = projectItems.length >= MAX_PROJECT_ITEMS;

  const addButton = (
    <Button
      type="button"
      variant="outline"
      onClick={() => setModalOpen(true)}
      disabled={atLimit}
    >
      <Plus aria-hidden="true" className="mr-2 size-4" />
      {t("files.addFiles")}
    </Button>
  );

  return (
    <div className="space-y-4">
      {/* Mini-toolbar: counter + Add files (ladder rows 22-23). */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("files.counter", {
            count: projectItems.length,
            max: MAX_PROJECT_ITEMS,
          })}
        </p>
        {atLimit ? (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              {/* span wrapper: tooltips never fire on disabled buttons */}
              <TooltipTrigger asChild>
                <span tabIndex={0} className="rounded-md">
                  {addButton}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {t("files.limitTooltip", { max: MAX_PROJECT_ITEMS })}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          addButton
        )}
      </div>
      {/* Touch path for the disabled-state explanation (T7). */}
      {atLimit && (
        <p className="text-xs text-muted-foreground">
          {t("files.limitTooltip", { max: MAX_PROJECT_ITEMS })}
        </p>
      )}

      {projectItems.length === 0 ? (
        <EmptyState
          icon={Files}
          title={t("files.emptyTitle")}
          description={t("files.emptyDescription")}
          action={{
            label: t("files.addFiles"),
            onClick: () => setModalOpen(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projectItems.map((gid) => (
            <ProjectItemCard key={gid} gid={gid} onRemove={onRemoveItem} />
          ))}
        </div>
      )}

      {/* Shared with chat/knowledge — controlled mode, additive props only
          (its API is frozen: onConfirm/onSelectContext/onApplyPreset,
          codebase-structure §2.4). */}
      <ItemsSelectionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onConfirm={(data) => {
          void onAddItems(
            data.map((entry) => `${entry.context.id}/${entry.item.id}`),
          );
        }}
        onSelectContext={async (context) => {
          await onAddItems([context.id]);
        }}
        onApplyPreset={async (items) => {
          await onAddItems(items, { throwOnLimit: true, silent: true });
        }}
      />
    </div>
  );
}
