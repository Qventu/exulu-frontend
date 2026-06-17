"use client";

/**
 * EntityCombobox — async server-filtered single-select combobox over a
 * paginated entity collection (agents, users, projects, …).
 *
 * Spec: design/codebase-structure.md §2.3 (registry sketch) — generic, no
 * page-flavored props. Consumers own the fetch function (the data layer stays
 * out of primitives, per the import boundaries in components/primitives/README).
 *
 * Behavior:
 * - Built on Popover + Command (cmdk). Consumer-controlled value (id or null).
 * - On open, if no options are cached, fetches the first `initialPageSize`
 *   entries with an empty query (browse-friendly small orgs).
 * - On query change, debounces 300 ms then calls `fetchOptions(query)`;
 *   latest-wins token so in-flight stale responses are dropped.
 * - Loading shows a quiet spinner row; errors show a single Retry button.
 * - Selected value keeps a cached label so the trigger renders the name even
 *   after the popover closes; `resolveLabel` pre-fills the trigger when the
 *   value arrives before the user opens the popover.
 * - Inline X clear button when a value is set (stopPropagation; onChange(null)).
 *
 * Responsive / a11y: trigger is a 40 px touch target (responsive.md), aria-label
 * mirrors the placeholder + selected label; cmdk handles arrow / enter / escape.
 */

import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface EntityComboboxOption {
  id: string;
  label: string;
  sublabel?: string;
}

export interface EntityComboboxProps {
  /** Selected id; null when nothing is selected. */
  value: string | null;
  /** Receives the new id, or null when cleared. */
  onChange: (id: string | null) => void;
  /** Async loader. Called with "" on open and the typed query on debounce. */
  fetchOptions: (query: string) => Promise<EntityComboboxOption[]>;
  /** Already-translated trigger placeholder + aria-label seed. */
  placeholder: string;
  /** Already-translated empty-state label. */
  emptyMessage: string;
  /** Search input placeholder; defaults to `placeholder`. */
  searchPlaceholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
  /**
   * Pre-resolve the current value's label so the trigger renders the name not
   * the id on first paint. Called once when value!=null and no label is cached.
   */
  resolveLabel?: (
    id: string,
  ) => Promise<{ label: string; sublabel?: string } | null>;
  /** First-open page size when no query has been typed yet. @default 20 */
  initialPageSize?: number;
}

const SEARCH_DEBOUNCE_MS = 300;

function EntityCombobox({
  value,
  onChange,
  fetchOptions,
  placeholder,
  emptyMessage,
  searchPlaceholder,
  disabled = false,
  triggerClassName,
  resolveLabel,
  // initialPageSize is informational — the consumer's fetchOptions decides the
  // actual limit. Kept on the API so a future variant could thread it through.
  initialPageSize: _initialPageSize = 20,
}: EntityComboboxProps) {
  const tCommon = useTranslations("common");

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<EntityComboboxOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [labelCache, setLabelCache] = React.useState<
    Record<string, { label: string; sublabel?: string }>
  >({});

  // Latest-wins token: a stale in-flight fetch never overwrites a newer one.
  const fetchToken = React.useRef(0);

  const runFetch = React.useCallback(
    async (q: string) => {
      const token = ++fetchToken.current;
      setLoading(true);
      setError(null);
      try {
        const next = await fetchOptions(q);
        if (fetchToken.current !== token) return;
        setOptions(next);
        // Cache labels so the trigger keeps a name after the popover closes.
        setLabelCache((prev) => {
          let changed = false;
          const out = { ...prev };
          for (const opt of next) {
            if (!out[opt.id] || out[opt.id]?.label !== opt.label) {
              out[opt.id] = { label: opt.label, sublabel: opt.sublabel };
              changed = true;
            }
          }
          return changed ? out : prev;
        });
      } catch (err) {
        if (fetchToken.current !== token) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (fetchToken.current === token) setLoading(false);
      }
    },
    [fetchOptions],
  );

  // Pre-resolve the trigger label for a value that arrived before any browse.
  React.useEffect(() => {
    if (!value) return;
    if (labelCache[value]) return;
    if (!resolveLabel) return;
    let cancelled = false;
    void resolveLabel(value).then((resolved) => {
      if (cancelled || !resolved) return;
      setLabelCache((prev) =>
        prev[value]
          ? prev
          : { ...prev, [value]: resolved },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [value, labelCache, resolveLabel]);

  // First open: hydrate with an empty-query browse if we have no options yet.
  React.useEffect(() => {
    if (!open) return;
    if (options.length === 0 && !loading && !error) {
      void runFetch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounce the typed query.
  React.useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      void runFetch(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, open, runFetch]);

  const selectedLabel = value ? labelCache[value]?.label ?? null : null;

  const triggerAriaLabel = selectedLabel
    ? `${placeholder}: ${selectedLabel}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          role="combobox"
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-label={triggerAriaLabel}
          disabled={disabled}
          className={cn(
            "h-10 justify-between gap-2 font-normal md:h-9",
            !selectedLabel && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <span className="flex shrink-0 items-center gap-1">
            {value !== null ? (
              <span
                role="button"
                tabIndex={0}
                aria-label={tCommon("clear")}
                onClick={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  onChange(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.stopPropagation();
                    event.preventDefault();
                    onChange(null);
                  }
                }}
                className="flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
              >
                <X aria-hidden="true" className="size-3.5" />
              </span>
            ) : null}
            <ChevronsUpDown
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder ?? placeholder}
          />
          <CommandList>
            {error ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {tCommon("somethingWentWrong")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void runFetch(query)}
                >
                  {tCommon("retry")}
                </Button>
              </div>
            ) : loading && options.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
                <span>{tCommon("loading")}</span>
              </div>
            ) : options.length === 0 ? (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            ) : (
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = option.id === value;
                  return (
                    <CommandItem
                      key={option.id}
                      value={option.id}
                      onSelect={() => {
                        onChange(option.id);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{option.label}</span>
                        {option.sublabel ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {option.sublabel}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <Check
                          aria-hidden="true"
                          className="size-4 shrink-0 text-primary"
                        />
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { EntityCombobox };
