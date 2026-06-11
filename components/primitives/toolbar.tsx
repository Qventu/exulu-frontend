"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Toolbar — search + filters + view switches, identical placement under
 * PageHeader on every list page (design/codebase-structure.md §2.2;
 * philosophy.md §5).
 *
 * Responsive (responsive.md T3, built in — consumers get it for free):
 * - Below `md`: search goes full-width on its own line; all filter controls
 *   collapse into ONE "Filters" outline button (badge shows the active-filter
 *   count) opening a bottom Sheet with the controls stacked + Reset; the view
 *   (column-visibility / view-switch) slot is hidden — there are no columns
 *   below `md` (T1).
 * - `md+`: single row — search, inline filters, view slot right-aligned.
 * - V3: the bottom sheet pads for the safe-area inset.
 *
 * Search is debounced (default 300 ms) inside the component; `text-base` on
 * touch widths prevents iOS focus zoom (responsive.md touch-target rules).
 */
export interface ToolbarSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Debounce for onChange in ms; 300 by default. */
  debounceMs?: number;
}

export interface ToolbarProps {
  search?: ToolbarSearch;
  /** Filter controls (Selects / EntityCombobox slots). Rendered inline at `md+`, stacked in the filter Sheet below `md`. */
  filters?: React.ReactNode;
  /** Number of active filters, shown as a badge on the mobile Filters trigger (T3). */
  activeFilterCount?: number;
  /** When provided, the mobile filter Sheet shows a Reset action (T3). */
  onResetFilters?: () => void;
  /** View-switch / column-visibility slot; hidden below `md` (T1 — no columns on phones). */
  view?: React.ReactNode;
  /** BulkActionBar slot, rendered when rows are selected. */
  selection?: React.ReactNode;
  className?: string;
}

function Toolbar({
  search,
  filters,
  activeFilterCount = 0,
  onResetFilters,
  view,
  selection,
  className,
}: ToolbarProps) {
  const t = useTranslations("common");
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [query, setQuery] = React.useState(search?.value ?? "");
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const externalValue = search?.value;
  React.useEffect(() => {
    if (externalValue !== undefined) {
      setQuery(externalValue);
    }
  }, [externalValue]);

  React.useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => search?.onChange(value),
      search?.debounceMs ?? 300,
    );
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        {search && (
          <div className="relative w-full md:max-w-sm">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={handleSearchChange}
              placeholder={search.placeholder}
              aria-label={search.placeholder}
              className="pl-9 text-base md:text-sm"
            />
          </div>
        )}
        {(filters || view) && (
          <div className="flex items-center gap-2 md:min-w-0 md:flex-1">
            {filters && (
              <>
                {/* Mobile: ONE Filters trigger opening a bottom sheet (T3). */}
                <Button
                  type="button"
                  variant="outline"
                  className="md:hidden"
                  onClick={() => setFiltersOpen(true)}
                >
                  <SlidersHorizontal aria-hidden="true" className="mr-2 size-4" />
                  {t("filters")}
                  {activeFilterCount > 0 && (
                    <>
                      <span
                        aria-hidden="true"
                        className="ml-2 inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
                      >
                        {activeFilterCount}
                      </span>
                      <span className="sr-only">
                        {t("activeFilters", { count: activeFilterCount })}
                      </span>
                    </>
                  )}
                </Button>
                {/* Desktop: filters inline. */}
                <div className="hidden min-w-0 items-center gap-2 md:flex">
                  {filters}
                </div>
              </>
            )}
            {view && (
              <div className="hidden items-center gap-2 md:ml-auto md:flex">
                {view}
              </div>
            )}
          </div>
        )}
      </div>
      {selection}
      {filters && (
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[85dvh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader className="text-left">
              <SheetTitle>{t("filters")}</SheetTitle>
              <SheetDescription className="sr-only">
                {t("filtersDescription")}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 py-4">{filters}</div>
            <SheetFooter className="gap-2">
              {onResetFilters && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onResetFilters()}
                >
                  {t("reset")}
                </Button>
              )}
              <Button type="button" onClick={() => setFiltersOpen(false)}>
                {t("done")}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

export { Toolbar };
