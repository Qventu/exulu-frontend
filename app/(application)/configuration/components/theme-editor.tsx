"use client";

/**
 * Theme token editor (settings-config.md §3, left pane): a Light/Dark Tabs
 * switch (replaces the two collapsible Cards — fixes U10, triggers are real
 * focusable controls), search + "Modified only" filters, and the FULL default
 * variable manifest grouped under quiet headings (fixes U3 — a fresh install
 * finally sees every token instead of two empty sections). Custom variables
 * arriving via CSS import render in a trailing "Custom" group, so imported
 * non-manifest keys stay visible and editable (inventory #21/#22 merge
 * semantics).
 *
 * Row anatomy (doc spec, with the responsive touch floor applied): swatch ·
 * mono name (+ modified dot) · value Input · per-variable reset. The reset is
 * always visible on touch and fades in on hover/focus only under
 * `(hover:hover) and (pointer:fine)` (T7 — never hover-only). Inputs are
 * ≥16 px on touch (no iOS zoom), `h-8 text-xs` sugar from `md:`.
 *
 * Vertical scroll: the page owns it (responsive.md V2 — one scroll container
 * per region), so the list renders in flow; no nested ScrollArea.
 */

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  KNOWN_TOKEN_NAMES,
  THEME_TOKEN_GROUPS,
  THEME_TOKENS,
  countModifiedTokens,
  isPlausibleColorValue,
  swatchColor,
  type ThemeMode,
  type ThemeOverrides,
  type ThemeTokenGroup,
} from "../theme-defaults";

interface EditorRow {
  name: string;
  group: ThemeTokenGroup | "custom";
  /** Manifest default for the active mode; undefined for custom variables. */
  defaultValue?: string;
  /** Current override for the active mode, if any. */
  override?: string;
}

