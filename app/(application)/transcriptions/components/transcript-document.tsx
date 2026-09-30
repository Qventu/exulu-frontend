"use client";

/**
 * TranscriptDocument — the reading view (task-10 brief, Step 6 / design §4.3):
 * a saved transcript as a PAGE, not a sheet. Three columns share one scroll
 * region below a sticky (non-scrolling) header.
 *
 * - Header: title, Share (access popover), Export ▾ (Copy text only — Task 13
 *   fills the rest of the menu), "…" overflow (Correct text and speakers →
 *   `?edit=1`, Move to project, Open in library, Delete). Meta line + an
 *   access pill whose popover edits sharing directly.
 * - Left: chapters parsed from a post-processing output with a `## Chapters`
 *   heading — renders nothing when no output supplies one.
 * - Centre: the remaining post-processing outputs (citations linkified via
 *   `parseTimestampRefs` into seek buttons), then the transcript itself.
 * - Right: the video/audio player, then `<AskBox />`.
 *
 * `mode="edit"` is accepted and ignored until Task 12 wires `onSave` /
 * `onDiscard` / `canWrite` — the prop contract is declared now so it's
 * stable when that task lands.
 *
 * The transcript block-merge logic and `speakerColor` are COPIED from
 * `review-sheet.tsx` (controller ruling: review-sheet.tsx stays untouched
 * until a later task deletes it wholesale — duplication across the two
 * files is intentional, not an oversight).
 *
 * The access pill's popover does NOT import `ItemAccessSection` from
 * `data/[ctx]/components/` (the design doc says it should) — that would
 * cross the `transcriptions` → `data` feature boundary the tier-boundary
 * eslint rule forbids, the same rule an earlier task hit for
 * `items-action-bar.tsx`/`bulk-access-dialog.tsx`. Rather than reach across
 * or promote a file outside this task's declared scope, this renders the
 * same underlying primitive (`RBACControl`, already imported by
 * `review-sheet.tsx` in this very feature) directly, seeded from and saved
 * through this feature's own `transcriptions_itemsBulkUpdateRBAC` mutation
 * (`BULK_UPDATE_TRANSCRIPT_ITEMS_RBAC`, called with a single id) — see the
 * task-10 report for the full reasoning.
 */
import { useMutation } from "@apollo/client";
import {
  ChevronDown,
  ExternalLink,
  Folder,
  Globe,
  Loader2,
  Lock,
  Pencil,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { OverflowMenu, type OverflowMenuItem } from "@/components/primitives/overflow-menu";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { RelativeTime } from "@/components/primitives/relative-time";
import { RBACControl } from "@/components/rbac";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useProjectOptions } from "../hooks";
import { parseTimestampRefs } from "../linkify";
import {
  BULK_UPDATE_TRANSCRIPT_ITEMS_RBAC,
  REMOVE_SAVED_TRANSCRIPT_ITEM,
  UPDATE_TRANSCRIPT_ITEM,
} from "../queries";
import {
  formatClock,
  formatDuration,
  parsePostProcessingOutputs,
  parseSegments,
  parseSpeakers,
  speakerColor,
  type Job,
  type Mode,
  type PostProcessingOutput,
  type RbacRole,
  type RbacUser,
  type Segment,
  type TranscriptItemDetail,
} from "../types";
import { AskBox } from "./ask-box";
import { AudioTimeline, type AudioTimelineHandle } from "./audio-timeline";
import { MeetingVideoPlayer } from "./meeting-video-player";

export interface TranscriptDocumentProps {
  item: TranscriptItemDetail;
  mode: "read" | "edit";
  /** edit mode only; absent in read mode. Task 12 wires these. */
  onSave?: (draft: TranscriptDraft) => Promise<void>;
  onDiscard?: () => void;
  /** False when the viewer may read but not write — edit mode renders
   *  read-only with an explanation instead of a Save button. */
  canWrite?: boolean;
}

export type TranscriptDraft = {
  title: string;
  speakers: Record<string, string>;
  correctedSegments: Segment[] | null; // null = untouched, do not write
  projectId: string | null;
  rightsMode: Mode;
  rbacUsers: RbacUser[];
  rbacRoles: RbacRole[];
};

