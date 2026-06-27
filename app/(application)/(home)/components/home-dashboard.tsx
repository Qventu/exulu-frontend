"use client";

/**
 * Home / "Today" — the calm, role-composed dashboard (design/pages/dashboard.md §3).
 *
 * Three regions in WidgetSections: Resume (get back to work), Vitals (is
 * everything normal?), Needs attention (what's not?) — plus a footer row of
 * RBAC-gated paths down. Charts, leaderboards and date-range exploration stay
 * one step away on /analytics. L1 defaults to P2's resume-the-loop job; P3/P4
 * content composes in strictly by RBAC via the SAME predicates as nav-config
 * (lib/rights.ts can() — nav and Home can never disagree).
 *
 * Mobile (<md): region order flips to triage-first — Needs attention, then
 * Resume, then Vitals 2×2 (responsive.md S6; dashboard.md mobile spec).
 *
 * Motion: one entrance stagger (fade-up 8px, 200ms, 50ms A→B→C), the
 * skeleton→content crossfades inside the primitives, and the attention badge
 * pulse — all reduced-motion safe. Nothing loops (dashboard.md §3 Motion).
 */

import { ArrowRight, Bot, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";
import { EmptyState } from "@/components/primitives/empty-state";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { StatCard, type StatCardDelta } from "@/components/primitives/stat-card";
import { WidgetSection } from "@/components/primitives/widget-section";
import { Button } from "@/components/ui/button";
import { can, type RightsUser } from "@/lib/rights";

import {
  useBudgetAlerts,
  useEvalRunsCount,
  useFailedJobs,
  useResumeSessions,
  useSessionsStat,
  useTodayVitals,
  useWorkflowRunsStat,
  type StatPair,
} from "../hooks";
import { AttentionSection } from "./attention-section";
import { ResumeStrip } from "./resume-strip";

/** Trend earns semantic color only past this band (dashboard.md §3 #3). */
const EMPHASIS_THRESHOLD_PERCENT = 25;

const ENTRANCE_CLASSES =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 motion-safe:fill-mode-backwards";

type RoleSlot = "workflows" | "budgets" | "evals" | null;

/** Render unattributed hint if gap between tagged and unfiltered is meaningful (>1%). */
function unattributedHint(
  tagged: number | null,
  unfiltered: number | null,
  format: (n: number) => string,
): string | undefined {
  if (tagged == null || unfiltered == null || unfiltered === 0) return undefined;
  const gap = unfiltered - tagged;
  if (gap <= 0) return undefined;
  if (gap / unfiltered <= 0.01) return undefined;
  return `+ ${format(gap)} unattributed`;
}

export function HomeDashboard() {
  const t = useTranslations("home");
  const tNav = useTranslations("navigation");
  const locale = useLocale();
  const userContext = React.useContext(UserContext);
  const user = userContext?.user;

  const rightsUser: RightsUser = React.useMemo(
    () => ({ super_admin: user?.super_admin === true, role: user?.role }),
    [user],
  );

  // Same predicates as nav-config rows (navigation.md §1.2) — never duplicated.
  const canWorkflows = can(rightsUser, { area: "workflows", level: "write" });
  const canEvals = can(rightsUser, { area: "evals", level: "read" });
  const canBudgets = can(rightsUser, { area: "budget_management", level: "read" });
  const canCreateAgents = can(rightsUser, { area: "agents", level: "write" });
  const canAnalytics = can(rightsUser, "super_admin");

  // Role-dependent 4th vitals slot, priority per dashboard.md §3 #3:
  // Routine runs → budgets → evals (super_admins resolve to routine runs and
  // reach the others via the footer links row).
  const roleSlot: RoleSlot = canWorkflows
    ? "workflows"
    : canBudgets
      ? "budgets"
      : canEvals
        ? "evals"
        : null;

  // All sources fire in parallel on mount; each region renders its own
  // skeleton and fails alone (WidgetSection error isolation).
  const resume = useResumeSessions(4);
  const sessionsStat = useSessionsStat();
  // Spend + Tokens (and Requests, if ever surfaced) share one /admin/litellm
  // /tag-activity round-trip per window (24h + 7d) — two fetches total for
  // the three LLM-traffic StatCards.
  const vitals = useTodayVitals();
  const spendStat = vitals.spend;
  const tokensStat = vitals.tokens;
  const workflowStat = useWorkflowRunsStat(roleSlot !== "workflows");
  const evalRuns = useEvalRunsCount(roleSlot !== "evals");
  const budgets = useBudgetAlerts(canBudgets);
  const failedJobs = useFailedJobs(canWorkflows || canEvals);

  const formatNumber = React.useMemo(
    () => new Intl.NumberFormat(locale),
    [locale],
  );
  // LiteLLM reports spend in the currency configured per-model — typically
  // USD. Hardcoded for now; multi-currency is a follow-up (analytics.md §4).
  const formatCurrency = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }),
    [locale],
  );

  /** 24h total vs 7-day daily average → StatCard delta + caption. */
  const trendOf = (
    stat: StatPair,
    format: (value: number) => string = formatNumber.format,
  ): { delta?: StatCardDelta; caption?: string } => {
    if (stat.current == null || stat.average == null) return {};
    const caption = t("vitals.vsAvg", { value: format(stat.average) });
    const percent =
      stat.average > 0
        ? ((stat.current - stat.average) / stat.average) * 100
        : 0;
    if (percent === 0) {
      return { delta: { value: t("vitals.noChange"), direction: "flat" }, caption };
    }
    return {
      delta: {
        value: `${percent > 0 ? "+" : "−"}${Math.abs(percent).toFixed(1)}%`,
        direction: percent > 0 ? "up" : "down",
        emphasis: Math.abs(percent) > EMPHASIS_THRESHOLD_PERCENT,
      },
      caption,
    };
  };

  const statValue = (value: number | null, error: boolean): string | number =>
    error || value == null ? "—" : value;

  /** Currency-formatted variant for the Spend card. */
  const spendStatValue = (value: number | null, error: boolean): string =>
    error || value == null ? "—" : formatCurrency.format(value);

  // Day-one platform: when there is nothing to resume AND the 24h vitals are
  // genuinely zero, one consolidated onboarding EmptyState replaces the three
  // hollow sections (dashboard.md §4 risks, "Empty platform").
  const vitalsSettled =
    !sessionsStat.loading && !spendStat.loading && !tokensStat.loading;
  const vitalsAllZero =
    !sessionsStat.error &&
    !spendStat.error &&
    !tokensStat.error &&
    sessionsStat.current === 0 &&
    spendStat.current === 0 &&
    tokensStat.current === 0;
  const showOnboarding =
    !resume.loading &&
    !resume.error &&
    resume.sessions.length === 0 &&
    vitalsSettled &&
    vitalsAllZero;

  const footerLinks = [
    canAnalytics && { id: "analytics", label: t("footer.analytics"), href: "/analytics" },
    canBudgets && { id: "budgets", label: tNav("budgets"), href: "/budgets" },
    canEvals && { id: "evals", label: tNav("evals"), href: "/evals" },
  ].filter(Boolean) as Array<{ id: string; label: string; href: string }>;

  return (
    <PageShell variant="content" className="max-w-6xl">
      <PageHeader
        title={tNav("home")}
        description={t("description")}
        action={
          <Button asChild>
            <Link href="/chat">
              <Plus aria-hidden="true" className="mr-2 size-4" />
              {t("newChat")}
            </Link>
          </Button>
        }
      />

      {showOnboarding ? (
        <EmptyState
          icon={Bot}
          title={t("onboarding.title")}
          description={t("onboarding.description")}
          action={
            canCreateAgents
              ? { label: t("onboarding.createAgent"), href: "/agents" }
              : { label: t("resume.emptyAction"), href: "/chat" }
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {/* Region A — Resume. Mobile order: triage first (responsive.md S6). */}
          <WidgetSection
            allowed
            title={t("resume.title")}
            className={`order-2 md:order-1 ${ENTRANCE_CLASSES}`}
          >
            <ResumeStrip
              sessions={resume.sessions}
              loading={resume.loading}
              error={resume.error}
            />
          </WidgetSection>

          {/* Region B — Vitals (24h), 2×2 on phones, 4-up from md. */}
          <WidgetSection
            allowed
            title={t("vitals.title")}
            className={`order-3 md:order-2 ${ENTRANCE_CLASSES}`}
            style={{ animationDelay: "50ms" }}
          >
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                label={t("vitals.sessions")}
                value={statValue(sessionsStat.current, sessionsStat.error)}
                loading={sessionsStat.loading}
                href={canAnalytics ? "/analytics" : undefined}
                {...trendOf(sessionsStat)}
              />
              <StatCard
                label={t("vitals.spend")}
                value={spendStatValue(spendStat.current, spendStat.error)}
                loading={spendStat.loading}
                href={
                  canAnalytics
                    ? "/analytics?dimension=agents&measure=spend"
                    : undefined
                }
                hint={unattributedHint(
                  spendStat.current,
                  vitals.unfilteredTotals?.spend ?? null,
                  formatCurrency.format,
                )}
                {...trendOf(spendStat, formatCurrency.format)}
              />
              <StatCard
                label={t("vitals.tokens")}
                value={statValue(tokensStat.current, tokensStat.error)}
                loading={tokensStat.loading}
                href={
                  canAnalytics
                    ? "/analytics?dimension=agents&measure=tokens"
                    : undefined
                }
                hint={unattributedHint(
                  tokensStat.current,
                  vitals.unfilteredTotals?.total_tokens ?? null,
                  formatNumber.format,
                )}
                {...trendOf(tokensStat)}
              />
              {roleSlot === "workflows" && (
                <StatCard
                  label={t("vitals.routineRuns")}
                  value={statValue(workflowStat.current, workflowStat.error)}
                  loading={workflowStat.loading}
                  // Routine runs are now attributed via routine_id_ tags
                  // (Phase 3.3.2). buildTags() emits the prefix on every
                  // cron-scheduled LLM call so /analytics?dimension=routines
                  // breaks down spend per routine. Fall back to /workflows
                  // for users without analytics access.
                  href={canAnalytics ? "/analytics?dimension=routines" : "/workflows"}
                  {...trendOf(workflowStat)}
                />
              )}
              {roleSlot === "budgets" && (
                <StatCard
                  label={t("vitals.budgetsAtRisk")}
                  value={statValue(budgets.alerts.length, budgets.error)}
                  loading={budgets.loading}
                  href="/budgets"
                />
              )}
              {roleSlot === "evals" && (
                <StatCard
                  label={t("vitals.evalRuns")}
                  value={statValue(evalRuns.count, evalRuns.error)}
                  loading={evalRuns.loading}
                  href="/evals"
                />
              )}
            </div>
          </WidgetSection>

          {/* Region C — Needs attention (leads on phones). */}
          <AttentionSection
            allowed={canWorkflows || canEvals || canBudgets}
            canWorkflows={canWorkflows}
            canEvals={canEvals}
            canBudgets={canBudgets}
            jobs={failedJobs}
            budgets={budgets}
            className={`order-1 md:order-3 ${ENTRANCE_CLASSES}`}
            style={{ animationDelay: "100ms" }}
          />
        </div>
      )}

      {/* Footer links row — no widgets, just RBAC-gated paths down. */}
      {footerLinks.length > 0 && (
        <nav
          aria-label={t("footer.label")}
          className="flex flex-wrap items-center gap-2"
        >
          {footerLinks.map((link) => (
            <Button
              key={link.id}
              asChild
              variant="ghost"
              size="sm"
              className="text-sm text-muted-foreground max-md:h-11"
            >
              <Link href={link.href}>
                {link.label}
                <ArrowRight aria-hidden="true" className="ml-1 size-3" />
              </Link>
            </Button>
          ))}
        </nav>
      )}
    </PageShell>
  );
}