export interface ThemeEditorProps {
  mode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
  overrides: { light: ThemeOverrides; dark: ThemeOverrides };
  onValueChange: (mode: ThemeMode, name: string, value: string) => void;
  onResetToken: (mode: ThemeMode, name: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  modifiedOnly: boolean;
  onModifiedOnlyChange: (value: boolean) => void;
  loading?: boolean;
}

export function ThemeEditor({
  mode,
  onModeChange,
  overrides,
  onValueChange,
  onResetToken,
  search,
  onSearchChange,
  modifiedOnly,
  onModifiedOnlyChange,
  loading = false,
}: ThemeEditorProps) {
  const t = useTranslations("configuration");
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const switchId = React.useId();

  const rows = React.useMemo<EditorRow[]>(() => {
    const active = overrides[mode];
    const manifestRows: EditorRow[] = THEME_TOKENS.map((token) => ({
      name: token.name,
      group: token.group,
      defaultValue: token[mode],
      override: active[token.name],
    }));
    // Custom variables from imported CSS — kept visible and editable.
    const customRows: EditorRow[] = Object.keys(active)
      .filter((name) => !KNOWN_TOKEN_NAMES.has(name))
      .sort()
      .map((name) => ({
        name,
        group: "custom" as const,
        override: active[name],
      }));
    return [...manifestRows, ...customRows];
  }, [mode, overrides]);

  const query = search.trim().toLowerCase();
  const visibleRows = rows.filter((row) => {
    if (query !== "" && !row.name.toLowerCase().includes(query)) return false;
    if (modifiedOnly) return isModified(row);
    return true;
  });

  const groupOrder: ReadonlyArray<ThemeTokenGroup | "custom"> = [
    ...THEME_TOKEN_GROUPS,
    "custom",
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Tabs
        value={mode}
        onValueChange={(next) => onModeChange(next as ThemeMode)}
      >
        {/* S1: 2 tabs → full-width segmented control on phones. */}
        <TabsList className="grid h-11 w-full grid-cols-2 md:h-10 md:w-fit">
          <TabsTrigger value="light" className="gap-2">
            {tNav("userMenu.themeLight")}
            <ModifiedCountBadge count={countModifiedTokens("light", overrides)} />
          </TabsTrigger>
          <TabsTrigger value="dark" className="gap-2">
            {tNav("userMenu.themeDark")}
            <ModifiedCountBadge count={countModifiedTokens("dark", overrides)} />
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("editor.searchPlaceholder")}
          aria-label={t("editor.searchPlaceholder")}
          className="h-11 w-full text-base md:h-9 md:max-w-xs md:text-sm"
        />
        {/* The Label WRAPS the 24 px Switch: the whole ≥44 px row — including
            the space above/below the control — is the tap target below md
            (responsive.md §2 touch floor; clicks anywhere on the label
            activate the switch via htmlFor). */}
        <Label
          htmlFor={switchId}
          className="flex min-h-11 w-fit cursor-pointer items-center gap-2 font-normal md:min-h-0"
        >
          <Switch
            id={switchId}
            checked={modifiedOnly}
            onCheckedChange={onModifiedOnlyChange}
          />
          {t("editor.modifiedOnly")}
        </Label>
      </div>

      {loading ? (
        <EditorSkeleton />
      ) : visibleRows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("editor.noMatches")}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groupOrder.map((group) => {
            const groupRows = visibleRows.filter((row) => row.group === group);
            if (groupRows.length === 0) return null;
            return (
              <section key={group} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {t(`groups.${group}`)}
                </h3>
                <div className="flex flex-col gap-1">
                  {groupRows.map((row) => (
                    <TokenRow
                      key={`${mode}-${row.name}`}
                      row={row}
                      mode={mode}
                      modifiedLabel={t("editor.modified")}
                      resetLabel={t("editor.resetToken")}
                      defaultLabel={(value) =>
                        t("editor.defaultValue", { value })
                      }
                      invalidHint={t("editor.invalidValue")}
                      commonReset={tCommon("reset")}
                      onValueChange={onValueChange}
                      onResetToken={onResetToken}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function isModified(row: EditorRow): boolean {
  if (row.override === undefined) return false;
  if (row.defaultValue === undefined) return true; // custom variable
  return row.override !== row.defaultValue;
}

function ModifiedCountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Badge variant="secondary" className="px-1.5 font-mono text-[10px]">
      {count}
    </Badge>
  );
}

interface TokenRowProps {
  row: EditorRow;
  mode: ThemeMode;
  modifiedLabel: string;
  resetLabel: string;
  defaultLabel: (value: string) => string;
  /** Hint shown when a color-typed token holds an unparseable value (U16). */
  invalidHint: string;
  commonReset: string;
  onValueChange: (mode: ThemeMode, name: string, value: string) => void;
  onResetToken: (mode: ThemeMode, name: string) => void;
}

/**
 * One token row. Two-line below `md` (name row, then the input full-width) so
 * long mono names never fight the input for 390 px; single line from `md`.
 * Every keystroke writes through to the draft and the live preview
 * (inventory #25 preserved — now with visible effect).
 *
 * Validation (ladder row 25, "swatch + validation hint per row"): when the
 * manifest default is color-typed but the typed override is neither parseable
 * as a color nor a `var()` reference, a quiet warning renders under the input
 * (announced via aria-describedby). Advisory, never blocking — publishing
 * as-typed stays possible, matching the import dialog's non-blocking warnings.
 */
function TokenRow({
  row,
  mode,
  modifiedLabel,
  resetLabel,
  defaultLabel,
  invalidHint,
  commonReset,
  onValueChange,
  onResetToken,
}: TokenRowProps) {
  const inputId = React.useId();
  const hintId = React.useId();
  const effectiveValue = row.override ?? row.defaultValue ?? "";
  const modified = isModified(row);
  const swatch = swatchColor(effectiveValue);
  // Only color-typed tokens are validated; fonts/shadows/radius and custom
  // variables accept anything (their expected shape is unknowable here).
  const expectsColor =
    row.defaultValue !== undefined && swatchColor(row.defaultValue) !== null;
  const invalid =
    expectsColor &&
    row.override !== undefined &&
    row.override.trim() !== "" &&
    !isPlausibleColorValue(row.override);

  return (
    <div
      className={cn(
        "group grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-md px-1 py-1",
        "md:grid-cols-[16px_220px_minmax(0,1fr)_auto]",
      )}
    >
      {/* Swatch — renders the value when parseable; quiet outline otherwise.
          150 ms color transition so edits visibly flow (motion budget). */}
      <span
        aria-hidden="true"
        className={cn(
          "size-4 rounded-sm border transition-colors duration-150 motion-reduce:transition-none",
          swatch === null && "bg-muted",
        )}
        style={swatch ? { backgroundColor: swatch } : undefined}
      />

      <Label
        htmlFor={inputId}
        className="flex min-w-0 items-center gap-1.5 break-all font-mono text-xs font-normal"
      >
        {row.name}
        {modified ? (
          <span
            role="img"
            aria-label={modifiedLabel}
            className="size-1.5 shrink-0 rounded-full bg-primary"
          />
        ) : null}
      </Label>

      <Input
        id={inputId}
        value={effectiveValue}
        onChange={(event) => onValueChange(mode, row.name, event.target.value)}
        placeholder={
          row.defaultValue !== undefined
            ? defaultLabel(row.defaultValue)
            : undefined
        }
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? hintId : undefined}
        className={cn(
          "col-span-3 h-11 font-mono text-base md:col-span-1 md:col-start-3 md:row-start-1 md:h-8 md:text-xs",
          invalid && "border-warning focus-visible:ring-warning",
        )}
      />

      {/* Per-variable reset (ladder row 17's fine-grained L2 path). Rendered
          only when an override exists; touch keeps it always visible, fine
          pointers get the quiet fade-in (T7). */}
      <span className="col-start-3 row-start-1 flex justify-end md:col-start-4">
        {row.override !== undefined ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${resetLabel}: ${row.name}`}
            title={commonReset}
            onClick={() => onResetToken(mode, row.name)}
            className={cn(
              "size-11 md:size-8",
              "transition-opacity duration-150 motion-reduce:transition-none",
              "[@media(hover:hover)_and_(pointer:fine)]:opacity-0",
              "group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
            )}
          >
            <RotateCcw aria-hidden="true" className="size-4" />
          </Button>
        ) : (
          <span aria-hidden="true" className="size-11 md:size-8" />
        )}
      </span>

      {/* Per-row validation hint (U16): quiet, non-blocking, color-typed
          tokens only. Sits under the input in both layouts. */}
      {invalid ? (
        <p
          id={hintId}
          className="col-span-3 flex items-start gap-1.5 text-xs text-warning md:col-span-2 md:col-start-3 md:row-start-2"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {invalidHint}
        </p>
      ) : null}
    </div>
  );
}

/** Skeleton rows mirroring the row anatomy (uses the once-ignored loading flag — U11). */
function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: 10 }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-2 md:grid-cols-[16px_220px_minmax(0,1fr)_auto]"
        >
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-4 w-32 max-w-full" />
          <Skeleton className="col-span-3 h-11 md:col-span-1 md:col-start-3 md:row-start-1 md:h-8" />
          <span className="hidden md:col-start-4 md:block md:size-8" />
        </div>
      ))}
    </div>
  );
}
