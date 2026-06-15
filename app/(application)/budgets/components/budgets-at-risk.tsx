"use client";

/**
 * "Budgets at risk" — THE L1 monitoring section of the redesigned /budgets
 * page (budgets.md §3 concept). The headline AttentionList adoption (the
 * primitive's first dedicated consumer outside the Today page); aggregates
 * every entity type's over/warn budgets into a single calm feed.
 *
 * Severity mapping (AttentionList only supports `error|warn`):
 *  - projection.level === "over" → severity "error" (red dot, sorted first)
 *  - projection.level === "warn" → severity "warn"  (amber dot; ≥80% used OR
 *    over-pace burn-rate; rolled up because the 3-tier StatStrip in the
 *    page-doc concept is phase-2 / backend-blocked).
 *
 * Each row deep-links into the L2 config table via `?type=&search=` so
 * clicking a row pre-locates the entity in the entity-config section.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import {
  AttentionList,
  type AttentionItem,
} from "@/components/primitives/attention-list";
import { RelativeTime } from "@/components/primitives/relative-time";

import { useBudgetsAtRisk } from "../hooks";

export interface BudgetsAtRiskProps {
  enabled: boolean;
}

export function BudgetsAtRisk({ enabled }: BudgetsAtRiskProps) {
  const t = useTranslations("budgets");
  const { alerts, loading, error } = useBudgetsAtRisk(enabled);

  const items = React.useMemo<AttentionItem[]>(() => {
    return alerts.map((alert) => {
      // budgets.md audit criterion (6) — visible scope on each row so a
      // user named "Acme" and a team named "Acme" don't collide. The scope
      // word is the singular entity-type label.
      const scope = t(`entityType.${alert.entityType}`);
      return {
        id: alert.id,
        severity: alert.level === "over" ? "error" : "warn",
        title:
          alert.level === "over"
            ? t("atRisk.itemOver", {
                scope,
                name: alert.name,
                percent: alert.percentUsed,
              })
            : t("atRisk.itemWarn", {
                scope,
                name: alert.name,
                percent: alert.percentUsed,
              }),
        meta: alert.resetAt ? <RelativeTime date={alert.resetAt} /> : undefined,
        // Deep-link target: budgets-view reads ?type= and ?search= on mount.
        href: `/budgets?type=${alert.entityType}&search=${encodeURIComponent(alert.name)}`,
      };
    });
  }, [alerts, t]);

  // Quiet inline counts (full clickable StatStrip is phase-2 per
  // budgets.md — backend aggregate endpoint blocked).
  const overCount = alerts.filter((a) => a.level === "over").length;
  const warnCount = alerts.length - overCount;

  return (
    <section className="space-y-2" aria-label={t("atRisk.title")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">{t("atRisk.title")}</h2>
        {!loading && items.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("atRisk.counts", { over: overCount, warn: warnCount })}
          </p>
        ) : null}
      </div>
      <AttentionList
        items={items}
        loading={loading}
        allClearLabel={t("atRisk.allClear")}
      />
      {!loading && error ? (
        <p className="text-xs text-muted-foreground">{t("atRisk.partialError")}</p>
      ) : null}
    </section>
  );
}
