"use client";

/**
 * Suggestion listbox for the composer's inline autocomplete. Dumb renderer:
 * all state lives in useComposerAutocomplete. Positioned above the composer
 * card (absolute, bottom-full) — mount inside the `relative` form card.
 * Visual language matches cmdk rows (bg-popover card, bg-accent active row);
 * cmdk itself isn't used because focus stays in the textarea.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { Archive, File, Sparkles, Wrench, type LucideIcon } from "lucide-react";

import { Loading } from "@/components/primitives/loading";
import { cn } from "@/lib/utils";

import type { Suggestion } from "./matching";
import { optionId, type ComposerAutocomplete } from "./use-composer-autocomplete";

const KIND_ICON: Record<Suggestion["kind"], LucideIcon> = {
  command: Archive,
  tool: Wrench,
  skill: Sparkles,
  file: File,
};

export function AutocompleteMenu({
  autocomplete,
}: {
  autocomplete: ComposerAutocomplete;
}) {
  const t = useTranslations("chat");
  const {
    menuOpen,
    kind,
    items,
    activeIndex,
    setActiveIndex,
    applySuggestion,
    filesStatus,
    hasAnyFiles,
    listboxId,
  } = autocomplete;

  const activeRef = React.useRef<HTMLLIElement | null>(null);
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, menuOpen]);

  if (!menuOpen) return null;

  const groupLabel: Record<Suggestion["kind"], string> = {
    command: t("composer.autocomplete.commandsGroup"),
    tool: t("composer.autocomplete.toolsGroup"),
    skill: t("composer.autocomplete.skillsGroup"),
    file: t("composer.autocomplete.filesGroup"),
  };

  const showFilesLoading = kind === "@" && filesStatus === "loading";
  const showFilesError = kind === "@" && filesStatus === "error";
  const emptyLabel =
    kind === "@" && !hasAnyFiles && filesStatus === "ready"
      ? t("composer.autocomplete.noFilesYet")
      : t("composer.autocomplete.noMatches");

  return (
    <div className="absolute inset-x-0 bottom-full z-50 mb-2">
      <ul
        id={listboxId}
        role="listbox"
        aria-label={t("composer.autocomplete.listLabel")}
        className="max-h-72 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        // Keep focus in the textarea: a click must not blur-close the menu
        // before the row's onClick fires.
        onMouseDown={(e) => e.preventDefault()}
      >
        {showFilesLoading && (
          <li className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
            <Loading className="size-4" />
            {t("composer.autocomplete.filesGroup")}
          </li>
        )}
        {showFilesError && (
          <li className="px-2 py-1.5 text-sm text-muted-foreground">
            {t("composer.autocomplete.filesError")}
          </li>
        )}
        {!showFilesLoading && !showFilesError && items.length === 0 && (
          <li className="px-2 py-1.5 text-sm text-muted-foreground">{emptyLabel}</li>
        )}
        {items.map((item, index) => {
          const Icon = KIND_ICON[item.kind];
          const active = index === activeIndex;
          const showHeader = index === 0 || items[index - 1].kind !== item.kind;
          return (
            <React.Fragment key={item.id}>
              {showHeader && (
                <li
                  role="presentation"
                  className="px-2 py-1.5 text-xs font-medium text-muted-foreground"
                >
                  {groupLabel[item.kind]}
                </li>
              )}
              <li
                ref={active ? activeRef : undefined}
                id={optionId(index)}
                role="option"
                aria-selected={active}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => applySuggestion(item)}
                className={cn(
                  "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                  active && "bg-accent text-accent-foreground",
                  item.disabled && "opacity-60",
                )}
              >
                <Icon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className={cn(item.kind !== "file" && "capitalize")}>
                    {item.displayName}
                  </span>
                  {item.description && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </span>
                {item.disabled && (
                  <span className="shrink-0 rounded-full border px-1.5 text-[10px] text-muted-foreground">
                    {t("composer.autocomplete.off")}
                  </span>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ul>
    </div>
  );
}
