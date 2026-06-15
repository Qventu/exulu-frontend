"use client";

/**
 * /feedback — the P3 review console (not the footer's "Send feedback"
 * dialog). Composed of PageShell + PageHeader + Toolbar + ListDetail per
 * design/pages/feedback.md.
 *
 * RBAC: layout.tsx wraps this client page with `guardRoute("feedback")`,
 * so no client guard is needed here — non-admins get <AccessDenied/>
 * server-side. ListDetail uses useSearchParams, so the body lives inside
 * a <Suspense/> boundary (Next.js App Router rule).
 */

import { Suspense } from "react";

import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { useTranslations } from "next-intl";

import { FeedbackList } from "./components/feedback-list";
import { FeedbackSummaryStat } from "./components/feedback-summary-stat";
import { useFeedbackQuery } from "./components/use-feedback-query";

export const dynamic = "force-dynamic";

function FeedbackPageBody() {
  const t = useTranslations("feedbackReview");
  const query = useFeedbackQuery();

  return (
    <PageShell variant="content">
      <PageHeader
        title={t("title")}
        description={t("description")}
        meta={
          <FeedbackSummaryStat
            summary={query.summary}
            onSelectType={query.setType}
          />
        }
      />
      <FeedbackList query={query} />
    </PageShell>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={null}>
      <FeedbackPageBody />
    </Suspense>
  );
}
