"use client";

/**
 * ContextIconPicker — a Popover grid for choosing a knowledge-base icon from the
 * curated Fluent Emoji Flat set. Selection-only (no upload): the user picks one
 * of the bundled glyphs, or resets to the default.
 *
 * Controlled via `value`/`onSelect`; `children` is the trigger element. Copy is
 * passed in by the caller (the picker stays i18n-agnostic so it can live in the
 * shared primitives layer).
 */

import { Check, RotateCcw, Search } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { ContextIcon } from "./context-icon";
import {
  CONTEXT_ICON_NAMES,
  DEFAULT_CONTEXT_ICON,
} from "./fluent-emoji-data";

/** "card-index-dividers" → "Card index dividers" (labels + search haystack). */
function humanize(name: string): string {
  const spaced = name.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export interface ContextIconPickerLabels {
  /** Popover heading. */
  title: string;
  /** Search input placeholder. */
  searchPlaceholder: string;
  /** "Reset to default" action. */
  reset: string;
  /** Shown when a search matches nothing. */
  noResults: string;
}

export interface ContextIconPickerProps {
  /** Currently-selected glyph name (null/unset → default). */
  value?: string | null;
  /** Called with the chosen glyph name, or null when reset to default. */
  onSelect: (name: string | null) => void;
  labels: ContextIconPickerLabels;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}

export function ContextIconPicker({
  value,
  onSelect,
  labels,
  children,
  align = "start",
}: ContextIconPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CONTEXT_ICON_NAMES;
    return CONTEXT_ICON_NAMES.filter((name) =>
      humanize(name).toLowerCase().includes(q),
    );
  }, [query]);

  const choose = (name: string | null) => {
    onSelect(name);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-72 p-3">
        <div className="space-y-3">
          <p className="text-sm font-medium">{labels.title}</p>

          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={labels.searchPlaceholder}
              className="h-8 pl-8"
            />
          </div>

          {results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {labels.noResults}
            </p>
          ) : (
            <div
              role="listbox"
              className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto"
            >
              {results.map((name) => {
                const selected =
                  value === name ||
                  (!value && name === DEFAULT_CONTEXT_ICON);
                return (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    title={humanize(name)}
                    aria-label={humanize(name)}
                    onClick={() => choose(name)}
                    className={cn(
                      "relative flex aspect-square items-center justify-center rounded-md p-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected && "bg-accent ring-2 ring-primary",
                    )}
                  >
                    <ContextIcon name={name} className="size-full" />
                    {selected && (
                      <span className="absolute right-0.5 top-0.5 rounded-full bg-primary p-0.5 text-primary-foreground">
                        <Check className="size-2.5" aria-hidden="true" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => choose(null)}
          >
            <RotateCcw aria-hidden="true" className="mr-2 size-4" />
            {labels.reset}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