/* --------------------------- transcript blocks ---------------------------- */
/* Copied from review-sheet.tsx (controller ruling — see file JSDoc above). */

interface TranscriptBlock {
  label: string;
  rawSpeaker: string;
  start: number;
  end: number;
  text: string;
}

function buildTranscriptBlocks(
  segments: Segment[],
  speakers: Record<string, string>,
): TranscriptBlock[] {
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
}

/* ------------------------------- chapters --------------------------------- */

type Chapter = { seconds: number; title: string };

const CHAPTERS_HEADING = /^#{1,6}\s*chapters\s*$/im;
const NEXT_HEADING = /^#{1,6}\s+\S/m;

/** Everything from a `## Chapters` heading to the next heading (or the end). */
function chaptersSection(markdown: string): { start: number; end: number } | null {
  const match = markdown.match(CHAPTERS_HEADING);
  if (!match || match.index == null) return null;
  const start = match.index;
  const rest = markdown.slice(start + match[0].length);
  const next = rest.match(NEXT_HEADING);
  const end = next && next.index != null ? start + match[0].length + next.index : markdown.length;
  return { start, end };
}

/** The output's text with its `## Chapters` section (if any) removed. */
function stripChapters(markdown: string): string {
  const section = chaptersSection(markdown);
  if (!section) return markdown;
  return (markdown.slice(0, section.start) + markdown.slice(section.end)).trim();
}

/** `- [mm:ss] Title` lines inside a `## Chapters` section. */
function extractChapters(markdown: string): Chapter[] {
  const section = chaptersSection(markdown);
  if (!section) return [];
  const chapters: Chapter[] = [];
  for (const line of markdown.slice(section.start, section.end).split("\n")) {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (!bullet) continue;
    const parts = parseTimestampRefs(bullet[1]);
    const timePart = parts.find((part) => part.seconds !== null);
    if (!timePart) continue;
    const title = parts
      .filter((part) => part !== timePart)
      .map((part) => part.text)
      .join("")
      .trim();
    chapters.push({ seconds: timePart.seconds as number, title: title || timePart.text });
  }
  return chapters;
}

/** First output that supplies a `## Chapters` list; -1 when none does. */
function findChapters(outputs: PostProcessingOutput[]): {
  chapters: Chapter[];
  sourceIndex: number;
} {
  for (let index = 0; index < outputs.length; index++) {
    const output = outputs[index];
    if (output.status !== "done" || !output.output) continue;
    const chapters = extractChapters(output.output);
    if (chapters.length > 0) return { chapters, sourceIndex: index };
  }
  return { chapters: [], sourceIndex: -1 };
}

/** Renders `[mm:ss]` citations as seek buttons inline with the surrounding text. */
function LinkedText({
  text,
  onSeek,
}: {
  text: string;
  onSeek: (seconds: number) => void;
}) {
  const parts = parseTimestampRefs(text);
  return (
    <>
      {parts.map((part, index) =>
        part.seconds !== null ? (
          <button
            key={index}
            type="button"
            onClick={() => onSeek(part.seconds as number)}
            className="mx-0.5 inline-flex rounded border px-1 align-baseline font-mono text-xs text-primary hover:bg-muted"
          >
            {part.text}
          </button>
        ) : (
          <React.Fragment key={index}>{part.text}</React.Fragment>
        ),
      )}
    </>
  );
}

/* --------------------------------- access --------------------------------- */

const ALLOWED_MODES: Mode[] = ["private", "users", "roles", "public"];

/** A stable component (not a per-render variable) so switching icons never
 *  reads as "creating a component during render" (react-hooks/static-components). */
function ModeIcon({ mode, className }: { mode: Mode; className?: string }) {
  if (mode === "private") return <Lock aria-hidden="true" className={className} />;
  if (mode === "public") return <Globe aria-hidden="true" className={className} />;
  return <Users aria-hidden="true" className={className} />;
}

