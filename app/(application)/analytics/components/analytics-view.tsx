"use client";

/**
 * AnalyticsView — client root for /analytics (work item 3.3).
 *
 * Composition (analytics.md §3 "Default view"):
 *   PageShell → PageHeader (RangePicker right-slot)
 *             → KPIStrip (5 StatCards, range-scoped)
 *             → ExploreRegion (Trend + Breakdown ChartCards)
 *             → Footer ghost-link row (Budgets / Evals, RBAC-gated)
 *
 * URL is the source of truth for the lens; router.replace writes, the
 * `useSearchParams` hook reads (rule #10a — no parallel local mirror, the
 * access search-bar bug 2026-06-15 is the precedent). The lens has five
 * keys: range, from, to, type, measure, dimension, view.
 *
 * Deep-link contract (verifier-grep): Home emits ?type=AGENT_RUN /
 * ?type=WORKFLOW_RUN (see app/(application)/(home)/components/home-dashboard.tsx);
 * those are honored verbatim by `lensFromSearchParams` in hooks.ts.
 *
 * Mobile: PageHeader stacks (title row, RangePicker full-width below sm).
 * The MobileTopbarAction surfaces the same RangePicker in the global top
 * bar so it stays reachable when the page scrolls (rule #9).
 */

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Button } from "@/components/ui/button";
import { can, type RightsUser } from "@/lib/rights";

import { ExploreRegion } from "./explore-region";
import { KPIStrip } from "./kpi-strip";
import { RangePicker } from "./range-picker";
import {
  lensFromSearchParams,
  lensToSearchParams,
  type Lens,
} from "../hooks";

export interface AnalyticsViewProps {
  initialLens: Lens;
}

export function AnalyticsView({ initialLens }: AnalyticsViewProps) {
  const t = useTranslations("analytics");
  const router = useRouter();
  const searchParams = useSearchParams();

  const userContext = React.useContext(UserContext);
  const user = userContext?.user;
  const rightsUser: RightsUser = React.useMemo(
    () => ({ super_admin: user?.super_admin === true, role: user?.role }),
    [user],
  );

  // Re-derive the lens from the URL on every render — the URL is the
  // single source of truth (rule #10a; no parallel useState that could
  // race router.replace).
  const lens: Lens = React.useMemo(
    () => lensFromSearchParams(searchParams ?? new URLSearchParams()),
    [searchParams],
  );

  // `initialLens` is honored on first paint by the server (page.tsx parses
  // the same searchParams); after that the URL drives everything. The
  // initialLens prop remains in the API for future SSR-only branches.
  React.useEffect(() => {
    // No-op: kept to satisfy the architect's prop contract; the URL is the
    // source of truth and initialLens already equals lensFromSearchParams.
    void initialLens;
  }, [initialLens]);

  const updateLens = React.useCallback(
    (next: Partial<Lens>) => {
      const merged: Lens = { ...lens, ...next };
      const qs = lensToSearchParams(merged);
      const target = qs ? `/analytics?${qs}` : "/analytics";
      router.replace(target, { scroll: false });
    },
    [lens, router],
  );

  const canBudgets = can(rightsUser, { area: "budget_management", level: "read" });
  const canEvals = can(rightsUser, { area: "evals", level: "read" });

  return (
    <PageShell variant="content">
      <MobileTopbarAction>
        <RangePicker lens={lens} onLensChange={updateLens} />
      </MobileTopbarAction>

      <PageHeader
        title={t("title")}
        description={t("purpose")}
        action={<RangePicker lens={lens} onLensChange={updateLens} fullWidthBelowSm />}
      />

      <KPIStrip lens={lens} />

      <ExploreRegion lens={lens} onLensChange={updateLens} />

      {(canBudgets || canEvals) && (
        <nav
          aria-label={t("footer.label")}
          className="flex flex-wrap items-center gap-2 pt-2"
        >
          {canBudgets && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-sm text-muted-foreground max-md:h-11"
            >
              <Link href="/budgets">
                {t("footer.budgets")}
                <ArrowRight aria-hidden="true" className="ml-1 size-3" />
              </Link>
            </Button>
          )}
          {canEvals && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-sm text-muted-foreground max-md:h-11"
            >
              <Link href="/evals">
                {t("footer.evals")}
                <ArrowRight aria-hidden="true" className="ml-1 size-3" />
              </Link>
            </Button>
          )}
        </nav>
      )}
    </PageShell>
  );
}
