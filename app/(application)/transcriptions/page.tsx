"use client";

/**
 * /transcriptions — "Drop audio, watch it cook, name the voices."
 *
 * Page-doc: design/pages/transcriptions.md. A calm three-group queue ordered
 * by what needs the user (Needs review → Processing → Saved); the composer is
 * an inline card (?new=1 deep-link convention); review lives in a side sheet
 * addressable as ?review=<jobId>.
 */
import { ExternalLink, FileAudio, Info, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { EmptyState } from "@/components/primitives/empty-state";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { Toolbar } from "@/components/primitives/toolbar";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Composer } from "./components/composer";
import { JobRow } from "./components/job-row";
import { ReviewSheet } from "./components/review-sheet";
import { useTranscriptionJobs } from "./hooks";
import { displayTitle, type Job } from "./types";

export default function TranscriptionsPage() {
  // useSearchParams needs a Suspense boundary for prerendering.
  return (
    <React.Suspense fallback={null}>
      <TranscriptionsPageInner />
    </React.Suspense>
  );
}

function TranscriptionsPageInner() {
  const t = useTranslations("transcriptions");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL-backed surfaces: ?new=1 opens the composer (palette create deep-link
  // convention, navigation.md §4); ?review=<jobId> opens the review sheet so
  // a review is linkable and survives refresh.
  const composerOpen = searchParams.get("new") === "1";
  const reviewId = searchParams.get("review");

  const openComposer = () =>
    router.push(`${pathname}?new=1`, { scroll: false });
  const closeComposer = () => router.replace(pathname, { scroll: false });
  const openReview = (jobId: string) =>
    router.push(`${pathname}?review=${jobId}`, { scroll: false });
  const closeReview = () => router.replace(pathname, { scroll: false });

  const [query, setQuery] = React.useState("");

  const {
    activeJobs,
    savedJobs,
    savedTotal,
    initialLoading,
    canLoadMoreSaved,
    loadMoreSaved,
    refetchAll,
  } = useTranscriptionJobs();

  const matches = React.useCallback(
    (job: Job) =>
      !query ||
      displayTitle(job).toLowerCase().includes(query.trim().toLowerCase()),
    [query],
  );

  const needsReview = activeJobs.filter(
    (job) => job.status === "awaiting_review" && matches(job),
  );
  const processing = activeJobs.filter(
    (job) =>
      (job.status === "queued" ||
        job.status === "transcribing" ||
        job.status === "failed") &&
      matches(job),
  );
  const hasFailed = processing.some((job) => job.status === "failed");
  const saved = savedJobs.filter(matches);

  const totalJobs = activeJobs.length + savedJobs.length;
  const searching = query.trim().length > 0;
  const showPageEmpty = totalJobs === 0 && !initialLoading;
  const noSearchResults =
    searching &&
    needsReview.length === 0 &&
    processing.length === 0 &&
    saved.length === 0;

  const newButtonDisabled = composerOpen;

  return (
    <PageShell variant="content" className="max-w-4xl">
      <MobileTopbarAction>
        <Button
          type="button"
          size="sm"
          onClick={openComposer}
          disabled={newButtonDisabled}
        >
          <Plus aria-hidden="true" className="mr-1 size-4" />
          {t("newShort")}
        </Button>
      </MobileTopbarAction>

      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <Button
            type="button"
            onClick={openComposer}
            disabled={newButtonDisabled}
          >
            <Plus aria-hidden="true" className="mr-2 size-4" />
            {t("new")}
          </Button>
        }
      />

      {totalJobs > 0 && (
        <Toolbar
          search={{
            value: query,
            onChange: setQuery,
            placeholder: t("searchPlaceholder"),
          }}
        />
      )}

      {composerOpen && (
        <Composer
          onCancel={closeComposer}
          onStarted={() => {
            closeComposer();
            refetchAll();
          }}
        />
      )}

      {initialLoading && totalJobs === 0 ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-28" />
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : showPageEmpty ? (
        <div className="space-y-2">
          <EmptyState
            icon={FileAudio}
            title={t("empty.title")}
            description={t("empty.description")}
            action={
              composerOpen
                ? undefined
                : { label: t("new"), onClick: openComposer }
            }
          />
          {/* Keeps the transcript library reachable even with zero jobs
              (inventory 1 — the link's home is the Saved group header). */}
          <div className="text-center">
            <Button
              asChild
              variant="link"
              size="sm"
              className="text-muted-foreground"
            >
              <Link href="/data/transcriptions">
                {t("queue.library")}
                <ExternalLink aria-hidden="true" className="ml-1 size-3" />
              </Link>
            </Button>
          </div>
        </div>
      ) : noSearchResults ? (
        <EmptyState variant="quiet" title={t("queue.noResults")} />
      ) : (
        <div className="space-y-8">
          {/* Needs review — the actionable group leads (page-doc §3). */}
          {needsReview.length > 0 && (
            <section className="space-y-2">
              <GroupHeader
                label={t("queue.needsReview")}
                count={needsReview.length}
              />
              <ul className="space-y-2">
                {needsReview.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    onReview={openReview}
                    onChanged={refetchAll}
                  />
                ))}
              </ul>
            </section>
          )}

          {/* Processing — honestly renamed when failures exist. */}
          {(processing.length > 0 || !searching) && (
            <section className="space-y-2">
              <GroupHeader
                label={
                  hasFailed
                    ? t("queue.processingAndFailed")
                    : t("queue.processing")
                }
                count={processing.length}
              />
              {processing.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {t("queue.nothingProcessing")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {processing.map((job) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      onReview={openReview}
                      onChanged={refetchAll}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Saved — header carries the library link + the re-open explainer. */}
          {(saved.length > 0 || !searching) && (
            <section className="space-y-2">
              <GroupHeader
                label={t("queue.saved")}
                count={searching ? saved.length : savedTotal}
              >
                {/* The re-open explainer (inventory 7). Tooltip on hover per
                    the ladder, PLUS a click/tap Popover so the datum is
                    reachable on touch and keyboard (responsive.md T7) — with
                    a ≥44px target below md (§2 touch targets). */}
                <Popover>
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label={t("queue.savedHintLabel")}
                            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-6"
                          >
                            <Info aria-hidden="true" className="size-3.5" />
                          </button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {t("queue.savedHint")}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <PopoverContent className="max-w-xs p-3 text-sm">
                    {t("queue.savedHint")}
                  </PopoverContent>
                </Popover>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-xs text-muted-foreground max-md:h-11"
                >
                  <Link href="/data/transcriptions">
                    {t("queue.library")}
                    <ExternalLink aria-hidden="true" className="ml-1 size-3" />
                  </Link>
                </Button>
              </GroupHeader>
              {saved.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {t("queue.noSaved")}
                </p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {saved.map((job) => (
                      <JobRow
                        key={job.id}
                        job={job}
                        onReview={openReview}
                        onChanged={refetchAll}
                      />
                    ))}
                  </ul>
                  {canLoadMoreSaved && !searching && (
                    <div className="pt-1 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground max-md:h-11"
                        onClick={loadMoreSaved}
                      >
                        {t("queue.loadMore")}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      )}

      {reviewId && (
        <ReviewSheet
          key={reviewId}
          jobId={reviewId}
          onClose={closeReview}
          onChanged={refetchAll}
        />
      )}
    </PageShell>
  );
}

/** Quiet group header: label + count, optional right-side extras. */
function GroupHeader({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
      <Badge variant="secondary">{count}</Badge>
      {children}
    </div>
  );
}
