"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * ListDetail — THE collection pattern: list left/top, detail as a docked panel
 * (`lg+`) or Sheet (`<lg`), or as a routed subpage.
 *
 * Spec: `design/codebase-structure.md` §2.2 (list-detail.tsx) and
 * `design/responsive.md` §3 T2 (side panel → bottom sheet) + V1/V3 (dvh,
 * safe-area insets).
 *
 * Behavior contract:
 * - **`detailMode="panel"`** (default): the detail docks right at `lg+` while an
 *   item is selected. Below `lg` the detail renders in a Sheet — right-side
 *   overlay on tablet (`md`–`lg`, `w-full sm:max-w-md`), bottom sheet on phones
 *   (`max-h-[85dvh]`, internally scrollable, safe-area padded).
 * - **`detailMode="static"`**: the right pane is always visible at `lg+`
 *   (prompts' pattern); `emptyDetail` fills it when nothing is selected. Below
 *   `lg` it behaves exactly like `"panel"` (list-only until a selection opens
 *   the Sheet — never auto-selected detail below the fold).
 * - **`detailMode="page"`**: the detail is its own routed page. ListDetail
 *   renders only the list; consumers render rows as links to `detailHref(item)`
 *   (or push the route themselves). Keyboard: arrows move the highlight via
 *   `onSelect`, Enter navigates to `detailHref(selected)`.
 * - **URL sync** (`panel`/`static`, on by default): selection is mirrored to
 *   `?selected=<id>` (param name configurable). Deep links resolve against
 *   `items` once available and open the detail directly; back/forward and
 *   closing restore the list URL. Opening pushes history (back closes the
 *   detail); switching/closing replaces it.
 * - **Keyboard navigation**: with `items` provided, ArrowUp/ArrowDown move the
 *   selection between rows (Home/End jump), Escape closes the detail. Handlers
 *   ignore editable targets and modifier keys.
 * - ListDetail itself never auto-selects (responsive.md T2); consumers must not
 *   auto-select on mount either, or phones open a sheet unprompted.
 *
 * Note: uses `useSearchParams` — statically prerendered consumer pages must
 * mount it under a `<Suspense>` boundary (standard Next.js App Router rule).
 */

type DetailMode = "panel" | "page" | "static";

export interface ListDetailProps<T> {
  /** The list half — usually a `<DataTable />` or a slim row list. */
  list: React.ReactNode;
  /**
   * Renders the selected item's detail in the docked panel / Sheet.
   * Required for `"panel"`/`"static"`; unused in `"page"` mode.
   */
  detail?: (item: T) => React.ReactNode;
  /** Controlled selection. */
  selected?: T | null;
  /** Selection change requests (row clicks, URL deep links, sheet close, keyboard). */
  onSelect: (item: T | null) => void;
  /** @default "panel" */
  detailMode?: DetailMode;
  /** Quiet EmptyState shown in the `"static"` pane when nothing is selected. */
  emptyDetail?: React.ReactNode;
  /** Items backing URL deep-link resolution and keyboard navigation. */
  items?: T[];
  /** Stable id per item; defaults to reading `item.id`. */
  getItemId?: (item: T) => string;
  /** Query parameter used for URL-synced selection. @default "selected" */
  paramName?: string;
  /** Set `false` to keep selection in memory only (no URL sync). @default true */
  syncUrl?: boolean;
  /** Subroute builder — required for `detailMode="page"`. */
  detailHref?: (item: T) => string;
  /** Heading for the detail panel/sheet; defaults to the common "Details" label. */
  detailTitle?: (item: T) => string;
  className?: string;
}

type Breakpoint = "base" | "md" | "lg";

/** Tracks the stock Tailwind `md`/`lg` breakpoints (responsive.md §2). */
function useBreakpoint(): Breakpoint | undefined {
  const [breakpoint, setBreakpoint] = React.useState<Breakpoint | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const md = window.matchMedia("(min-width: 768px)");
    const lg = window.matchMedia("(min-width: 1024px)");
    const update = () =>
      setBreakpoint(lg.matches ? "lg" : md.matches ? "md" : "base");
    update();
    md.addEventListener("change", update);
    lg.addEventListener("change", update);
    return () => {
      md.removeEventListener("change", update);
      lg.removeEventListener("change", update);
    };
  }, []);

  return breakpoint;
}

function defaultGetItemId(item: unknown): string {
  const id = (item as { id?: string | number } | null | undefined)?.id;
  return id === undefined || id === null ? "" : String(id);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return (
    target.closest('[role="textbox"], [role="combobox"], [contenteditable="true"]') !==
    null
  );
}

