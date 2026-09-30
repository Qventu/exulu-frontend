"use client";

/**
 * /transcriptions/[itemId] — the reading view (task-10 brief, Step 9 / design
 * §4.3). A thin client page: reads the id, fetches the item (hooks.ts owns
 * fetch policy — codebase-structure §3.2), and hands off to
 * `TranscriptDocument`. `?edit=1` requests edit mode; `TranscriptDocument`
 * currently accepts and ignores it (Task 12 wires the edit path).
 */
import { useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import * as React from "react";

import { EmptyState } from "@/components/primitives/empty-state";
import { PageShell } from "@/components/primitives/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

import { TranscriptDocument } from "../components/transcript-document";
import { useTranscriptItem } from "../hooks";

export default function TranscriptItemPage() {
  // useSearchParams needs a Suspense boundary for prerendering.
  return (
    <React.Suspense fallback={null}>
      <TranscriptItemPageInner />
    </React.Suspense>
  );
}

function TranscriptItemPageInner() {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const params = useParams();
  const searchParams = useSearchParams();
  const itemId = params?.itemId as string | undefined;

  const { item, loading, error, refetch } = useTranscriptItem(itemId ?? "");
  const mode = searchParams.get("edit") === "1" ? "edit" : "read";

  if (!itemId) return null;

  if (loading && !item) {
    return (
      <PageShell variant="content" className="max-w-6xl">
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)_300px]">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (!loading && (error || !item)) {
    return (
      <PageShell variant="content">
        <EmptyState
          variant="error"
          title={t("document.loadFailed")}
          description={error?.message}
          action={{ label: tCommon("retry"), onClick: () => void refetch() }}
        />
      </PageShell>
    );
  }

  if (!item) return null;

  return <TranscriptDocument item={item} mode={mode} />;
}
