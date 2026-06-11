"use client";

/**
 * AuthShell — the branded pre-auth frame (design/pages/auth.md §3 "Layout &
 * components"). The one full-bleed brand surface in the product: `/login`
 * sits outside the app shell, so none of the philosophy §5 page bones
 * (PageShell / PageHeader / Toolbar) apply here — this frame is the written
 * alternative.
 *
 * - Centered column slot (`w-full max-w-[350px] px-4` — fluid, no fixed-width
 *   overflow at 320 px; responsive.md rule 3) with the generic "AI Studio"
 *   wordmark at the top (product decision 2026-06-11: the same wordmark
 *   treatment as the shell TopBar — the customer logo concept is retired on
 *   this surface; the backend theme variables remain the white-label carrier).
 * - Optional cover pane (`hidden lg:block`) — the backend `/cover.jpg` brand
 *   panel, decorative (`alt=""`, fixes auth.md U15).
 * - Slim footer (`h-14`-class): dynamic © year (fixes U17), config-driven
 *   terms link, and the EN/DE locale switcher (the one new control — makes
 *   i18n real pre-auth, fixes U6). Safe-area padded (responsive.md V3).
 * - The frame never owns scroll: the body scrolls naturally (`min-h-dvh`,
 *   V1/V4 — the keyboard can no longer trap the submit button).
 *
 * MIGRATION-STUB: codebase-structure.md §2.5 homes this in
 * `components/shell/auth-shell.tsx`. Built route-locally per the parallel
 * protocol (shell folder is owned by another track); graduate by moving the
 * file and updating the two imports (layout + this comment).
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { Brand } from "@/components/shell/brand";

import { LocaleSwitcher } from "./locale-switcher";

export interface AuthShellProps {
  /** Backend-served brand panel image; pane is omitted when unset. */
  coverUrl?: string;
  /** Config-driven Terms & Conditions link (auth.md U17); hidden when unset. */
  termsHref?: string;
  /** The column content (login steps, error boundary, future pre-auth surfaces). */
  children: React.ReactNode;
}

export function AuthShell({ coverUrl, termsHref, children }: AuthShellProps) {
  const t = useTranslations("auth");

  return (
    <div className="flex min-h-dvh flex-col">
      {/* The ONE <main> landmark of the pre-auth document. */}
      <main className="grid grow lg:grid-cols-2">
        {/* Left pane: the vertically centered column. */}
        <div className="flex items-center justify-center px-4 py-8 lg:py-12">
          <div className="flex w-full max-w-[350px] flex-col gap-8">
            {/* Generic wordmark — same treatment as the shell TopBar. */}
            <Brand className="px-0" />
            {children}
          </div>
        </div>

        {/* Right pane (≥ lg): the white-label cover panel — decorative. */}
        {coverUrl ? (
          <div className="hidden bg-muted lg:block">
            {/* Native img: backend host is runtime-configured, so next/image
                remote allow-listing can't apply; the image is decorative. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt="" className="size-full object-cover" />
          </div>
        ) : null}
      </main>

      {/* Slim page footer: © + terms (config-driven) + locale toggle. */}
      <footer className="flex min-h-14 items-center justify-between gap-4 border-t px-4 pb-[env(safe-area-inset-bottom)] md:px-8">
        <p className="text-xs text-muted-foreground">
          {/* String, not number: ICU would group-format a numeric year ("2,026"). */}
          {t("footer.copyright", { year: String(new Date().getFullYear()) })}
        </p>
        <div className="flex items-center gap-2">
          {termsHref ? (
            // ≥44 px hit area below md (responsive.md "Touch targets" / DoD §5)
            // and a persistent underline — the link affordance is never
            // hover-only (T7).
            <a
              href={termsHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-xs text-muted-foreground underline underline-offset-4 transition-colors duration-150 hover:text-foreground md:min-h-0 md:min-w-0 md:px-0"
            >
              {t("footer.terms")}
            </a>
          ) : null}
          <LocaleSwitcher />
        </div>
      </footer>
    </div>
  );
}
