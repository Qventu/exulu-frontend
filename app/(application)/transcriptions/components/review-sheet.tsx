"use client";

/**
 * The review surface (inventory items 41–54), graduated from the old inline
 * accordion into a focused side panel where the transcript itself is the hero:
 *
 * - `≥ md`: right-side Sheet (`sm:max-w-xl`) — page-doc §3 "Review (L2)";
 * - `< md`: full-screen bottom Sheet (document-like content, responsive.md T2);
 * - addressable as /transcriptions?review=<jobId> (owned by page.tsx);
 * - structure: editable title header → diarization notice → speakers strip →
 *   transcript blocks (the primary, keyboard/touch-accessible segment↔audio
 *   affordance) → "Details" collapsible (L3: project + sharing) — all in ONE
 *   scroll container (V2) — with a sticky audio footer (player + ribbon) and
 *   the Save/Discard actions;
 * - Discard confirms via the shared ConfirmDialog (replaces native confirm()).
 */
import { useMutation, useQuery } from "@apollo/client";
import { ChevronRight, ExternalLink, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { RBACControl } from "@/components/rbac";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { useProjectOptions } from "../hooks";
import {
  CANCEL_TRANSCRIPTION_JOB,
  FINALIZE_TRANSCRIPTION_JOB,
  GET_TRANSCRIPTION_JOB,
} from "../queries";
import {
  formatClock,
  formatDuration,
  parseSegments,
  parseSpeakers,
  speakerColor,
  type Job,
  type Mode,
  type RbacRole,
  type RbacUser,
  type Segment,
} from "../types";
import { AudioTimeline, type AudioTimelineHandle } from "./audio-timeline";

/** Teams excluded until the backend carries them (see composer.tsx). */
const ALLOWED_MODES: Mode[] = ["private", "users", "roles", "public"];

export interface ReviewSheetProps {
  jobId: string;
  onClose: () => void;
  onChanged: () => void;
}

type JobWithSegments = Job & { raw_segments: Segment[] | string };

export function ReviewSheet({ jobId, onClose, onChanged }: ReviewSheetProps) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();

  // Fetched once per sheet (keyed by jobId in page.tsx); the queue's poll
  // never touches this query, so form state can't be reset mid-review
  // (page-doc risk 3).
  const { data, loading, error, refetch } = useQuery<{
    transcription_jobById: JobWithSegments | null;
  }>(GET_TRANSCRIPTION_JOB, {
    variables: { id: jobId },
    fetchPolicy: "cache-and-network",
  });

  const job = data?.transcription_jobById ?? null;
  const reviewable =
    job && (job.status === "awaiting_review" || job.status === "saved");

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        aria-describedby={undefined}
        className={cn(
          "flex flex-col gap-0 p-0 [&>button]:hidden",
          isMobile
            ? "h-dvh max-h-dvh w-full rounded-none border-t pt-[env(safe-area-inset-top)]"
            : "h-full w-full sm:max-w-xl",
        )}
      >
        <SheetTitle className="sr-only">{t("review.title")}</SheetTitle>

        {!job && loading && <ReviewSkeleton onClose={onClose} />}

        {!loading && (error || !job) && (
          <div className="flex flex-1 flex-col">
            <SheetHeaderBar onClose={onClose} />
            <EmptyState
              variant="error"
              title={t("review.loadFailed")}
              description={error?.message}
              action={{
                label: tCommon("retry"),
                onClick: () => void refetch(),
              }}
              className="flex-1"
            />
          </div>
        )}

        {job && !reviewable && (
          <div className="flex flex-1 flex-col">
            <SheetHeaderBar onClose={onClose} />
            <EmptyState
              variant="quiet"
              title={t("review.notReady")}
              className="flex-1"
            />
          </div>
        )}

        {job && reviewable && (
          <ReviewForm job={job} onClose={onClose} onChanged={onChanged} />
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------- header / skeleton bits ------------------------ */

function SheetHeaderBar({ onClose }: { onClose: () => void }) {
  const tCommon = useTranslations("common");
  return (
    <div className="flex shrink-0 items-center justify-end border-b p-2">
      <SheetClose asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 md:size-10"
          aria-label={tCommon("close")}
          onClick={onClose}
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </SheetClose>
    </div>
  );
}

/** Loading state mirroring the real panel layout (inventory 41). */
function ReviewSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <SheetHeaderBar onClose={onClose} />
      <div className="flex-1 space-y-6 overflow-hidden p-6">
        <Skeleton className="h-8 w-2/3" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ))}
        </div>
      </div>
      <div className="shrink-0 space-y-3 border-t p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

