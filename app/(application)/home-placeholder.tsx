"use client";

// Interim Home for elevated accounts (design/navigation.md §1.2 "Home" row;
// IMPLEMENTATION_PLAN 1B: "a minimal placeholder until work item `dashboard`
// lands").
//
// TODO(design/pages/dashboard.md): this entire component is replaced by the
// real role-composed Home dashboard (work item 2.7 — Resume strip, Vitals,
// RBAC widget sections). Keep it honest and minimal until then: a header and
// the account's RBAC-visible top destinations from the same nav-config the
// sidebar consumes, so Home and nav can never disagree (lib/rights.ts).

import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { ConfigContext } from "@/components/shell/config-context";
import { visibleEntries, type NavEntry } from "@/components/shell/nav-config";

/**
 * Quick links cap: nav-config order is descending frequency-of-use
 * (navigation.md §1.1 principle 1), so the first rows are the account's "top
 * destinations". Keeps a super admin's grid small instead of mirroring the
 * whole sidebar.
 */
const QUICK_LINK_LIMIT = 8;

type LinkableEntry = NavEntry & { route: string };

export function HomePlaceholder() {
  const t = useTranslations();
  const userContext = React.useContext(UserContext);
  const config = React.useContext(ConfigContext);
  const user = userContext?.user;

  const entries = React.useMemo<LinkableEntry[]>(() => {
    if (!user) return [];
    return visibleEntries(
      { super_admin: user.super_admin === true, role: user.role },
      config ?? {},
    )
      .filter(
        (entry): entry is LinkableEntry =>
          entry.route !== null &&
          entry.route !== "/" &&
          entry.group !== "personal",
      )
      .slice(0, QUICK_LINK_LIMIT);
  }, [user, config]);

  return (
    <PageShell>
      <PageHeader
        title={t("navigation.home")}
        description={t("home.placeholderDescription")}
      />
      <section aria-labelledby="home-quick-links" className="space-y-4">
        <h2
          id="home-quick-links"
          className="text-sm font-medium text-muted-foreground"
        >
          {t("home.quickLinks")}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link
                href={entry.route}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <entry.icon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="truncate text-sm font-medium">
                  {t(entry.i18nKey)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
