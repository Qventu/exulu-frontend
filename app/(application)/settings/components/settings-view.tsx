"use client";

/**
 * /settings — every personal preference in one calm column
 * (design/pages/settings-config.md §3; primary persona P1).
 *
 * L1, top to bottom: Appearance (Light/Dark/System segmented control — fixes
 * U6, "system" is restorable), Language (Select; cookie + reload behavior
 * preserved, inventory #3), Personal system prompt (the existing field,
 * dirty-gated Save — fixes U13), Account (read-only identity + the
 * "Personal API token →" row, inventory #4 made discoverable).
 *
 * One source of truth (work-item mandate): theme goes through the SAME
 * next-themes `setTheme` and language through the SAME LanguageProvider
 * `setLocale` the user menu uses — no parallel state.
 *
 * Sections are whitespace + Separator, zero Cards (philosophy §4: dividers
 * over boxes). The page's single purple element is the prompt's Save when
 * dirty. Mobile (Tier A): full-width controls below `sm`, ≥44px targets,
 * no behavior differences.
 */

import { ChevronRight, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import * as React from "react";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { FormSection } from "@/components/primitives/form-section";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { useLanguage } from "@/components/shell/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

import { usePersonalSystemPrompt, type SettingsUser } from "../hooks";

export function SettingsView() {
  const t = useTranslations("settings");
  const tNav = useTranslations("navigation");
  const { user, value, setValue, dirty, saving, save } =
    usePersonalSystemPrompt();

  return (
    <PageShell variant="narrow">
      {/* H1 = nav label canon (navigation.md §1.1 #4). No header action —
          each section owns its own state (settings-config.md §3). */}
      <PageHeader title={tNav("settings")} description={t("description")} />

      <div className="flex flex-col gap-8">
        <FormSection
          title={t("appearance.title")}
          description={t("appearance.description")}
        >
          <ThemeControl />
        </FormSection>

        <Separator />

        <FormSection
          title={t("language.title")}
          description={t("language.description")}
        >
          <LanguageControl promptDirty={dirty} />
        </FormSection>

        <Separator />

        <FormSection
          title={t("prompt.title")}
          description={t("prompt.description")}
        >
          <PromptEditor
            value={value}
            onChange={setValue}
            dirty={dirty}
            saving={saving}
            canSave={Boolean(user?.id)}
            onSave={save}
          />
        </FormSection>

        <Separator />

        <FormSection
          title={t("account.title")}
          description={t("account.description")}
        >
          <AccountRows user={user} />
        </FormSection>
      </div>
    </PageShell>
  );
}

/* ------------------------------ Appearance ------------------------------- */

const THEME_OPTIONS: ReadonlyArray<{
  value: "light" | "dark" | "system";
  icon: LucideIcon;
  i18nKey: string;
}> = [
  // Same labels as the user menu — one vocabulary for one mechanism.
  { value: "light", icon: Sun, i18nKey: "navigation.userMenu.themeLight" },
  { value: "dark", icon: Moon, i18nKey: "navigation.userMenu.themeDark" },
  { value: "system", icon: Monitor, i18nKey: "navigation.userMenu.themeSystem" },
];

/**
 * Light / Dark / System segmented control. Writes through next-themes
 * `setTheme` — the exact mechanism behind the user-menu toggle (no parallel
 * state). The sliding thumb is the motion-budget moment (200 ms ease-in-out,
 * settings-config.md §3 Motion); reduced motion gets an instant swap.
 */
function ThemeControl() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const reduceMotion = useReducedMotion();

  // next-themes is undefined until mounted — render a placeholder to avoid a
  // hydration mismatch (same guard the shell uses for theme-aware UI).
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <Skeleton className="h-[52px] w-full rounded-lg sm:w-96 md:h-10" />;
  }

  const current = theme ?? "system";

  return (
    // gap-2 below md keeps ≥8 px between adjacent touch targets (responsive.md §2).
    <ToggleGroup
      type="single"
      value={current}
      // Radix emits "" when the active item is clicked again — never deselect.
      onValueChange={(next) => {
        if (next) setTheme(next);
      }}
      aria-label={t("navigation.userMenu.theme")}
      className="grid w-full grid-cols-3 gap-2 rounded-lg bg-muted p-1 sm:inline-grid sm:w-auto sm:grid-cols-[repeat(3,minmax(7rem,1fr))] md:gap-1"
    >
      {THEME_OPTIONS.map(({ value, icon: Icon, i18nKey }) => {
        const active = current === value;
        return (
          <ToggleGroupItem
            key={value}
            value={value}
            className={cn(
              // 44 px touch floor below md (Tier A page), desktop sugar from md.
              "relative h-11 min-w-0 gap-2 rounded-md px-3 text-sm md:h-8",
              "text-muted-foreground hover:bg-transparent hover:text-foreground",
              "data-[state=on]:bg-transparent data-[state=on]:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId="settings-theme-thumb"
                aria-hidden="true"
                className="absolute inset-0 rounded-md border bg-background shadow-sm"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.2, ease: "easeInOut" }
                }
              />
            ) : null}
            <Icon aria-hidden="true" className="relative z-10 size-4 shrink-0" />
            <span className="relative z-10 truncate">{t(i18nKey)}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

/* ------------------------------- Language -------------------------------- */

/**
 * Locale endonym ("English", "Deutsch") via Intl.DisplayNames — mirrors the
 * user menu so both surfaces speak identically; scales to any future entry in
 * i18n/config.ts without new message keys.
 */
function localeEndonym(code: Locale): string {
  try {
    const label = new Intl.DisplayNames([code], { type: "language" }).of(code);
    if (!label) return code;
    return label.charAt(0).toLocaleUpperCase(code) + label.slice(1);
  } catch {
    return code;
  }
}

/**
 * Language Select — goes through LanguageProvider#setLocale (cookie write +
 * message load + reload, inventory #3 preserved). When the prompt section is
 * dirty, the reload is guarded by a ConfirmDialog (settings-config.md risk 5)
 * so unsaved edits are never silently discarded.
 */
function LanguageControl({ promptDirty }: { promptDirty: boolean }) {
  const t = useTranslations("settings");
  const { locale, setLocale } = useLanguage();
  const [pendingLocale, setPendingLocale] = React.useState<Locale | null>(null);

  const apply = React.useCallback(
    (next: Locale) => {
      void setLocale(next);
    },
    [setLocale],
  );

  const handleChange = (next: string) => {
    const code = next as Locale;
    if (code === locale) return;
    if (promptDirty) {
      setPendingLocale(code);
      return;
    }
    apply(code);
  };

  return (
    <div className="flex flex-col gap-2">
      <Select value={locale} onValueChange={handleChange}>
        <SelectTrigger
          aria-label={t("language.title")}
          className="h-11 w-full text-base sm:max-w-xs md:h-10 md:text-sm"
        >
          <SelectValue placeholder={t("language.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {locales.map((code) => (
            <SelectItem key={code} value={code}>
              {localeEndonym(code)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t("language.hint")}</p>

      <ConfirmDialog
        open={pendingLocale !== null}
        onOpenChange={(open) => {
          if (!open) setPendingLocale(null);
        }}
        variant="default"
        title={t("language.confirmTitle")}
        description={t("language.confirmDescription")}
        confirmLabel={t("language.confirmAction")}
        onConfirm={async () => {
          if (pendingLocale) apply(pendingLocale);
        }}
      />
    </div>
  );
}

/* --------------------------- Personal prompt ----------------------------- */

interface PromptEditorProps {
  value: string;
  onChange: (next: string) => void;
  dirty: boolean;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
}

function PromptEditor({
  value,
  onChange,
  dirty,
  saving,
  canSave,
  onSave,
}: PromptEditorProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-grow to fit content (6-row minimum via min-h; `resize-y` kept from
  // the old page, inventory #9).
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("prompt.placeholder")}
        rows={6}
        className="min-h-36 max-h-[60dvh] resize-y text-base md:text-sm"
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">
          {t("prompt.charCount", { count: value.length })}
        </span>
        {/* The page's only primary (purple) element — enabled only when dirty
            (fixes U13); full-width below sm (Tier A thumb reach). */}
        <Button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving || !canSave}
          className="w-full sm:w-auto"
        >
          {saving ? t("prompt.saving") : tCommon("save")}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------- Account -------------------------------- */

/**
 * Read-only identity rows (settings-config.md §3 item 5) + the
 * "Personal API token →" link row.
 *
 * RBAC, stated precisely (ladder row 4): the row renders for ALL
 * authenticated users — today's `/token` behavior, preserved. The intended
 * predicate `super_admin || role.api ∈ {read, write}` is NOT yet evaluable
 * (`role.api` is never populated by serverSideAuthCheck — keys-token.md U3);
 * applying it early would silently collapse the row to super_admin-only.
 * Flip it here once the auth-check fix lands.
 */
function AccountRows({ user }: { user: SettingsUser | null }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");

  const fullName = [user?.firstname, user?.lastname]
    .filter(Boolean)
    .join(" ");
  const roleName =
    typeof user?.role === "object" && user?.role !== null
      ? user.role.name
      : typeof user?.role === "string"
        ? user.role
        : undefined;

  return (
    <div className="flex flex-col gap-1">
      <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-x-4">
        <dt className="text-muted-foreground">{tCommon("name")}</dt>
        <dd className="min-w-0 break-words">{fullName || "—"}</dd>

        <dt className="text-muted-foreground sm:pt-2">{t("account.email")}</dt>
        <dd className="min-w-0 break-all sm:pt-2">{user?.email || "—"}</dd>

        <dt className="text-muted-foreground sm:pt-2">{t("account.role")}</dt>
        <dd className="flex min-w-0 flex-wrap items-center gap-1.5 sm:pt-2">
          {roleName ? (
            <Badge variant="outline">{roleName}</Badge>
          ) : (
            <span>—</span>
          )}
          {user?.super_admin ? (
            <Badge variant="outline">{t("account.superAdmin")}</Badge>
          ) : null}
        </dd>
      </dl>

      <Separator className="my-3" />

      <Button
        asChild
        variant="link"
        className="h-11 w-fit justify-start gap-1 px-0 md:h-8"
      >
        <Link href="/token">
          {t("account.token")}
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </Button>
    </div>
  );
}
