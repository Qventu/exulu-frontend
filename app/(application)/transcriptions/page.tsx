"use client";

/**
 * /transcriptions — "One list, state as an attribute."
 *
 * Redesign (2026-09-29 spec §4.1): the three status groups (Needs review /
 * Processing / Saved) become one list across in-progress jobs and saved
 * transcripts, with tabs, a collapsed in-progress strip, and bulk actions
 * over item rows. The composer is `NewTranscriptDialog` (spec §4.2, Task 9),
 * opened via the `?new=1` deep-link convention and pinned open by an active
 * recording regardless of the URL.
 */
import { useMutation } from "@apollo/client";
import { FileAudio, MoreHorizontal, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";
import { BulkAccessDialog } from "@/components/widgets/bulk-access-dialog";
import { ItemsActionBar } from "@/components/widgets/items-action-bar";
import { useLiveRecordingOptional } from "@/components/live-recording/live-recording-provider";
import { EmptyState } from "@/components/primitives/empty-state";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { Toolbar } from "@/components/primitives/toolbar";
import { ConfigContext } from "@/components/shell/config-context";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { InProgressStrip } from "./components/in-progress-strip";
import { NewTranscriptDialog } from "./components/new-transcript-dialog";
import { RecordingUsageCard } from "./components/recording-usage-card";
import { TranscriptListRow } from "./components/transcript-row";
import {
  useRecordingUsage,
  useTranscripts,
  useProjectOptions,
} from "./hooks";
import {
  BULK_UPDATE_TRANSCRIPT_ITEMS_RBAC,
  REMOVE_SAVED_TRANSCRIPT_ITEM,
  UPDATE_TRANSCRIPT_ITEM,
} from "./queries";
import {
  filterTranscriptRows,
  groupTranscriptRows,
  type JobSource,
  type TranscriptRow,
  type TranscriptTab,
} from "./types";

type SourceFilter = "all" | JobSource;
type DateFilter = "all" | "today" | "week" | "month";
const DAY_MS = 24 * 60 * 60 * 1000;

function matchesSource(row: TranscriptRow, filter: SourceFilter): boolean {
  if (filter === "all") return true;
  return row.source === filter;
}

function matchesProject(row: TranscriptRow, filter: string): boolean {
  if (filter === "all") return true;
  return row.projectId === filter;
}

function matchesDate(row: TranscriptRow, filter: DateFilter): boolean {
  if (filter === "all") return true;
  const recorded = new Date(row.recordedAt);
  if (Number.isNaN(recorded.getTime())) return true;
  if (filter === "today") {
    const now = new Date();
    return (
      recorded.getFullYear() === now.getFullYear() &&
      recorded.getMonth() === now.getMonth() &&
      recorded.getDate() === now.getDate()
    );
  }
  const elapsed = Date.now() - recorded.getTime();
  if (filter === "week") return elapsed <= 7 * DAY_MS;
  if (filter === "month") return elapsed <= 30 * DAY_MS;
  return true;
}

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
  const { user } = React.useContext(UserContext);

  // URL-backed surface: ?new=1 opens the composer (palette create deep-link
  // convention, navigation.md §4).
  const composerOpen = searchParams.get("new") === "1";
  const openComposer = () =>
    router.push(`${pathname}?new=1`, { scroll: false });
  const closeComposer = () => router.replace(pathname, { scroll: false });
  // Stable identities: NewTranscriptDialog feeds these into the composers'
  // `onStart` callbacks, and an inline arrow here churns their identity on
  // every render — which is what drove the composer's report-up effect into
  // an update loop.
  const handleComposerOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) router.replace(pathname, { scroll: false });
    },
    [router, pathname],
  );

  // The review sheet became a page (spec §1.2); keep old links working.
  const legacyReviewId = searchParams.get("review");
  React.useEffect(() => {
    if (legacyReviewId) router.replace(`/transcriptions/review/${legacyReviewId}`);
  }, [legacyReviewId, router]);

  const [query, setQuery] = React.useState("");
  const [tab, setTab] = React.useState<TranscriptTab>("all");
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>("all");
  const [projectFilter, setProjectFilter] = React.useState<string>("all");
  const [dateFilter, setDateFilter] = React.useState<DateFilter>("all");
  const [selection, setSelection] = React.useState<Set<string>>(new Set());
  const [accessDialogOpen, setAccessDialogOpen] = React.useState(false);

  // Three independent flows, each gated by its own backend flag (spec §4.1):
  // upload (Whisper server), meeting bot (Recall), record here (composer STT).
  // NewTranscriptDialog reads the flags itself; recallEnabled stays here only
  // for the usage query below, and live only for the recording pin.
  const config = React.useContext(ConfigContext);
  const live = useLiveRecordingOptional();
  const recallEnabled = !!config?.recall?.enabled;
  // An active recording always wins: reopen its surface wherever the user
  // navigated from, whether or not ?new=1 is on the URL. activeJobId, not
  // jobId: the close-out (upload + liveRecordingStop) runs after the recorder
  // has let the job go, and unmounting the composer mid-upload loses the audio.
  const recordingActive = !!live?.activeJobId;
  const composerVisible = composerOpen || recordingActive;
  const newButtonDisabled = composerVisible;

  // Monthly recording usage (only queried when Recall is enabled).
  const { usage, refetch: refetchUsage } = useRecordingUsage(!recallEnabled);

  const {
    rows,
    recoveredJobs,
    needsReviewCount,
    initialLoading,
    jobsError,
    itemsError,
    canLoadMore,
    loadMore,
    refetchAll,
  } = useTranscripts(query);

  const handleComposerStarted = React.useCallback(() => {
    refetchAll();
    refetchUsage();
  }, [refetchAll, refetchUsage]);

  const projects = useProjectOptions();

  const [updateItem, updateItemResult] = useMutation(UPDATE_TRANSCRIPT_ITEM);
  const [deleteItem, deleteItemResult] = useMutation(
    REMOVE_SAVED_TRANSCRIPT_ITEM,
  );

  // Wipe selection when the visible set fundamentally changes.
  React.useEffect(() => {
    setSelection(new Set());
  }, [tab, query, sourceFilter, projectFilter, dateFilter]);

  // In-progress strip: running/failed job rows, never part of the tab-driven
  // list below (spec §4.1 table — they come from the jobs source only).
  const runningRows = rows.filter(
    (row) =>
      row.state === "recording" ||
      row.state === "queued" ||
      row.state === "transcribing",
  );
  const failedRows = rows.filter((row) => row.state === "failed");

  const tabRows = filterTranscriptRows(rows, tab, user.id);
  const mainRows = tabRows.filter(
    (row) => row.state === "needs_review" || row.state === "ready",
  );
  const filteredMainRows = mainRows.filter(
    (row) =>
      matchesSource(row, sourceFilter) &&
      matchesProject(row, projectFilter) &&
      matchesDate(row, dateFilter),
  );
  const { thisWeek, earlier } = groupTranscriptRows(
    filteredMainRows,
    new Date(),
  );

  const activeFilterCount =
    (sourceFilter !== "all" ? 1 : 0) +
    (projectFilter !== "all" ? 1 : 0) +
    (dateFilter !== "all" ? 1 : 0);
  const clearFilters = () => {
    setSourceFilter("all");
    setProjectFilter("all");
    setDateFilter("all");
  };

  const totalRows = rows.length;
  const searching = query.trim().length > 0;
  const showPageEmpty = !searching && totalRows === 0 && !initialLoading;
  const noVisibleContent =
    !initialLoading &&
    !showPageEmpty &&
    filteredMainRows.length === 0 &&
    runningRows.length === 0 &&
    failedRows.length === 0;

  const selectedIds = React.useMemo(() => Array.from(selection), [selection]);

  const handleBulkArchive = async () => {
    await Promise.all(
      selectedIds.map((id) =>
        updateItem({ variables: { id, input: { archived: true } } }),
      ),
    );
    setSelection(new Set());
    refetchAll();
  };
  const handleBulkDelete = async () => {
    await Promise.all(
      selectedIds.map((id) => deleteItem({ variables: { id } })),
    );
    setSelection(new Set());
    refetchAll();
  };

  const filterControls = (
    <>
      <span className="sr-only">{t("filter.label")}</span>
      <Select
        value={sourceFilter}
        onValueChange={(value) => setSourceFilter(value as SourceFilter)}
      >
        <SelectTrigger className="w-[160px] min-w-0 shrink">
          <SelectValue placeholder={t("filter.source")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filter.allSources")}</SelectItem>
          <SelectItem value="whisper">{t("composer.modeAudio")}</SelectItem>
          <SelectItem value="recall">{t("composer.modeMeeting")}</SelectItem>
          <SelectItem value="live">{t("composer.modeRecord")}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={projectFilter} onValueChange={setProjectFilter}>
        <SelectTrigger className="w-[160px] min-w-0 shrink">
          <SelectValue placeholder={t("filter.project")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filter.allProjects")}</SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={dateFilter}
        onValueChange={(value) => setDateFilter(value as DateFilter)}
      >
        <SelectTrigger className="w-[160px] min-w-0 shrink">
          <SelectValue placeholder={t("filter.date")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filter.anyTime")}</SelectItem>
          <SelectItem value="today">{t("filter.today")}</SelectItem>
          <SelectItem value="week">{t("filter.thisWeek")}</SelectItem>
          <SelectItem value="month">{t("filter.thisMonth")}</SelectItem>
        </SelectContent>
      </Select>
      {activeFilterCount > 0 && (
        <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
          {t("filter.clear")}
        </Button>
      )}
    </>
  );

  return (
    <PageShell variant="content" data-demo-id="transcriptions">
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
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("overflow.label")}
                  className="size-9 shrink-0 max-md:size-11"
                >
                  <MoreHorizontal aria-hidden="true" className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/data/transcriptions">{t("queue.library")}</Link>
                </DropdownMenuItem>
                {/* The "…" menu itself is visible to every user (settings
                    design doc §6) — only this item is super-admin-only. The
                    settings page still renders its own "ask an admin" state
                    rather than a 404 for anyone who reaches it another way
                    (a stale link, a lost admin right). */}
                {user?.super_admin && (
                  <DropdownMenuItem asChild>
                    <Link href="/transcriptions/settings">{t("overflow.settings")}</Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              onClick={openComposer}
              disabled={newButtonDisabled}
            >
              <Plus aria-hidden="true" className="mr-2 size-4" />
              {t("new")}
            </Button>
          </>
        }
      />

      {/* Monthly recording budget — shown only when a cap is configured
          (RecordingUsageCard's own check); reused by the settings page's
          right column (final fix wave, Fix 4a) so there is exactly one place
          this renders. */}
      <RecordingUsageCard usage={usage} />

      <NewTranscriptDialog
        open={composerVisible}
        onOpenChange={handleComposerOpenChange}
        onStarted={handleComposerStarted}
      />

      {/* Union list partial failure (spec §6): one failed half never blanks
          the page — the other half still renders below. */}
      {jobsError && (
        <Alert variant="destructive">
          <AlertTitle>{t("errors.inProgressFailed")}</AlertTitle>
          <AlertDescription>{jobsError.message}</AlertDescription>
        </Alert>
      )}
      {itemsError && (
        <Alert variant="destructive">
          <AlertTitle>{t("errors.transcriptsFailed")}</AlertTitle>
          <AlertDescription>{itemsError.message}</AlertDescription>
        </Alert>
      )}

      {initialLoading && totalRows === 0 ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-64" />
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : showPageEmpty ? (
        <EmptyState
          icon={FileAudio}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            composerOpen ? undefined : { label: t("new"), onClick: openComposer }
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <Tabs value={tab} onValueChange={(value) => setTab(value as TranscriptTab)}>
              <TabsList>
                <TabsTrigger value="all">{t("tabs.all")}</TabsTrigger>
                <TabsTrigger value="needs_review" className="gap-1.5">
                  {t("tabs.needsReview")}
                  {needsReviewCount > 0 && (
                    <Badge variant="warning">{needsReviewCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="mine">{t("tabs.mine")}</TabsTrigger>
                <TabsTrigger value="shared">{t("tabs.shared")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="md:flex-1">
              <Toolbar
                search={{
                  value: query,
                  onChange: setQuery,
                  placeholder: t("searchPlaceholder"),
                }}
                filters={filterControls}
                activeFilterCount={activeFilterCount}
                onResetFilters={activeFilterCount > 0 ? clearFilters : undefined}
                selection={
                  selection.size > 0 ? (
                    <ItemsActionBar
                      archived={false}
                      count={selection.size}
                      pending={updateItemResult.loading || deleteItemResult.loading}
                      onArchive={handleBulkArchive}
                      onUnarchive={() => {}}
                      onDelete={handleBulkDelete}
                      onSetAccess={() => setAccessDialogOpen(true)}
                      onClear={() => setSelection(new Set())}
                    />
                  ) : undefined
                }
              />
            </div>
          </div>

          <InProgressStrip
            running={runningRows}
            failed={failedRows}
            recoveredJobs={recoveredJobs}
            onChanged={refetchAll}
          />

          {noVisibleContent ? (
            <EmptyState
              variant="quiet"
              title={
                searching || activeFilterCount > 0
                  ? t("queue.noResults")
                  : t("queue.nothingHere")
              }
            />
          ) : (
            <div className="space-y-6">
              {thisWeek.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {t("groups.thisWeek")}
                  </h2>
                  <ul className="space-y-2">
                    {thisWeek.map((row) => (
                      <TranscriptListRow
                        key={row.id}
                        row={row}
                        currentUserId={user.id}
                        anySelected={selection.size > 0}
                        selected={selection.has(row.id)}
                        onSelectedChange={
                          row.kind === "item"
                            ? (value) =>
                                setSelection((current) => {
                                  const next = new Set(current);
                                  if (value) next.add(row.id);
                                  else next.delete(row.id);
                                  return next;
                                })
                            : undefined
                        }
                      />
                    ))}
                  </ul>
                </section>
              )}

              {earlier.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {t("groups.earlier")}
                  </h2>
                  <ul className="space-y-2">
                    {earlier.map((row) => (
                      <TranscriptListRow
                        key={row.id}
                        row={row}
                        currentUserId={user.id}
                        anySelected={selection.size > 0}
                        selected={selection.has(row.id)}
                        onSelectedChange={
                          row.kind === "item"
                            ? (value) =>
                                setSelection((current) => {
                                  const next = new Set(current);
                                  if (value) next.add(row.id);
                                  else next.delete(row.id);
                                  return next;
                                })
                            : undefined
                        }
                      />
                    ))}
                  </ul>
                </section>
              )}

              {canLoadMore && (
                <div className="pt-1 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground max-md:h-11"
                    onClick={loadMore}
                  >
                    {t("queue.loadMore")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <BulkAccessDialog
        open={accessDialogOpen}
        onOpenChange={setAccessDialogOpen}
        mutation={BULK_UPDATE_TRANSCRIPT_ITEMS_RBAC}
        ids={selectedIds}
        onApplied={() => {
          setSelection(new Set());
          refetchAll();
        }}
      />
    </PageShell>
  );
}