/* --------------------------------- form ---------------------------------- */

interface TranscriptBlock {
  /** Resolved display label (live-renamed). */
  label: string;
  /** Raw speaker id of the block's first segment (stable color source). */
  rawSpeaker: string;
  start: number;
  end: number;
  text: string;
}

function ReviewForm({
  job,
  onClose,
  onChanged,
}: {
  job: JobWithSegments;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");

  const segments = React.useMemo(
    () => parseSegments(job.raw_segments),
    [job.raw_segments],
  );

  const distinctSpeakers = React.useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const segment of segments) {
      if (!seen.has(segment.speaker)) {
        seen.add(segment.speaker);
        ordered.push(segment.speaker);
      }
    }
    return ordered;
  }, [segments]);

  // Re-save mode: editing an already-saved transcript updates the existing
  // context item. After a first save the panel flips into re-save mode and
  // stays open (unchanged behavior).
  const [isReSave, setIsReSave] = React.useState(job.status === "saved");
  const [title, setTitle] = React.useState(job.title ?? "");
  const [projectId, setProjectId] = React.useState(job.project_id ?? "");
  const [rightsMode, setRightsMode] = React.useState<Mode>(
    job.target_rights_mode ?? "private",
  );
  const [rbacUsers, setRbacUsers] = React.useState<RbacUser[]>(
    job.target_rbac_users ?? [],
  );
  const [rbacRoles, setRbacRoles] = React.useState<RbacRole[]>(
    job.target_rbac_roles ?? [],
  );
  // Pre-populated from the persisted speaker map so re-edits start from the
  // previously-saved names (inventory 46).
  const [speakers, setSpeakers] = React.useState<Record<string, string>>(() =>
    parseSpeakers(job.speakers),
  );
  const [busy, setBusy] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [currentSecond, setCurrentSecond] = React.useState(-1);

  const projects = useProjectOptions();
  const [finalize] = useMutation(FINALIZE_TRANSCRIPTION_JOB);
  const [cancelJob] = useMutation(CANCEL_TRANSCRIPTION_JOB);

  const timelineRef = React.useRef<AudioTimelineHandle>(null);
  const blockRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // Merged speaker blocks (inventory 47): consecutive segments with the same
  // resolved label collapse into one readable block, re-rendered live as
  // names are typed.
  const blocks = React.useMemo<TranscriptBlock[]>(() => {
    const result: TranscriptBlock[] = [];
    for (const segment of segments) {
      const text = (segment.text ?? "").trim();
      if (!text) continue;
      const label = speakers[segment.speaker] || segment.speaker || "unknown";
      const last = result[result.length - 1];
      if (last && last.label === label) {
        last.text = `${last.text} ${text}`.trim();
        last.end = segment.end;
      } else {
        result.push({
          label,
          rawSpeaker: segment.speaker,
          start: segment.start,
          end: segment.end,
          text,
        });
      }
    }
    return result;
  }, [segments, speakers]);

  const activeIndex = React.useMemo(() => {
    if (currentSecond < 0) return -1;
    return blocks.findIndex(
      (block) => currentSecond >= block.start - 0.5 && currentSecond < block.end,
    );
  }, [blocks, currentSecond]);

  // Ribbon tap → seek AND scroll the transcript to the matching block
  // (page-doc mobile behavior: precision comes from the blocks).
  const scrollToTime = (time: number) => {
    let target = -1;
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].start <= time && time < blocks[i].end) {
        target = i;
        break;
      }
      if (blocks[i].start > time) {
        target = Math.max(0, i - 1);
        break;
      }
    }
    if (target === -1 && blocks.length > 0) target = blocks.length - 1;
    const el = blockRefs.current[target];
    if (!el) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    });
  };

  const diarizationDisabled =
    distinctSpeakers.length > 0 &&
    distinctSpeakers.every((speaker) => speaker === "unknown");

  const audioLengthLabel = job.duration_seconds
    ? formatDuration(job.duration_seconds)
    : null;

  const onSave = async () => {
    setBusy(true);
    try {
      const result = await finalize({
        variables: {
          id: job.id,
          input: {
            title: title || job.title || t("review.fallbackTitle"),
            speakers,
            project_id: projectId || null,
            target_rights_mode: rightsMode,
            target_rbac_users: rbacUsers,
            target_rbac_roles: rbacRoles,
          },
        },
      });
      const itemId =
        (result.data as { transcriptionJobFinalize?: { item_id?: string } })
          ?.transcriptionJobFinalize?.item_id ?? null;
      toast.success(isReSave ? t("toasts.updated") : t("toasts.saved"), {
        description: itemId ? (
          <Link
            href={`/data/transcriptions/${itemId}`}
            className="underline"
          >
            {t("toasts.viewInLibrary")}
          </Link>
        ) : undefined,
      });
      onChanged();
      if (isReSave) {
        onClose();
      } else {
        setIsReSave(true);
      }
    } catch (err: unknown) {
      toast.error(t("toasts.saveFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const onConfirmDiscard = async () => {
    try {
      await cancelJob({ variables: { id: job.id } });
      toast.success(t("toasts.cancelled"));
      onChanged();
      onClose();
    } catch (err: unknown) {
      toast.error(t("toasts.discardFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err; // ConfirmDialog stays open
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header: editable title styled as the heading (inventory 43). */}
      <div className="flex shrink-0 items-start gap-2 border-b p-4">
        <div className="min-w-0 flex-1 space-y-1">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label={t("composer.titleLabel")}
            placeholder={t("composer.titlePlaceholder")}
            className="h-9 border-transparent px-1 text-base font-semibold shadow-none hover:border-input focus-visible:border-input"
          />
          <p className="flex flex-wrap items-center gap-x-2 px-1 text-xs text-muted-foreground">
            <span>
              {isReSave ? t("row.saved") : t("row.awaitingReview")}
              {audioLengthLabel ? ` · ${audioLengthLabel}` : null}
            </span>
            {isReSave && job.saved_item_id && (
              <Link
                href={`/data/transcriptions/${job.saved_item_id}`}
                className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
              >
                {t("row.openInLibrary")}
                <ExternalLink aria-hidden="true" className="size-3" />
              </Link>
            )}
          </p>
        </div>
        <SheetClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 md:size-10"
            aria-label={tCommon("close")}
            onClick={onClose}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </SheetClose>
      </div>

      {/* ONE scroll container (V2): notice → speakers → transcript → details. */}
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-6">
        {diarizationDisabled && (
          <Alert variant="warning">
            <AlertDescription>
              {t("review.diarizationDisabled")}
            </AlertDescription>
          </Alert>
        )}

        {/* Speakers strip — naming speakers is the #1 review action, so it
            sits first (inventory 46). Compact horizontal-wrapping list
            (page-doc §3); below md it horizontally scrolls when >3 speakers
            so the transcript hero stays above the fold. */}
        {distinctSpeakers.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t("review.speakers")}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {t("review.speakersHint")}
              </span>
            </Label>
            <div
              className={cn(
                "flex gap-x-3 gap-y-2",
                distinctSpeakers.length > 3
                  ? "overflow-x-auto pb-1 scrollbar-subtle md:flex-wrap md:overflow-visible md:pb-0"
                  : "flex-wrap",
              )}
            >
              {distinctSpeakers.map((rawLabel) => (
                <div
                  key={rawLabel}
                  className={cn(
                    "flex items-center gap-1.5",
                    distinctSpeakers.length > 3 && "max-md:shrink-0",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: speakerColor(rawLabel) }}
                  />
                  <code className="max-w-24 shrink-0 truncate font-mono text-xs text-muted-foreground">
                    {rawLabel}
                  </code>
                  <Input
                    value={speakers[rawLabel] ?? ""}
                    onChange={(event) =>
                      setSpeakers({
                        ...speakers,
                        [rawLabel]: event.target.value,
                      })
                    }
                    placeholder={t("review.keepRawLabel")}
                    aria-label={rawLabel}
                    className="h-11 w-36 text-base md:h-9 md:text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* The hero: readable, tappable transcript blocks (inventory 47/52/54).
            Real <button>s — keyboard- and touch-accessible by construction. */}
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("review.transcript")}</p>
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("review.emptyTranscript")}
            </p>
          ) : (
            <div className="space-y-1">
              {blocks.map((block, index) => (
                <button
                  key={index}
                  type="button"
                  ref={(el) => {
                    blockRefs.current[index] = el;
                  }}
                  onClick={() => timelineRef.current?.seek(block.start)}
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left transition-colors duration-150",
                    "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    index === activeIndex && "bg-muted",
                  )}
                >
                  <span className="flex items-center gap-2 text-xs">
                    <span
                      aria-hidden="true"
                      className="inline-block size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: speakerColor(block.rawSpeaker) }}
                    />
                    <span className="truncate font-medium text-foreground">
                      {block.label}
                    </span>
                    <span className="shrink-0 font-mono text-muted-foreground">
                      {formatClock(block.start)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-sm leading-relaxed">
                    {block.text}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* L3: project re-assignment + sharing (inventory 44/45). */}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger className="group flex min-h-9 w-full items-center gap-2 rounded-md text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <ChevronRight
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90 motion-reduce:transition-none"
            />
            <span>{tCommon("details")}</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>{t("composer.project")}</Label>
                <Select
                  value={projectId || "none"}
                  onValueChange={(value) =>
                    setProjectId(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("composer.noProject")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("composer.noProject")}
                    </SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("composer.sharing")}</Label>
                <RBACControl
                  allowedModes={ALLOWED_MODES}
                  subjectLabel={t("sharing.subject")}
                  initialRightsMode={rightsMode}
                  initialUsers={rbacUsers}
                  initialRoles={rbacRoles}
                  modalMode
                  // Teams arg deliberately not consumed (see composer.tsx).
                  onChange={(mode, users, roles) => {
                    setRightsMode(mode);
                    setRbacUsers(users);
                    setRbacRoles(roles);
                  }}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Sticky audio footer: player + ribbon + actions (inventory 48–54). */}
      <div className="shrink-0 space-y-3 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <AudioTimeline
          ref={timelineRef}
          audioS3Key={job.audio_s3key}
          segments={segments}
          speakers={speakers}
          onTime={setCurrentSecond}
          onSeek={scrollToTime}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            className="max-md:h-11"
            onClick={() => {
              if (isReSave) {
                // Never deletes the saved context item (inventory 49).
                onClose();
              } else {
                setDiscardOpen(true);
              }
            }}
          >
            {isReSave ? tCommon("close") : t("review.discard")}
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={busy}
            aria-busy={busy}
            className="max-md:h-11"
          >
            {busy ? (
              <Loader2
                aria-hidden="true"
                className="mr-2 size-4 animate-spin"
              />
            ) : null}
            {isReSave ? t("review.saveChanges") : tCommon("save")}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={t("confirmDiscard.title")}
        description={t("confirmDiscard.description")}
        confirmLabel={t("confirmDiscard.confirm")}
        onConfirm={onConfirmDiscard}
      />
    </div>
  );
}
