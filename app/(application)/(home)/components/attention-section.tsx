"use client";

/**
 * Region C — "Needs attention" (design/pages/dashboard.md §3 #4).
 *
 * Composes the RBAC-gated failure sources into the shared AttentionList
 * primitive: failed/stuck background jobs of the last 24h (routine runs for
 * workflows:write, eval jobs for evals:read — knowledge embedding/processing
 * failures land in the same job_results feed, see hooks.ts) and budgets at
 * ≥80% / over pace (budget_management:read). Healthy state collapses to one
 * quiet all-clear line; the destructive count badge pulses once when the
 * count INCREASES while mounted (dashboard.md motion #4) and respects
 * reduced motion.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import {
  AttentionList,
  type AttentionItem,
} from "@/components/primitives/attention-list";
import { RelativeTime } from "@/components/primitives/relative-time";
import { WidgetSection } from "@/components/primitives/widget-section";
import { Badge } from "@/components/ui/badge";

import type { BudgetAlert, FailedJob } from "../hooks";

export interface AttentionSectionProps {
  allowed: boolean;
  canWorkflows: boolean;
  canEvals: boolean;
  canBudgets: boolean;
  jobs: { jobs: FailedJob[]; loading: boolean; error: boolean };
  budgets: { alerts: BudgetAlert[]; loading: boolean; error: boolean };
  className?: string;
  style?: React.CSSProperties;
}

/** Count badge with a single one-shot pulse when the count increases. */
function CountBadge({ count }: { count: number }) {
  const [tracked, setTracked] = React.useState({ prev: count, pulse: false });
  React.useEffect(() => {
    setTracked((state) =>
      count === state.prev ? state : { prev: count, pulse: count > state.prev },
    );
  }, [count]);

  if (count === 0) return null;
  return (
    <Badge
      // Re-mount on every increase so the one-shot pulse replays exactly once.
      key={tracked.prev}
      variant="destructive"
      className={
        tracked.pulse
          ? "motion-safe:animate-in motion-safe:zoom-in-75 motion-safe:duration-300"
          : undefined
      }
    >
      {count}
    </Badge>
  );
}

export function AttentionSection({
  allowed,
  canWorkflows,
  canEvals,
  canBudgets,
  jobs,
  budgets,
  className,
  style,
}: AttentionSectionProps) {
  const t = useTranslations("home");

  const items = React.useMemo<AttentionItem[]>(() => {
    const rows: AttentionItem[] = [];

    for (const job of jobs.jobs) {
      // Same predicates as nav-config, evaluated upstream (lib/rights can()).
      if (job.isEval ? !canEvals : !canWorkflows) continue;
      const variant = job.isEval ? "eval" : "run";
      const state = job.state === "stuck" ? "Stuck" : "Failed";
      const title = job.label
        ? t(`attention.${variant}${state}`, { label: job.label })
        : t(`attention.${variant}${state}NoLabel`);
      rows.push({
        id: `job-${job.id}`,
        severity: job.state === "failed" ? "error" : "warn",
        title,
        meta: <RelativeTime date={job.createdAt} />,
        href: job.isEval ? "/evals" : "/workflows",
      });
    }

    if (canBudgets) {
      for (const alert of budgets.alerts) {
        rows.push({
          id: `budget-${alert.id}`,
          severity: alert.level === "over" ? "error" : "warn",
          title: t(
            alert.level === "over" ? "attention.budgetOver" : "attention.budgetWarn",
            { name: alert.name, percent: alert.percentUsed },
          ),
          href: "/budgets",
        });
      }
    }

    // Failures before warnings (problems earn weight — philosophy §4).
    return rows.sort((a, b) =>
      a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1,
    );
  }, [jobs.jobs, budgets.alerts, canWorkflows, canEvals, canBudgets, t]);

  const loading = jobs.loading || budgets.loading;
  const partialError = !loading && (jobs.error || (canBudgets && budgets.error));

  return (
    <WidgetSection
      allowed={allowed}
      title={t("attention.title")}
      meta={loading ? undefined : <CountBadge count={items.length} />}
      className={className}
      style={style}
    >
      <div className="space-y-2">
        <AttentionList
          items={items}
          loading={loading}
          allClearLabel={t("attention.allClear")}
        />
        {partialError && (
          <p className="text-xs text-muted-foreground">
            {t("attention.partialError")}
          </p>
        )}
      </div>
    </WidgetSection>
  );
}
