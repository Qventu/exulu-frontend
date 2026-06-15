"use client";

/**
 * FeedbackSummaryStat — tiny presentational sentence in the PageHeader meta
 * slot summarising "% positive · N negative". Clicking the negative count
 * filters the list to negative items (spec §3 default view).
 *
 * Renders nothing while the summary is loading or zero total.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";

import type { FeedbackSummary, FeedbackTypeFilter } from "./use-feedback-query";

export interface FeedbackSummaryStatProps {
  summary: FeedbackSummary;
  onSelectType: (type: FeedbackTypeFilter) => void;
}

export function FeedbackSummaryStat({
  summary,
  onSelectType,
}: FeedbackSummaryStatProps) {
  const t = useTranslations("feedbackReview");
  if (summary.loading || summary.total === 0) return null;
  // Split the localized line on {negative} so the count becomes an inline
  // button without resorting to rich-text segments. The ICU string is
  // "{percent}% positive · {negative} negative" — the consumer locale strings
  // both use the same placeholder name so the split is stable.
  const rendered = t("summaryStat", {
    percent: summary.percent,
    negative: "__NEG__",
  });
  const [before, after] = rendered.split("__NEG__");
  return (
    <span className="inline-flex items-baseline gap-1 text-sm text-muted-foreground">
      <span>{before}</span>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto px-0 text-sm font-normal text-muted-foreground underline-offset-2 hover:text-foreground"
        onClick={() => onSelectType("negative")}
      >
        {summary.negative}
      </Button>
      <span>{after}</span>
    </span>
  );
}
