"use client";

/**
 * /configuration — "Theme" (settings-config.md §3; primary persona P3,
 * super_admin-gated server-side in this route's layout.tsx). A two-pane
 * editor that makes publishing a SEEN decision:
 *
 * - PageHeader: H1 = the nav label — "Theme" (LABEL CANON OVERRIDE,
 *   navigation.md §1.2 product decision 2026-06-11; the page doc's
 *   "Platform theme" predates it). Right side: dirty hint → overflow menu
 *   (Import CSS… / Export CSS / raw toggle / Reset to defaults…) → the
 *   primary "Publish theme" button, disabled when clean.
 * - Left pane: the grouped token editor (theme-editor.tsx).
 * - Right pane: the live preview (theme-preview.tsx), sticky ≥ lg; below lg
 *   it leaves the grid and opens as a bottom Sheet from a persistent
 *   "Preview" button (T2) — editing and previewing alternate instead of
 *   sharing 390 px.
 * - Publish: ConfirmDialog summarizing "N light / M dark overrides — applies
 *   to all users"; on confirm the upsert runs and the published values are
 *   applied to the live document (hooks.ts) — no manual reload (U2).
 * - Reset to defaults (L3): ConfirmDialog stating it clears all overrides
 *   AND publishes immediately (fixes U7's local-only "reset").
 * - L4: the raw view (stored overrides as JSON + generated CSS) with
 *   one-click copy — P4's export path (ladder row 26).
 */

import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { CopyButton } from "@/components/primitives/copy-button";
import { EmptyState } from "@/components/primitives/empty-state";
import { OverflowMenu } from "@/components/primitives/overflow-menu";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import {
  buildThemeCss,
  countModifiedTokens,
  resolveTheme,
  type ThemeMode,
  type ThemeOverrides,
} from "../theme-defaults";
import { useThemeConfig, type PublishableTheme } from "../hooks";
import { ImportCssDialog, type ParsedThemeCss } from "./import-css-dialog";
import { ThemeEditor } from "./theme-editor";
import { ThemePreview } from "./theme-preview";

function themesEqual(a: PublishableTheme, b: PublishableTheme): boolean {
  const recordsEqual = (x: ThemeOverrides, y: ThemeOverrides) => {
    const xKeys = Object.keys(x);
    const yKeys = Object.keys(y);
    if (xKeys.length !== yKeys.length) return false;
    return xKeys.every((key) => x[key] === y[key]);
  };
  return recordsEqual(a.light, b.light) && recordsEqual(a.dark, b.dark);
}

