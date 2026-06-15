"use client";

/**
 * AnalyticsView — client root for /analytics.
 *
 * /analytics is 100% LiteLLM-driven — data plumbing lives in ../hooks
 * (useActivityTotals / useActivityDaily / useActivityByTag) which call the
 * backend's /admin/litellm/tag-activity proxy.
 *
 * Composition:
 *   PageShell → PageHeader (RangePicker + Open LiteLLM admin link)
 *             → KPIStrip (lens-scoped totals)
 *             → ExploreRegion (Trend + Breakdown ChartCards)
 *             → Footer ghost-link row (Budgets / Evals, RBAC-gated)
 *
 * URL is the source of truth for the lens; router.replace writes, the
 * `useSearchParams` hook reads (rule #10a — no parallel local mirror).
 *
 * Deep-link compat: legacy ?type=AGENT_RUN / ?type=WORKFLOW_RUN URLs are
 * remapped by lensFromSearchParams (AGENT_RUN→agents, WORKFLOW_RUN→all per
 * honest fallback). When the user's URL was remapped we surface a quiet
 * one-shot toast so the deep-link is honored AND visible.
 *
 * Mobile: PageHeader stacks (title row, RangePicker full-width below sm).
 * The MobileTopbarAction surfaces the same RangePicker in the global top
 * bar so it stays reachable when the page scrolls (rule #9).
 */

import { ArrowRight, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { ConfigContext } from "@/components/shell/config-context";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Button } from "@/components/ui/button";
import { getLiteLLMAdminUrl } from "@/lib/litellm-admin-url";
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

/**
 * Legacy ?type=* values we remap (kept in-sync with LENS_TYPE_FROM_LEGACY
 * in ./lens). Used only to detect "this deep link was rewritten so we
 * should tell the user" — the actual remap happens in lensFromSearchParams.
 */
const LEGACY_TYPES_REMAPPED_TO_AGENTS = new Set(["AGENT_RUN", "TOOL_CALL"]);
const LEGACY_TYPES_REMAPPED_TO_ALL = new Set([
  "WORKFLOW_RUN",
  "CONTEXT_RETRIEVE",
  "CONTEXT_UPSERT",
  "SOURCE_UPDATE",
  "EMBEDDER_GENERATE",
  "EMBEDDER_UPSERT",
  "EMBEDDER_DELETE",
]);

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

  const configContext = React.useContext(ConfigContext);
  const litellmEnabled = configContext?.liteLLM?.enabled === true;
  const adminUiUrl = React.useMemo(
    () => getLiteLLMAdminUrl(configContext?.backend),
    [configContext?.backend],
  );

  // Re-derive the lens from the URL on every render — the URL is the
  // single source of truth (rule #10a; no parallel useState that could
  // race router.replace).
  const lens: Lens = React.useMemo(
    () => lensFromSearchParams(searchParams ?? new URLSearchParams()),
    [searchParams],
  );

  // `initialLens` is honored on first paint by the server (page.tsx parses
  // the same searchParams); after that the URL drives everything.
  React.useEffect(() => {
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

  // One-shot deep-link toast: if the legacy ?type=AGENT_RUN /
  // ?type=WORKFLOW_RUN value was remapped, tell the user once so the URL
  // change isn't silent. The `legacyTypeRaw` ref guards against re-firing
  // when the user re-toggles the lens.
  const legacyToastFiredRef = React.useRef(false);
  React.useEffect(() => {
    if (legacyToastFiredRef.current) return;
    const raw = searchParams?.get("type");
    if (!raw) return;
    if (LEGACY_TYPES_REMAPPED_TO_AGENTS.has(raw)) {
      legacyToastFiredRef.current = true;
      toast(t("deepLinkLegacyTypeTitle"), {
        description: t("deepLinkLegacyTypeAgents"),
      });
    } else if (LEGACY_TYPES_REMAPPED_TO_ALL.has(raw)) {
      legacyToastFiredRef.current = true;
      toast(t("deepLinkLegacyTypeTitle"), {
        description: t("deepLinkLegacyTypeAll"),
      });
    }
  }, [searchParams, t]);

  const canBudgets = can(rightsUser, { area: "budget_management", level: "read" });
  const canEvals = can(rightsUser, { area: "evals", level: "read" });

  const headerAction = (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <RangePicker lens={lens} onLensChange={updateLens} fullWidthBelowSm />
      {litellmEnabled && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="max-md:h-11"
        >
          <a href={adminUiUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" className="mr-2 size-4" />
            {t("openLiteLLMAdmin")}
          </a>
        </Button>
      )}
    </div>
  );

  return (
    <PageShell variant="content">
      <MobileTopbarAction>
        <RangePicker lens={lens} onLensChange={updateLens} />
      </MobileTopbarAction>

      <PageHeader
        title={t("title")}
        description={t("purpose")}
        action={headerAction}
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