export function ListDetail<T>({
  list,
  detail,
  selected,
  onSelect,
  detailMode = "panel",
  emptyDetail,
  items,
  getItemId,
  paramName = "selected",
  syncUrl = true,
  detailHref,
  detailTitle,
  className,
}: ListDetailProps<T>) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const breakpoint = useBreakpoint();

  const getId = React.useCallback(
    (item: T) => (getItemId ? getItemId(item) : defaultGetItemId(item)),
    [getItemId],
  );

  const selectedItem = selected ?? null;
  const selectedId = selectedItem === null ? null : getId(selectedItem);

  const onSelectRef = React.useRef(onSelect);
  React.useEffect(() => {
    onSelectRef.current = onSelect;
  });

  const urlSyncEnabled = syncUrl && detailMode !== "page";
  const urlId = urlSyncEnabled ? searchParams.get(paramName) : null;

  // --- URL → state: deep links, back/forward (only reacts to URL *changes*,
  // so a row click that has not hit the router yet is never undone).
  const prevUrlId = React.useRef<string | null | undefined>(undefined);
  const pendingUrlId = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!urlSyncEnabled) return;

    const urlChanged = prevUrlId.current !== urlId;
    prevUrlId.current = urlId;

    if (urlChanged) {
      if (urlId === selectedId) {
        pendingUrlId.current = null;
        return;
      }
      if (urlId === null) {
        pendingUrlId.current = null;
        onSelectRef.current(null);
        return;
      }
      pendingUrlId.current = urlId;
    }

    // Resolve a pending deep link once items are available.
    if (pendingUrlId.current !== null) {
      if (pendingUrlId.current === selectedId) {
        pendingUrlId.current = null;
        return;
      }
      const found = items?.find((item) => getId(item) === pendingUrlId.current);
      if (found !== undefined) {
        pendingUrlId.current = null;
        onSelectRef.current(found);
      }
    }
  }, [urlSyncEnabled, urlId, selectedId, items, getId]);

  // --- state → URL: mirror selection into ?selected=<id>. Skipped on mount so
  // an unresolved deep link is never cleared before items load.
  const prevSelectedId = React.useRef<string | null | undefined>(undefined);
  React.useEffect(() => {
    const prev = prevSelectedId.current;
    prevSelectedId.current = selectedId;
    if (!urlSyncEnabled) return;
    if (prev === undefined) return; // mount — the URL is authoritative
    if (prev === selectedId) return; // not a selection change
    if (selectedId === urlId) return; // already in sync (URL-initiated)

    const params = new URLSearchParams(searchParams.toString());
    if (selectedId === null) {
      params.delete(paramName);
    } else {
      params.set(paramName, selectedId);
    }
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    if (prev === null && selectedId !== null) {
      router.push(href, { scroll: false }); // opening — back closes the detail
    } else {
      router.replace(href, { scroll: false }); // switching / closing
    }
  }, [
    urlSyncEnabled,
    selectedId,
    urlId,
    paramName,
    pathname,
    router,
    searchParams,
  ]);

  // --- Keyboard navigation between rows (arrows/Home/End/Enter on the list).
  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (isEditableTarget(event.target)) return;
    if (!items || items.length === 0) return;

    if (event.key === "Enter") {
      if (detailMode === "page" && selectedItem !== null && detailHref) {
        event.preventDefault();
        router.push(detailHref(selectedItem));
      }
      return;
    }

    const currentIndex =
      selectedId === null
        ? -1
        : items.findIndex((item) => getId(item) === selectedId);
    let nextIndex: number;
    switch (event.key) {
      case "ArrowDown":
        nextIndex =
          currentIndex < 0 ? 0 : Math.min(currentIndex + 1, items.length - 1);
        break;
      case "ArrowUp":
        nextIndex =
          currentIndex < 0
            ? items.length - 1
            : Math.max(currentIndex - 1, 0);
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const next = items[nextIndex];
    if (next !== undefined && getId(next) !== selectedId) {
      onSelect(next);
    }
  };

  // Escape closes the docked detail from anywhere in the composition
  // (the Sheet handles its own Escape below `lg`).
  const handleRootKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    if (event.key !== "Escape") return;
    if (detailMode === "page" || selectedItem === null) return;
    if (isEditableTarget(event.target)) return;
    event.preventDefault();
    onSelect(null);
  };

  const titleText =
    selectedItem !== null && detailTitle
      ? detailTitle(selectedItem)
      : t("common.details");

  const detailBody = selectedItem !== null ? detail?.(selectedItem) : null;

  const staticPlaceholder = emptyDetail ?? (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <p className="text-sm text-muted-foreground">
        {t("common.selectItemToViewDetails")}
      </p>
    </div>
  );

  const showAside =
    detailMode === "static" || (detailMode === "panel" && selectedItem !== null);
  // The Sheet is the <lg rendering of the SAME detail content (T2) — the aside
  // below is CSS-hidden under lg, so nothing is ever lost by breakpoint.
  const showSheet =
    detailMode !== "page" && breakpoint !== undefined && breakpoint !== "lg";

  return (
    <div
      className={cn("flex min-h-0 w-full flex-1 items-stretch", className)}
      onKeyDown={handleRootKeyDown}
    >
      <div className="min-w-0 flex-1" onKeyDown={handleListKeyDown}>
        {list}
      </div>

      {showAside ? (
        <aside
          aria-label={titleText}
          className="hidden w-96 shrink-0 flex-col overflow-hidden border-l border-border bg-background lg:flex xl:w-[28rem]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="truncate text-base font-semibold">{titleText}</h2>
            {selectedItem !== null ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={t("common.close")}
                onClick={() => onSelect(null)}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {selectedItem !== null ? detailBody : staticPlaceholder}
          </div>
        </aside>
      ) : null}

      {showSheet ? (
        <Sheet
          open={selectedItem !== null}
          onOpenChange={(open) => {
            if (!open) onSelect(null);
          }}
        >
          <SheetContent
            side={breakpoint === "base" ? "bottom" : "right"}
            aria-describedby={undefined}
            className={cn(
              "flex flex-col gap-0 p-0",
              breakpoint === "base"
                ? "max-h-[85dvh] rounded-t-lg"
                : "h-full w-full sm:max-w-md",
            )}
          >
            <SheetHeader className="border-b border-border px-4 py-3 pr-12 text-left">
              <SheetTitle className="truncate text-base">
                {titleText}
              </SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
              {detailBody}
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}
