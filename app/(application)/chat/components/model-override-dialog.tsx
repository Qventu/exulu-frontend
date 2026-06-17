"use client";

/**
 * ModelOverrideDialog — per-request model override (chat.md item 26, demoted
 * to L3: opened from the ChatHeader ⋯ menu → "Model…").
 *
 * Replaces the always-visible header `Select` (legacy chat.tsx:843–896).
 * - Model list comes from `useAvailableModels()` (LiteLLM catalog vs Models
 *   table by config flag; speech models already filtered — logic lives in the
 *   hook, owner: orchestration).
 * - "(default)" marker on the agent's configured model.
 * - Accessible title/description + labelled radiogroup (fixes U13: the legacy
 *   select had no accessible label).
 * - Selecting the agent's default clears the override (`onChange(null)`); the
 *   ChatHeader keeps an always-visible override badge while one is engaged
 *   (trust rule: model identity ≤L2).
 * - Responsive per responsive.md T5: full-screen sheet below `sm`
 *   (h-dvh + rounded-none), centered small dialog from `sm` up.
 */

import { Check, Cpu } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { EmptyState } from "@/components/primitives/empty-state";
import { ProviderLogo } from "@/components/provider-logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/models/agent";

import { useAvailableModels } from "../hooks";

export interface ModelOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent;
  /** Current override (null = agent default). */
  value: string | null;
  /** null / agent.model clears the override. */
  onChange: (modelId: string | null) => void;
}

const SEARCH_THRESHOLD = 8;

export function ModelOverrideDialog({
  open,
  onOpenChange,
  agent,
  value,
  onChange,
}: ModelOverrideDialogProps) {
  const t = useTranslations("chat");
  const { models, loading } = useAvailableModels();
  const [query, setQuery] = React.useState("");

  // Fresh search every time the dialog opens.
  React.useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const activeModels = React.useMemo(
    () => models.filter((m) => m.active),
    [models],
  );

  const filteredModels = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeModels;
    return activeModels.filter((m) => m.name.toLowerCase().includes(q));
  }, [activeModels, query]);

  const selectedId = value ?? agent.model ?? null;

  const handleSelect = (modelId: string) => {
    onChange(modelId === agent.model ? null : modelId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // T5: full-screen sheet below sm, centered small dialog from sm up.
          "flex h-dvh max-h-dvh w-full max-w-full flex-col gap-3 rounded-none p-4",
          "sm:h-auto sm:max-h-[85dvh] sm:max-w-md sm:rounded-lg sm:p-6",
        )}
      >
        <DialogHeader>
          <DialogTitle>{t("model.title")}</DialogTitle>
          <DialogDescription>{t("model.description")}</DialogDescription>
        </DialogHeader>

        {activeModels.length > SEARCH_THRESHOLD ? (
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("model.searchPlaceholder")}
            aria-label={t("model.searchPlaceholder")}
            // ≥16px on touch so iOS doesn't zoom the focused field (responsive.md).
            className="h-10 text-base sm:h-9 sm:text-sm"
          />
        ) : null}

        <div
          role="radiogroup"
          aria-label={t("model.listLabel")}
          className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1"
        >
          {loading && activeModels.length === 0 ? (
            <>
              <Skeleton className="h-11 w-full rounded-md" />
              <Skeleton className="h-11 w-full rounded-md" />
              <Skeleton className="h-11 w-full rounded-md" />
            </>
          ) : activeModels.length === 0 ? (
            <EmptyState
              variant="quiet"
              icon={Cpu}
              title={t("model.empty")}
            />
          ) : filteredModels.length === 0 ? (
            <EmptyState
              variant="quiet"
              icon={Cpu}
              title={t("model.noMatch")}
            />
          ) : (
            filteredModels.map((model) => {
              const selected = model.id === selectedId;
              const isDefault = model.id === agent.model;
              return (
                <button
                  key={model.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => handleSelect(model.id)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
                    "hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    selected && "bg-muted",
                  )}
                >
                  <ProviderLogo
                    brand={model.brand}
                    region={model.region}
                    size={16}
                  />
                  <span className="min-w-0 flex-1 truncate">{model.name}</span>
                  {isDefault ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t("model.default")}
                    </span>
                  ) : null}
                  {selected ? (
                    <Check
                      className="size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        <p className="shrink-0 text-xs text-muted-foreground">
          {t("model.note")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