export function ThemeStudio() {
  const t = useTranslations("configuration");
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");

  const { loading, error, refetch, savedTheme, publishing, publish } =
    useThemeConfig();

  // ---- draft state -------------------------------------------------------
  const [draft, setDraft] = React.useState<PublishableTheme>({
    light: {},
    dark: {},
  });

  // Seed the draft from the stored row (inventory #19 behavior preserved).
  // Re-seeding after our own publish is a visual no-op (draft === saved).
  const savedSignature = JSON.stringify(savedTheme);
  React.useEffect(() => {
    setDraft(savedTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSignature]);

  const dirty = !themesEqual(draft, savedTheme);

  // ---- editor / preview UI state -----------------------------------------
  const [mode, setMode] = React.useState<ThemeMode>("light");
  const [previewMode, setPreviewMode] = React.useState<ThemeMode>("light");
  const [search, setSearch] = React.useState("");
  const [modifiedOnly, setModifiedOnly] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [previewSheetOpen, setPreviewSheetOpen] = React.useState(false);
  const [rawVisible, setRawVisible] = React.useState(false);

  // The preview follows the edited mode; its own toggle can diverge.
  const handleModeChange = (next: ThemeMode) => {
    setMode(next);
    setPreviewMode(next);
  };

  // ---- handlers ------------------------------------------------------------
  const handleValueChange = (
    targetMode: ThemeMode,
    name: string,
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      [targetMode]: { ...current[targetMode], [name]: value },
    }));
  };

  const handleResetToken = (targetMode: ThemeMode, name: string) => {
    setDraft((current) => {
      const next = { ...current[targetMode] };
      delete next[name];
      return { ...current, [targetMode]: next };
    });
  };

  /** Merge semantics preserved (inventory #22); the editor then reveals the
   *  imported values via "Modified only" + the mode that received them. */
  const handleImport = (parsed: ParsedThemeCss) => {
    setDraft((current) => ({
      light: { ...current.light, ...parsed.light },
      dark: { ...current.dark, ...parsed.dark },
    }));
    const lightCount = Object.keys(parsed.light).length;
    const darkCount = Object.keys(parsed.dark).length;
    setModifiedOnly(true);
    handleModeChange(lightCount > 0 ? "light" : "dark");
    toast.success(t("import.successTitle"), {
      description: t("import.successDescription", {
        count: lightCount + darkCount,
      }),
      duration: 3000,
    });
  };

  const handlePublish = async () => {
    try {
      await publish(draft);
      toast.success(t("publishSuccessTitle"), {
        description: t("publishSuccessDescription"),
        duration: 3000,
      });
    } catch (publishError) {
      console.error("Error publishing theme:", publishError);
      toast.error(t("publishErrorTitle"), {
        description: t("publishErrorDescription"),
        duration: 5000,
      });
      throw publishError; // keep the ConfirmDialog open (retry path)
    }
  };

  const handleReset = async () => {
    const empty: PublishableTheme = { light: {}, dark: {} };
    try {
      await publish(empty);
      setDraft(empty);
      toast.success(t("resetSuccessTitle"), {
        description: t("resetSuccessDescription"),
        duration: 3000,
      });
    } catch (resetError) {
      console.error("Error resetting theme:", resetError);
      toast.error(t("publishErrorTitle"), {
        description: t("publishErrorDescription"),
        duration: 5000,
      });
      throw resetError;
    }
  };

  /** The STORED theme as a stylesheet — ladder row 26: the L4 raw view and
   *  the L3 "Export CSS" are the same artifact, P4's export of what is
   *  actually live, never the unpublished draft. Equal to the draft only
   *  when the editor is clean. */
  const storedCss = React.useMemo(
    () =>
      buildThemeCss(
        resolveTheme("light", savedTheme.light),
        resolveTheme("dark", savedTheme.dark),
      ),
    [savedTheme],
  );

  const handleExportCss = async () => {
    try {
      await navigator.clipboard.writeText(storedCss);
      toast.success(t("exportCopied"));
    } catch {
      toast.error(tCommon("copyFailed"));
    }
  };

  // ---- render --------------------------------------------------------------
  const publishDisabled = !dirty || publishing || loading;

  const headerAction = (
    <>
      {dirty ? (
        <span
          className={cn(
            "inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground",
            "animate-in fade-in zoom-in-95 duration-150",
          )}
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
          {t("unsavedChanges")}
        </span>
      ) : null}
      <Button
        type="button"
        variant="outline"
        onClick={() => setPreviewSheetOpen(true)}
        className="lg:hidden"
      >
        {t("preview")}
      </Button>
      <OverflowMenu
        className="size-11 md:size-8"
        items={[
          {
            label: t("menu.import"),
            onSelect: () => setImportOpen(true),
          },
          {
            label: t("menu.export"),
            onSelect: () => void handleExportCss(),
          },
          {
            label: rawVisible ? t("menu.hideRaw") : t("menu.showRaw"),
            onSelect: () => setRawVisible((current) => !current),
          },
          {
            label: t("menu.reset"),
            destructive: true,
            onSelect: () => setResetOpen(true),
          },
        ]}
      />
      <Button
        type="button"
        onClick={() => setPublishOpen(true)}
        disabled={publishDisabled}
      >
        {t("publish")}
      </Button>
    </>
  );

  return (
    <PageShell>
      {/* The one critical mobile action: publish from a phone (T3). */}
      <MobileTopbarAction>
        <Button
          type="button"
          size="sm"
          onClick={() => setPublishOpen(true)}
          disabled={publishDisabled}
        >
          {t("publish")}
        </Button>
      </MobileTopbarAction>

      <PageHeader
        title={tNav("configuration")}
        description={t("description")}
        action={headerAction}
      />

      {error && !loading ? (
        <EmptyState
          variant="error"
          title={t("loadErrorTitle")}
          description={t("loadErrorDescription")}
          action={{ label: tCommon("retry"), onClick: () => void refetch() }}
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-6">
            <ThemeEditor
              mode={mode}
              onModeChange={handleModeChange}
              overrides={draft}
              onValueChange={handleValueChange}
              onResetToken={handleResetToken}
              search={search}
              onSearchChange={setSearch}
              modifiedOnly={modifiedOnly}
              onModifiedOnlyChange={setModifiedOnly}
              loading={loading}
            />

            {rawVisible ? <RawView theme={savedTheme} css={storedCss} /> : null}
          </div>

          {/* ≥ lg: sticky inline preview. Below lg the same component lives
              in the bottom Sheet — reachable via the persistent Preview
              button, never hidden away (T2). */}
          <ThemePreview
            mode={previewMode}
            onModeChange={setPreviewMode}
            overrides={draft}
            className="hidden lg:sticky lg:top-6 lg:block"
          />
        </div>
      )}

      {/* --- overlays (one at a time, anti-pattern #3) --- */}

      <ImportCssDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
      />

      {/* Both summaries count with countModifiedTokens — the SAME semantic as
          the editor's tab badges (values differing from defaults), so the
          numbers an admin confirms are the numbers they just saw. */}
      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        variant="default"
        title={t("publishConfirmTitle")}
        description={t("publishConfirmDescription", {
          lightCount: countModifiedTokens("light", draft),
          darkCount: countModifiedTokens("dark", draft),
        })}
        confirmLabel={t("publish")}
        onConfirm={handlePublish}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        variant="destructive"
        title={t("resetConfirmTitle")}
        description={t("resetConfirmDescription", {
          count:
            countModifiedTokens("light", draft) +
            countModifiedTokens("dark", draft),
        })}
        confirmLabel={t("resetConfirmAction")}
        onConfirm={handleReset}
      />

      <Sheet open={previewSheetOpen} onOpenChange={setPreviewSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="pb-4 text-left">
            <SheetTitle>{t("preview")}</SheetTitle>
          </SheetHeader>
          <ThemePreview
            mode={previewMode}
            onModeChange={setPreviewMode}
            overrides={draft}
            className="border-0 shadow-none [&>div]:px-0"
          />
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}

/**
 * L4 raw view (ladder row 26): the STORED `config_value` as JSON and the
 * generated stylesheet of the published theme, each with one-click copy —
 * P4's export/inspection path. Deliberately NOT the draft: copying here must
 * yield exactly what is live for the org, even mid-edit (the labels say
 * "stored"/"published" and must stay truthful).
 */
function RawView({
  theme,
  css,
}: {
  theme: PublishableTheme;
  css: string;
}) {
  const t = useTranslations("configuration");

  const json = React.useMemo(
    () => JSON.stringify({ light: theme.light, dark: theme.dark }, null, 2),
    [theme],
  );

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        {t("raw.title")}
      </h3>
      <RawBlock label={t("raw.json")} copyLabel={t("raw.copyJson")} value={json} />
      <RawBlock label={t("raw.css")} copyLabel={t("raw.copyCss")} value={css} />
    </section>
  );
}

function RawBlock({
  label,
  copyLabel,
  value,
}: {
  label: string;
  copyLabel: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <CopyButton value={value} label={copyLabel} />
      </div>
      <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
        {value}
      </pre>
    </div>
  );
}