function AccessControl({
  item,
  open,
  onOpenChange,
}: {
  item: TranscriptItemDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const [displayMode, setDisplayMode] = React.useState<Mode>(item.rights_mode ?? "private");
  const [draftMode, setDraftMode] = React.useState<Mode>(displayMode);
  const [draftUsers, setDraftUsers] = React.useState<RbacUser[]>(item.RBAC?.users ?? []);
  const [draftRoles, setDraftRoles] = React.useState<RbacRole[]>(item.RBAC?.roles ?? []);
  const [updateAccess, { loading }] = useMutation(BULK_UPDATE_TRANSCRIPT_ITEMS_RBAC);

  // Fresh draft from the item's persisted state every time the popover opens.
  React.useEffect(() => {
    if (open) {
      setDraftMode(item.rights_mode ?? "private");
      setDraftUsers(item.RBAC?.users ?? []);
      setDraftRoles(item.RBAC?.roles ?? []);
    }
  }, [open, item]);

  const handleSave = async () => {
    try {
      await updateAccess({
        variables: {
          ids: [item.id],
          rights_mode: draftMode,
          rbac: { users: draftUsers, roles: draftRoles },
        },
      });
      setDisplayMode(draftMode);
      toast.success(t("document.accessSaved"));
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(t("document.accessSaveFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 max-md:h-11 items-center gap-1 rounded-full border px-2 text-xs text-muted-foreground hover:bg-muted"
        >
          <ModeIcon mode={displayMode} className="size-3" />
          {t(`mode.${displayMode}`)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <p className="text-sm font-medium">{t("document.accessTitle")}</p>
        <RBACControl
          allowedModes={ALLOWED_MODES}
          subjectLabel={t("sharing.subject")}
          initialRightsMode={item.rights_mode ?? "private"}
          initialUsers={item.RBAC?.users}
          initialRoles={item.RBAC?.roles}
          onChange={(nextMode, nextUsers, nextRoles) => {
            setDraftMode(nextMode);
            setDraftUsers(nextUsers);
            setDraftRoles(nextRoles);
          }}
        />
        <Button
          type="button"
          className="w-full"
          disabled={loading}
          aria-busy={loading}
          onClick={() => void handleSave()}
        >
          {loading ? (
            <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
          ) : null}
          {tCommon("save")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/* ---------------------------- move to project ------------------------------ */

function MoveToProjectDialog({
  item,
  open,
  onOpenChange,
  currentProjectId,
  onMoved,
}: {
  item: TranscriptItemDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProjectId: string | null;
  onMoved: (projectId: string | null) => void;
}) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const projects = useProjectOptions();
  const [projectId, setProjectId] = React.useState(currentProjectId ?? "");
  const [updateItem, { loading }] = useMutation(UPDATE_TRANSCRIPT_ITEM);

  React.useEffect(() => {
    if (open) setProjectId(currentProjectId ?? "");
  }, [open, currentProjectId]);

  const handleSave = async () => {
    try {
      await updateItem({
        variables: { id: item.id, input: { project_id: projectId || null } },
      });
      onMoved(projectId || null);
      toast.success(t("document.moveSaved"));
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(t("document.moveFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("document.moveToProject")}</DialogTitle>
          <DialogDescription>{t("document.moveToProjectDescription")}</DialogDescription>
        </DialogHeader>
        <Select
          value={projectId || "none"}
          onValueChange={(value) => setProjectId(value === "none" ? "" : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("composer.noProject")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("composer.noProject")}</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={loading} aria-busy={loading}>
            {loading ? <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" /> : null}
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- main ------------------------------------ */

export function TranscriptDocument({ item }: TranscriptDocumentProps) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const projects = useProjectOptions();

  const [accessOpen, setAccessOpen] = React.useState(false);
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [projectIdOverride, setProjectIdOverride] = React.useState<string | null | undefined>(
    undefined,
  );

  const [deleteItem] = useMutation(REMOVE_SAVED_TRANSCRIPT_ITEM);

  const segments = React.useMemo(() => parseSegments(item.raw_segments), [item.raw_segments]);
  const speakers = React.useMemo(() => parseSpeakers(item.speakers), [item.speakers]);
  const blocks = React.useMemo(
    () => buildTranscriptBlocks(segments, speakers),
    [segments, speakers],
  );

  const outputs = React.useMemo(
    () => parsePostProcessingOutputs(item.post_processing),
    [item.post_processing],
  );
  const { chapters, sourceIndex: chaptersSourceIndex } = React.useMemo(
    () => findChapters(outputs),
    [outputs],
  );
  const contentOutputs = React.useMemo(
    () => outputs.filter((output) => output.status === "failed" || !!output.output?.trim()),
    [outputs],
  );

  const audioTimelineRef = React.useRef<AudioTimelineHandle>(null);
  const mediaContainerRef = React.useRef<HTMLDivElement>(null);

  const hasVideo = Boolean(item.video_s3key || item.recall_recording_id);

  // MeetingVideoPlayer renders a plain <video> with no imperative seek API
  // (it is intentionally unchanged by this task — design §4.3). Reaching into
  // its rendered <video> element lets citations/chapters seek it without
  // touching that file; a no-op before the presigned URL resolves is a fine
  // degradation (the button just does nothing yet).
  const seekTo = React.useCallback(
    (seconds: number) => {
      // Mirrors the render branch below exactly: video wins when both a video
      // and an audio_s3key exist, so the seek target always matches what's
      // actually on screen.
      if (hasVideo) {
        const video = mediaContainerRef.current?.querySelector("video");
        if (video) {
          video.currentTime = seconds;
          void video.play();
        }
        return;
      }
      audioTimelineRef.current?.seek(seconds);
    },
    [hasVideo],
  );

  const title = item.name?.trim() || t("review.fallbackTitle");

  const effectiveProjectId =
    projectIdOverride !== undefined ? projectIdOverride : item.project_id;
  const projectName = effectiveProjectId
    ? (projects.find((project) => project.id === effectiveProjectId)?.name ?? null)
    : null;

  const sourceLabel =
    item.recording_source === "recall"
      ? t("row.meetingSource")
      : item.recording_source === "live"
        ? t("row.liveSource")
        : null;

  const metaSegments: React.ReactNode[] = [];
  if (sourceLabel) metaSegments.push(<span key="source">{sourceLabel}</span>);
  if (item.recorded_at) {
    metaSegments.push(<RelativeTime key="date" date={item.recorded_at} />);
  }
  if (item.duration_seconds != null) {
    metaSegments.push(<span key="duration">{formatDuration(item.duration_seconds)}</span>);
  }
  if (item.speaker_count != null) {
    metaSegments.push(
      <span key="speakers">{t("row.speakers", { count: item.speaker_count })}</span>,
    );
  }
  if (projectName) metaSegments.push(<span key="project">{projectName}</span>);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(item.transcript_text ?? "");
      toast.success(tCommon("copied"));
    } catch {
      toast.error(tCommon("copyFailed"));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteItem({ variables: { id: item.id } });
      toast.success(t("document.deleted"));
      router.push("/transcriptions");
    } catch (err: unknown) {
      toast.error(t("document.deleteFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err; // ConfirmDialog stays open
    }
  };

  const overflowItems: OverflowMenuItem[] = [
    {
      label: t("document.correctTextAndSpeakers"),
      icon: Pencil,
      onSelect: () => router.push(`${pathname}?edit=1`),
    },
    {
      label: t("document.moveToProject"),
      icon: Folder,
      onSelect: () => setMoveOpen(true),
    },
    {
      label: t("document.openInLibrary"),
      icon: ExternalLink,
      onSelect: () => router.push(`/data/transcriptions/${item.id}`),
    },
    {
      label: t("document.delete"),
      icon: Trash2,
      destructive: true,
      onSelect: () => setDeleteOpen(true),
    },
  ];

  return (
    <PageShell variant="full-bleed">
      <div className="shrink-0 border-b px-4 py-3 md:px-6">
        <PageHeader
          density="compact"
          breadcrumb={{ label: t("title"), href: "/transcriptions" }}
          title={title}
          meta={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {metaSegments.map((segment, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <span aria-hidden="true">·</span>}
                  {segment}
                </React.Fragment>
              ))}
              {metaSegments.length > 0 && <span aria-hidden="true">·</span>}
              <AccessControl item={item} open={accessOpen} onOpenChange={setAccessOpen} />
            </span>
          }
          action={
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="max-md:h-11"
                onClick={() => setAccessOpen(true)}
              >
                <Share2 aria-hidden="true" className="mr-2 size-4" />
                {t("document.share")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="max-md:h-11">
                    {t("document.export")}
                    <ChevronDown aria-hidden="true" className="ml-1 size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void handleCopyText()}>
                    {t("document.copyText")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <OverflowMenu items={overflowItems} label={t("overflow.label")} />
            </div>
          }
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-6xl gap-6 p-4 md:grid-cols-[200px_minmax(0,1fr)_300px] md:p-6">
          {/* Left: chapters — renders nothing without a supplying output. */}
          {chapters.length > 0 && (
            <nav aria-label={t("document.chaptersTitle")} className="space-y-1">
              <p className="text-sm font-medium">{t("document.chaptersTitle")}</p>
              <ul className="space-y-0.5">
                {chapters.map((chapter, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      onClick={() => seekTo(chapter.seconds)}
                      className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted max-md:h-11"
                    >
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {formatClock(chapter.seconds)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* Centre: summary/action-item outputs, then the transcript. */}
          <div className="min-w-0 space-y-6">
            {contentOutputs.length > 0 && (
              <section className="space-y-4">
                <p className="text-sm font-medium">{t("document.summaryHeading")}</p>
                {contentOutputs.map((output, index) => (
                  <div key={index} className="space-y-1">
                    {contentOutputs.length > 1 && output.prompt_name ? (
                      <p className="text-xs font-medium text-muted-foreground">
                        {output.prompt_name}
                      </p>
                    ) : null}
                    {output.status === "failed" ? (
                      <p className="text-sm text-destructive">
                        {t("review.resultFailed")}
                        {output.error ? ` — ${output.error}` : ""}
                      </p>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        <LinkedText
                          text={
                            index === chaptersSourceIndex
                              ? stripChapters(output.output ?? "")
                              : (output.output ?? "")
                          }
                          onSeek={seekTo}
                        />
                      </p>
                    )}
                  </div>
                ))}
              </section>
            )}

            <section className="space-y-2">
              <p className="text-sm font-medium">{t("review.transcript")}</p>
              {blocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("document.emptyTranscript")}</p>
              ) : (
                <div className="space-y-1">
                  {blocks.map((block, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => seekTo(block.start)}
                      className="w-full rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex items-center gap-2 text-xs">
                        <span
                          aria-hidden="true"
                          className="inline-block size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: speakerColor(block.rawSpeaker) }}
                        />
                        <span className="truncate font-medium text-foreground">{block.label}</span>
                        <span className="shrink-0 font-mono text-muted-foreground">
                          {formatClock(block.start)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-sm leading-relaxed">{block.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right: media, then the ask box. */}
          <div className="space-y-4">
            <div ref={mediaContainerRef} className="space-y-2">
              {hasVideo ? (
                <>
                  <MeetingVideoPlayer
                    job={
                      {
                        id: item.job_id ?? item.id,
                        video_s3key: item.video_s3key,
                        recall_recording_id: item.recall_recording_id,
                      } as unknown as Job
                    }
                  />
                  {item.recording_source === "recall" ? (
                    <p className="text-xs text-muted-foreground">
                      {t("document.recallRetentionNotice")}
                    </p>
                  ) : null}
                </>
              ) : item.audio_s3key ? (
                <AudioTimeline
                  ref={audioTimelineRef}
                  audioS3Key={item.audio_s3key}
                  segments={segments}
                  speakers={speakers}
                />
              ) : (
                <p className="text-xs text-muted-foreground">{t("review.noAudio")}</p>
              )}
            </div>

            <AskBox
              itemId={item.id}
              suggestions={[t("document.askSuggestion1"), t("document.askSuggestion2")]}
            />
          </div>
        </div>
      </div>

      <MoveToProjectDialog
        item={item}
        open={moveOpen}
        onOpenChange={setMoveOpen}
        currentProjectId={effectiveProjectId}
        onMoved={setProjectIdOverride}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("document.deleteConfirmTitle")}
        description={t("document.deleteConfirmDescription")}
        confirmLabel={t("document.delete")}
        onConfirm={handleDelete}
      />
    </PageShell>
  );
}
