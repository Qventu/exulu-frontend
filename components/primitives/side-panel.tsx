"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * SidePanel — the detail half of every ListDetail.
 *
 * Spec: design/codebase-structure.md §2.3 (SidePanel); responsive behavior per
 * design/responsive.md T2 + V-rules:
 *
 * - `≥ lg`: docked inline panel (non-modal), resizable from its left edge via
 *   pointer drag or keyboard (WAI window-splitter pattern); width persisted to
 *   localStorage (scoped by `storageKey`). Focus moves into the panel on open
 *   and is restored on close; Escape closes (V-rule focus management).
 * - `md`–`lg`: right-side overlay Sheet (`w-full sm:max-w-md` — never fixed px).
 * - `< md`: bottom Sheet, `max-h-[85dvh]` (or `h-dvh` via `mobileSize="full"`
 *   for document-like content), internally scrollable, safe-area padded (V1/V3).
 *
 * Header: title (+ optional description) + `actions` slot (OverflowMenu) + close.
 * The body is a single unpadded scroll container (V2) — content owns its padding.
 */

const LG_QUERY = "(min-width: 1024px)";
const MD_QUERY = "(min-width: 768px)";

const DEFAULT_WIDTH = 400;
const DEFAULT_MIN_WIDTH = 280;
const DEFAULT_MAX_WIDTH = 720;
const RESIZE_STEP = 16;
const STORAGE_PREFIX = "exulu.side-panel.width";

/** `undefined` until hydrated — callers must treat it as "unknown", not false. */
function useMediaQuery(query: string): boolean | undefined {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [query],
  );
  return React.useSyncExternalStore<boolean | undefined>(
    subscribe,
    () => window.matchMedia(query).matches,
    () => undefined,
  );
}

function storageKeyFor(key?: string) {
  return key ? `${STORAGE_PREFIX}.${key}` : STORAGE_PREFIX;
}

function readStoredWidth(key?: string): number | null {
  try {
    const raw = window.localStorage.getItem(storageKeyFor(key));
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function persistWidth(key: string | undefined, width: number) {
  try {
    window.localStorage.setItem(storageKeyFor(key), String(Math.round(width)));
  } catch {
    // Storage unavailable (private mode, quota) — resizing still works, just unpersisted.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export interface SidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Panel heading; doubles as the accessible name of the region / sheet. */
  title: string;
  /** Optional one-line context under the title. */
  description?: string;
  /** Header slot for an OverflowMenu / secondary header actions. */
  actions?: React.ReactNode;
  /** Initial docked width in px (a persisted user width takes precedence). */
  width?: number;
  /** Allow drag/keyboard resizing of the docked panel at `≥ lg`. */
  resizable?: boolean;
  /** Scopes width persistence per surface (e.g. "knowledge-item"). Unset = shared key. */
  storageKey?: string;
  minWidth?: number;
  maxWidth?: number;
  /** Bottom-sheet height below `md`: "full" (`h-dvh`) for document-like content (T2). */
  mobileSize?: "default" | "full";
  className?: string;
  children: React.ReactNode;
}

export function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  actions,
  width = DEFAULT_WIDTH,
  resizable = true,
  storageKey,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth = DEFAULT_MAX_WIDTH,
  mobileSize = "default",
  className,
  children,
}: SidePanelProps) {
  const t = useTranslations();
  const isDesktop = useMediaQuery(LG_QUERY);
  const isAboveMd = useMediaQuery(MD_QUERY);
  // Sheet only once we KNOW we're below lg; pre-hydration renders the docked
  // markup (CSS-guarded by `lg:` classes) so desktop SSR paints without a flash.
  const sheetMode = isDesktop === false;

  const [panelWidth, setPanelWidth] = React.useState(() =>
    clamp(width, minWidth, maxWidth),
  );

  // Persisted width wins over the `width` prop; read after mount to keep
  // server and client initial renders identical.
  React.useEffect(() => {
    const stored = readStoredWidth(storageKey);
    if (stored !== null) {
      setPanelWidth(clamp(stored, minWidth, maxWidth));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // --- docked focus management (Sheet modes inherit the Radix Dialog trap) ---
  const panelRef = React.useRef<HTMLElement>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (sheetMode) return;
    if (open) {
      const active = document.activeElement;
      restoreFocusRef.current = active instanceof HTMLElement ? active : null;
      panelRef.current?.focus({ preventScroll: true });
    } else if (restoreFocusRef.current) {
      if (document.contains(restoreFocusRef.current)) {
        restoreFocusRef.current.focus({ preventScroll: true });
      }
      restoreFocusRef.current = null;
    }
  }, [open, sheetMode]);

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.stopPropagation();
      onOpenChange(false);
    }
  };

  // --- resize: pointer drag + WAI window-splitter keyboard support ---
  const dragState = React.useRef<{ startX: number; startWidth: number } | null>(
    null,
  );

  const endDrag = () => {
    if (!dragState.current) return;
    dragState.current = null;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  };

  React.useEffect(() => endDrag, []);

  const handleResizePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragState.current = { startX: event.clientX, startWidth: panelWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  const handleResizePointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!dragState.current) return;
    const next = clamp(
      dragState.current.startWidth + (dragState.current.startX - event.clientX),
      minWidth,
      maxWidth,
    );
    setPanelWidth(next);
  };

  const handleResizePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const finalWidth = clamp(
      dragState.current.startWidth + (dragState.current.startX - event.clientX),
      minWidth,
      maxWidth,
    );
    endDrag();
    setPanelWidth(finalWidth);
    persistWidth(storageKey, finalWidth);
  };

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    switch (event.key) {
      case "ArrowLeft": // handle sits on the left edge — moving it left widens
        next = panelWidth + RESIZE_STEP;
        break;
      case "ArrowRight":
        next = panelWidth - RESIZE_STEP;
        break;
      case "Home":
        next = minWidth;
        break;
      case "End":
        next = maxWidth;
        break;
      case "Enter": // splitter pattern: restore the default position
        next = width;
        break;
      default:
        return;
    }
    event.preventDefault();
    const clamped = clamp(next, minWidth, maxWidth);
    setPanelWidth(clamped);
    persistWidth(storageKey, clamped);
  };

  // --- sheet (`< lg`) per T2 ---
  if (sheetMode) {
    const bottom = isAboveMd === false;
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={bottom ? "bottom" : "right"}
          // Hide SheetContent's built-in close X (its only direct <button> child);
          // the header below renders the spec'd ≥44px close target instead.
          className={cn(
            "flex flex-col gap-0 p-0 [&>button]:hidden",
            bottom
              ? cn(
                  "max-h-[85dvh] rounded-t-lg pb-[env(safe-area-inset-bottom)]",
                  mobileSize === "full" && "h-dvh max-h-none rounded-none",
                )
              : "w-full sm:max-w-md",
            className,
          )}
          // Keep Radix's title/description wiring when a description exists;
          // otherwise silence the missing-Description warning.
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex shrink-0 items-center gap-2 border-b p-4">
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-base font-semibold">
                {title}
              </SheetTitle>
              {description ? (
                <SheetDescription className="truncate">
                  {description}
                </SheetDescription>
              ) : null}
            </div>
            {actions != null ? (
              <div className="flex shrink-0 items-center gap-1">{actions}</div>
            ) : null}
            <SheetClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={t("common.close")}
              >
                <X className="size-4" />
              </Button>
            </SheetClose>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  // --- docked panel (`≥ lg`, and pre-hydration via `hidden lg:flex`) ---
  if (!open) return null;

  return (
    <aside
      ref={panelRef}
      role="complementary"
      aria-label={title}
      tabIndex={-1}
      onKeyDown={handlePanelKeyDown}
      style={{ width: panelWidth }}
      className={cn(
        "relative hidden h-full max-w-full shrink-0 flex-col border-l bg-background outline-none lg:flex",
        className,
      )}
    >
      {resizable ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("common.resizePanel")}
          aria-valuenow={Math.round(panelWidth)}
          aria-valuemin={minWidth}
          aria-valuemax={maxWidth}
          tabIndex={0}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          onKeyDown={handleResizeKeyDown}
          className="absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize touch-none transition-colors duration-150 hover:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : null}
      <header className="flex shrink-0 items-center gap-2 border-b p-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="truncate text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions != null ? (
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={t("common.close")}
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}
