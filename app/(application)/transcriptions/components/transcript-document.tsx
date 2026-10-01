"use client";

/**
 * TranscriptDocument — the reading view, and (task-12 brief) the SAME page in
 * edit mode: review graduated from a side sheet (`review-sheet.tsx`, deleted
 * by task-12) to a full page that is this component with `mode="edit"`.
 * Three columns share one scroll region below a sticky (non-scrolling)
 * header; edit mode adds a pinned (non-scrolling) footer.
 *
 * Read mode (task-10 brief, Step 6 / design §4.3):
 * - Header: title, Share (access popover), Export ▾ (`<ExportMenu />` — Copy
 *   text plus five downloads, task-13 brief), "…" overflow (Correct text and
 *   speakers → `?edit=1`, Move to project, Open in library, Delete). Meta
 *   line + an access pill whose popover edits sharing directly.
 * - Left: chapters parsed from a post-processing output with a `## Chapters`
 *   heading — renders nothing when no output supplies one.
 * - Centre: the remaining post-processing outputs (citations linkified via
 *   `parseTimestampRefs` into seek buttons), then the transcript itself.
 * - Right: the video/audio player, then `<AskBox />`.
 *
 * Edit mode (task-12 brief, Steps 5-8):
 * - Header action area swaps Share/Export/Overflow for `<ReviewChecklist />`
 *   (a pure report — nothing on it disables Save); the title becomes a live
 *   preview of the draft title typed in the centre column.
 * - Centre: find-and-replace (hidden behind a button) above the transcript;
 *   each block becomes editable on click — a textarea sized to its content,
 *   blur commits to local segment state, Escape reverts that block — and the
 *   speaker label gains a "Name speaker" link when the label is still raw.
 *   Only `text` ever changes on a segment; `start`/`end`/`speaker` are
 *   preserved so timestamps and the audio ribbon survive a correction. Below
 *   the transcript, a "Details" section holds project + sharing as local
 *   draft state (applied only on Save, unlike read mode's immediate-apply
 *   popovers).
 * - Right: `<SpeakersPanel />` replaces the video/ask panel.
 * - A pinned footer holds the audio/video player and Save / Discard.
 * - `canWrite === false` while `mode === "edit"` renders the READ-mode UI
 *   (unchanged) plus an inline `Alert` explaining why, and never a Save
 *   button — a transcript can be shared read-only, and a viewer who can read
 *   it but not correct it must never see a Save button guaranteed to fail
 *   (write access is derived by the caller via `canWriteTranscriptItem` in
 *   types.ts, the client-side mirror of the backend's `validateWriteAccess`).
 *
 * The access pill's popover does NOT import `ItemAccessSection` from
 * `data/[ctx]/components/` (the design doc says it should) — that would
 * cross the `transcriptions` → `data` feature boundary the tier-boundary
 * eslint rule forbids, the same rule an earlier task hit for
 * `items-action-bar.tsx`/`bulk-access-dialog.tsx`. Rather than reach across
 * or promote a file outside this task's declared scope, this renders the
 * same underlying primitive (`RBACControl`) directly, seeded from and saved
 * through this feature's own mutations — see the task-10 report for the full
 * reasoning. Edit mode's own Details section uses the same primitive the
 * same way, as local draft state instead of an immediate-apply popover.
 *
 * The transcript block-merge logic and `speakerColor` used to also live in
 * `review-sheet.tsx` (deleted by task-12); this file is now the sole
 * implementation in the feature.
 */
import { useMutation, useQuery } from "@apollo/client";
import {
  ChevronRight,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GET_USER_BY_ID } from "@/queries/queries";

import { useProjectOptions } from "../hooks";
import { parseTimestampRefs } from "../linkify";
import {
  BULK_UPDATE_TRANSCRIPT_ITEMS_RBAC,
  REMOVE_SAVED_TRANSCRIPT_ITEM,
  UPDATE_TRANSCRIPT_ITEM,
} from "../queries";
import {
  effectiveSegments,
  formatClock,
  formatDuration,
  isSharingConfigured,
  parsePostProcessingOutputs,
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
import { ExportMenu } from "./export-menu";
import { MeetingVideoPlayer } from "./meeting-video-player";
import { cn } from "@/lib/utils";
import { SpeakersPanel } from "./speakers-panel";
import { SummaryMarkdown } from "./summary-markdown";
import { FindReplace } from "./find-replace";
import { ReviewChecklist } from "./review-checklist";

export interface TranscriptDocumentProps {
  item: TranscriptItemDetail;
  mode: "read" | "edit";
  /** edit mode only; absent in read mode. Task 12 wires these. */
  onSave?: (draft: TranscriptDraft) => Promise<void>;
  onDiscard?: () => void;
  /** False when the viewer may read but not write — edit mode renders
   *  read-only with an explanation instead of a Save button. */
  canWrite?: boolean;
  /** Rendered at the top of the centre column, above the title and summary.
   *  The review page puts its post-processing banner here so it lines up with
   *  the document rather than sitting in a full-width bar above the grid. */
  banner?: React.ReactNode;
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

interface TranscriptBlock {
  label: string;
  rawSpeaker: string;
  start: number;
  end: number;
  text: string;
  /** Indices into the `segments` array this block spans, in order. Editing a
   *  block writes the whole edited text onto the FIRST index and blanks the
   *  rest — start/end/speaker on every segment stay untouched. */
  segmentIndices: number[];
}

function buildTranscriptBlocks(
  segments: Segment[],
  speakers: Record<string, string>,
): TranscriptBlock[] {
  const result: TranscriptBlock[] = [];
  segments.forEach((segment, index) => {
    const text = (segment.text ?? "").trim();
    if (!text) return;
    const label = speakers[segment.speaker] || segment.speaker || "unknown";
    const last = result[result.length - 1];
    if (last && last.label === label) {
      last.text = `${last.text} ${text}`.trim();
      last.end = segment.end;
      last.segmentIndices.push(index);
    } else {
      result.push({
        label,
        rawSpeaker: segment.speaker,
        start: segment.start,
        end: segment.end,
        text,
        segmentIndices: [index],
      });
    }
  });
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

/* ------------------------------ read-only notice --------------------------- */

/** Resolves the owner's display name for the read-only explanation (Step 8).
 *  Best-effort: the alert still reads fine without a name if this fails. */
function useOwnerLabel(createdBy: number | null, enabled: boolean): string | null {
  const { data } = useQuery<{
    userById: { name: string | null; email: string | null } | null;
  }>(GET_USER_BY_ID, {
    variables: { id: String(createdBy) },
    skip: !enabled || createdBy == null,
  });
  return data?.userById?.name || data?.userById?.email || null;
}

/* ------------------------------- edit draft --------------------------------- */

interface EditDraftState {
  title: string;
  speakers: Record<string, string>;
  segments: Segment[];
  /** True once a correction (inline edit or replace-all) has been made —
   *  drives `TranscriptDraft.correctedSegments`'s null-means-untouched rule. */
  segmentsDirty: boolean;
  projectId: string;
  rightsMode: Mode;
  rbacUsers: RbacUser[];
  rbacRoles: RbacRole[];
  /** Segment indices touched by the most recent replace-all, cleared as each
   *  is re-edited or once the draft is saved — "renders in the success token
   *  until save" (brief, find-replace.tsx). */
  justReplaced: Set<number>;
}

function buildEditDraftState(item: TranscriptItemDetail): EditDraftState {
  return {
    title: item.name ?? "",
    speakers: parseSpeakers(item.speakers),
    segments: effectiveSegments(item.raw_segments, item.corrected_segments),
    segmentsDirty: false,
    projectId: item.project_id ?? "",
    rightsMode: item.rights_mode ?? "private",
    rbacUsers: item.RBAC?.users ?? [],
    rbacRoles: item.RBAC?.roles ?? [],
    justReplaced: new Set(),
  };
}

/* --------------------------------- main ------------------------------------ */

export function TranscriptDocument({
  item,
  mode,
  onSave,
  onDiscard,
  canWrite,
  banner,
}: TranscriptDocumentProps) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const projects = useProjectOptions();

  const requestedEdit = mode === "edit";
  const isEditable = requestedEdit && canWrite !== false;
  const readOnlyDenied = requestedEdit && !isEditable;
  const ownerLabel = useOwnerLabel(item.created_by, readOnlyDenied);

  const [accessOpen, setAccessOpen] = React.useState(false);
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [projectIdOverride, setProjectIdOverride] = React.useState<string | null | undefined>(
    undefined,
  );

  const [deleteItem] = useMutation(REMOVE_SAVED_TRANSCRIPT_ITEM);

  // ---- edit draft --------------------------------------------------------

  const [editState, setEditState] = React.useState<EditDraftState>(() =>
    buildEditDraftState(item),
  );
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editingSegmentStart, setEditingSegmentStart] = React.useState<number | null>(null);
  const [editingText, setEditingText] = React.useState("");
  const cancelledEditRef = React.useRef(false);

  // Re-seed the draft only on the read → edit transition, never while an edit
  // session is already open — a background refetch (the conflict guard's
  // focus refetch) must not silently overwrite in-progress corrections.
  const prevModeRef = React.useRef(mode);
  React.useEffect(() => {
    if (mode === "edit" && prevModeRef.current !== "edit") {
      setEditState(buildEditDraftState(item));
      setEditingSegmentStart(null);
    }
    prevModeRef.current = mode;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const baseSegments = React.useMemo(
    () => effectiveSegments(item.raw_segments, item.corrected_segments),
    [item.raw_segments, item.corrected_segments],
  );
  const segments = isEditable ? editState.segments : baseSegments;
  const speakers = isEditable ? editState.speakers : parseSpeakers(item.speakers);
  const blocks = React.useMemo(
    () => buildTranscriptBlocks(segments, speakers),
    [segments, speakers],
  );

  const rawSpeakers = React.useMemo(() => {
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

  const talkShare = React.useMemo(() => {
    const totals: Record<string, number> = {};
    let grandTotal = 0;
    for (const segment of segments) {
      const duration = Math.max(0, segment.end - segment.start);
      totals[segment.speaker] = (totals[segment.speaker] ?? 0) + duration;
      grandTotal += duration;
    }
    if (grandTotal <= 0) return {};
    const shares: Record<string, number> = {};
    for (const [speaker, duration] of Object.entries(totals)) {
      shares[speaker] = duration / grandTotal;
    }
    return shares;
  }, [segments]);

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
  const hasSummary = outputs.some(
    (output) => output.status === "done" && !!output.output?.trim(),
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

  // "Hear" (SpeakersPanel): seek to the speaker's first block and stop after
  // ~4s. Reuses `seekTo` for both the audio ribbon and the meeting video, so
  // it degrades the same way seekTo already does before media is ready. The
  // pending timeout is tracked so a second "Hear" (or unmount) can clear a
  // still-pending one — otherwise a stale timer fires later and pauses
  // whatever the user is manually playing by then (fix-round-1, non-gating #1).
  const hearTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (hearTimeoutRef.current != null) clearTimeout(hearTimeoutRef.current);
    },
    [],
  );
  const handleHear = React.useCallback(
    (rawSpeaker: string) => {
      const firstBlock = blocks.find((block) => block.rawSpeaker === rawSpeaker);
      if (!firstBlock) return;
      if (hearTimeoutRef.current != null) clearTimeout(hearTimeoutRef.current);
      seekTo(firstBlock.start);
      hearTimeoutRef.current = setTimeout(() => {
        mediaContainerRef.current?.querySelector<HTMLMediaElement>("audio, video")?.pause();
        hearTimeoutRef.current = null;
      }, 4000);
    },
    [blocks, seekTo],
  );

  // "Name speaker" (transcript block, still-raw label): scroll the speakers
  // panel's row into view and open it. SpeakersPanel's "one row open at a
  // time" state is internal (its prop contract is fixed — no imperative
  // open control), so this drives it the same way a person would: find the
  // row, open it only if it isn't already open, then focus its input.
  const focusSpeaker = React.useCallback((rawSpeaker: string) => {
    const row = document.getElementById(`speaker-panel-${rawSpeaker}`);
    if (!row) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    const toggle = row.querySelector<HTMLButtonElement>("button[aria-expanded]");
    if (toggle && toggle.getAttribute("aria-expanded") !== "true") {
      toggle.click();
    }
    requestAnimationFrame(() => row.querySelector<HTMLInputElement>("input")?.focus());
  }, []);

  const title = item.name?.trim() || t("review.fallbackTitle");
  const headerTitle = isEditable
    ? editState.title.trim() || t("review.fallbackTitle")
    : title;

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
    // Hidden for a read-only viewer: it would only land them back on the
    // same "you can't correct this" banner they'd get from `?edit=1`.
    ...(canWrite !== false
      ? [
          {
            label: t("document.correctTextAndSpeakers"),
            icon: Pencil,
            onSelect: () => router.push(`${pathname}?edit=1`),
          },
        ]
      : []),
    // Same gate as above: both are rejected server-side for a read-only
    // viewer, so offering them (Delete especially) is wrong even though
    // it's not a security hole.
    ...(canWrite !== false
      ? [
          {
            label: t("document.moveToProject"),
            icon: Folder,
            onSelect: () => setMoveOpen(true),
          },
        ]
      : []),
    {
      label: t("document.openInLibrary"),
      icon: ExternalLink,
      onSelect: () => router.push(`/data/transcriptions/${item.id}`),
    },
    ...(canWrite !== false
      ? [
          {
            label: t("document.delete"),
            icon: Trash2,
            destructive: true,
            onSelect: () => setDeleteOpen(true),
          },
        ]
      : []),
  ];

  // ---- edit handlers ------------------------------------------------------

  const commitBlockEdit = (block: TranscriptBlock, newText: string) => {
    setEditState((prev) => {
      const nextSegments = prev.segments.map((segment, index) => {
        if (!block.segmentIndices.includes(index)) return segment;
        return index === block.segmentIndices[0]
          ? { ...segment, text: newText }
          : { ...segment, text: "" };
      });
      const nextJustReplaced = new Set(prev.justReplaced);
      block.segmentIndices.forEach((index) => nextJustReplaced.delete(index));
      return {
        ...prev,
        segments: nextSegments,
        segmentsDirty: true,
        justReplaced: nextJustReplaced,
      };
    });
  };

  const startBlockEdit = (block: TranscriptBlock) => {
    cancelledEditRef.current = false;
    setEditingSegmentStart(block.segmentIndices[0]);
    setEditingText(block.text);
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelledEditRef.current = true;
      event.currentTarget.blur();
    }
  };

  const handleTextareaBlur = (block: TranscriptBlock) => {
    // An emptied block would blank the text of every segment it spans, and
    // buildTranscriptBlocks drops empty-text segments — so the block would
    // vanish with no way back. Refuse the commit and revert instead
    // (fix-round-1, non-gating #2), same as Escape.
    if (cancelledEditRef.current || editingText.trim() === "") {
      cancelledEditRef.current = false;
    } else {
      commitBlockEdit(block, editingText);
    }
    setEditingSegmentStart(null);
  };

  const handleReplaceAll = (nextSegments: Segment[]) => {
    setEditState((prev) => {
      const changed = new Set<number>();
      nextSegments.forEach((segment, index) => {
        if (segment.text !== prev.segments[index]?.text) changed.add(index);
      });
      return {
        ...prev,
        segments: nextSegments,
        segmentsDirty: true,
        justReplaced: changed,
      };
    });
  };

  const handleSpeakerNameChange = (rawSpeaker: string, name: string) => {
    setEditState((prev) => ({
      ...prev,
      speakers: { ...prev.speakers, [rawSpeaker]: name },
    }));
  };

  const unnamedSpeakerCount = rawSpeakers.filter(
    (raw) => !editState.speakers[raw]?.trim(),
  ).length;
  const sharingChosen = isSharingConfigured(
    editState.rightsMode,
    editState.rbacUsers,
    editState.rbacRoles,
  );

  const handleSaveClick = async () => {
    if (!onSave) return;
    const draft: TranscriptDraft = {
      title: editState.title.trim() || item.name || t("review.fallbackTitle"),
      speakers: editState.speakers,
      correctedSegments: editState.segmentsDirty ? editState.segments : null,
      projectId: editState.projectId || null,
      rightsMode: editState.rightsMode,
      rbacUsers: editState.rbacUsers,
      rbacRoles: editState.rbacRoles,
    };
    setSaving(true);
    try {
      await onSave(draft);
    } catch {
      // The caller already surfaced a toast; keep editing open so nothing is lost.
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell variant="full-bleed">
      <div className="shrink-0 border-b px-4 py-3 md:px-6">
        <PageHeader
          density="compact"
          breadcrumb={{ label: t("title"), href: "/transcriptions" }}
          title={headerTitle}
          meta={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {metaSegments.map((segment, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <span aria-hidden="true">·</span>}
                  {segment}
                </React.Fragment>
              ))}
              {metaSegments.length > 0 && <span aria-hidden="true">·</span>}
              {!isEditable && (
                <AccessControl item={item} open={accessOpen} onOpenChange={setAccessOpen} />
              )}
            </span>
          }
          action={
            isEditable ? (
              <ReviewChecklist
                titleSet={editState.title.trim().length > 0}
                unnamedSpeakerCount={unnamedSpeakerCount}
                hasSummary={hasSummary}
                sharingChosen={sharingChosen}
              />
            ) : (
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
                <ExportMenu itemId={item.id} />
                <OverflowMenu items={overflowItems} label={t("overflow.label")} />
              </div>
            )
          }
        />
      </div>

      {readOnlyDenied && (
        <div className="shrink-0 border-b px-4 py-3 md:px-6">
          <Alert variant="warning">
            <AlertDescription>
              {ownerLabel
                ? t("document.readOnlyNotice", { owner: ownerLabel })
                : t("document.readOnlyNoticeNoOwner")}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={cn(
            "mx-auto grid w-full max-w-6xl gap-6 p-4 md:p-6",
            // Only reserve the chapters track when something fills it —
            // otherwise the document is pushed right by 200px of nothing.
            chapters.length > 0
              ? "md:grid-cols-[200px_minmax(0,1fr)_300px]"
              : "md:grid-cols-[minmax(0,1fr)_300px]",
          )}
        >
          {/* Left: chapters — renders nothing without a supplying output. */}
          {chapters.length > 0 && (
            <nav aria-label={t("document.chaptersTitle")} className="space-y-1 md:col-start-1">
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
          <div className={cn("min-w-0 space-y-6", chapters.length > 0 && "md:col-start-2")}>
            {banner}
            {isEditable && (
              <div className="space-y-1">
                <Input
                  value={editState.title}
                  onChange={(event) =>
                    setEditState((prev) => ({ ...prev, title: event.target.value }))
                  }
                  aria-label={t("composer.titleLabel")}
                  placeholder={t("composer.titlePlaceholder")}
                  className="h-11 border-transparent px-1 text-base font-semibold shadow-none hover:border-input focus-visible:border-input md:h-9"
                />
              </div>
            )}

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
                      <SummaryMarkdown
                        text={
                          index === chaptersSourceIndex
                            ? stripChapters(output.output ?? "")
                            : (output.output ?? "")
                        }
                        onSeek={seekTo}
                      />
                    )}
                  </div>
                ))}
              </section>
            )}

            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{t("review.transcript")}</p>
                {isEditable && (
                  <FindReplace segments={editState.segments} onReplaceAll={handleReplaceAll} />
                )}
              </div>
              {blocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("document.emptyTranscript")}</p>
              ) : (
                <div className="space-y-1">
                  {blocks.map((block, index) =>
                    isEditable ? (
                      <div key={index} className="rounded-md px-2 py-1.5">
                        <span className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            aria-hidden="true"
                            className="inline-block size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: speakerColor(block.rawSpeaker) }}
                          />
                          <span className="truncate font-medium text-foreground">
                            {block.label}
                          </span>
                          {!speakers[block.rawSpeaker]?.trim() && (
                            <button
                              type="button"
                              className="text-primary underline underline-offset-2 max-md:h-11"
                              onClick={() => focusSpeaker(block.rawSpeaker)}
                            >
                              {t("document.nameSpeaker")}
                            </button>
                          )}
                          <span className="shrink-0 font-mono text-muted-foreground">
                            {formatClock(block.start)}
                          </span>
                        </span>
                        {editingSegmentStart === block.segmentIndices[0] ? (
                          <Textarea
                            autoFocus
                            value={editingText}
                            ref={(el) => {
                              // Size to content immediately on mount, not just
                              // on the next keystroke — a multi-line block
                              // must not open clipped (overflow is hidden).
                              if (el) {
                                el.style.height = "auto";
                                el.style.height = `${el.scrollHeight}px`;
                              }
                            }}
                            onChange={(event) => {
                              setEditingText(event.target.value);
                              const el = event.currentTarget;
                              el.style.height = "auto";
                              el.style.height = `${el.scrollHeight}px`;
                            }}
                            onKeyDown={handleTextareaKeyDown}
                            onBlur={() => handleTextareaBlur(block)}
                            className="mt-1 min-h-0 resize-none overflow-hidden text-sm leading-relaxed"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startBlockEdit(block)}
                            className="mt-0.5 block w-full rounded px-1 py-0.5 text-left text-sm leading-relaxed hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {block.segmentIndices.map((segmentIndex, partIndex) => (
                              <React.Fragment key={segmentIndex}>
                                {partIndex > 0 && " "}
                                <span
                                  className={
                                    editState.justReplaced.has(segmentIndex)
                                      ? "rounded bg-success/15 px-0.5 text-success"
                                      : undefined
                                  }
                                >
                                  {segments[segmentIndex]?.text ?? ""}
                                </span>
                              </React.Fragment>
                            ))}
                          </button>
                        )}
                      </div>
                    ) : (
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
                    ),
                  )}
                </div>
              )}
            </section>

            {isEditable && (
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
                        value={editState.projectId || "none"}
                        onValueChange={(value) =>
                          setEditState((prev) => ({
                            ...prev,
                            projectId: value === "none" ? "" : value,
                          }))
                        }
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
                    </div>
                    <div className="space-y-2">
                      <Label>{t("composer.sharing")}</Label>
                      <RBACControl
                        allowedModes={ALLOWED_MODES}
                        subjectLabel={t("sharing.subject")}
                        initialRightsMode={editState.rightsMode}
                        initialUsers={editState.rbacUsers}
                        initialRoles={editState.rbacRoles}
                        modalMode
                        onChange={(nextMode, nextUsers, nextRoles) => {
                          setEditState((prev) => ({
                            ...prev,
                            rightsMode: nextMode,
                            rbacUsers: nextUsers,
                            rbacRoles: nextRoles,
                          }));
                        }}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          {/* Right: SpeakersPanel in edit mode; media + ask box in read mode. */}
          <div className={cn("space-y-4", chapters.length > 0 ? "md:col-start-3" : "md:col-start-2")}>
            {isEditable ? (
              <SpeakersPanel
                rawSpeakers={rawSpeakers}
                names={editState.speakers}
                onNameChange={handleSpeakerNameChange}
                talkShare={talkShare}
                onHear={handleHear}
              />
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      {isEditable && (
        <div className="shrink-0 space-y-3 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div ref={mediaContainerRef}>
            {hasVideo ? (
              <MeetingVideoPlayer
                job={
                  {
                    id: item.job_id ?? item.id,
                    video_s3key: item.video_s3key,
                    recall_recording_id: item.recall_recording_id,
                  } as unknown as Job
                }
              />
            ) : item.audio_s3key ? (
              <AudioTimeline
                ref={audioTimelineRef}
                audioS3Key={item.audio_s3key}
                segments={segments}
                speakers={speakers}
              />
            ) : (
              <p className="px-1 text-xs text-muted-foreground">{t("review.noAudio")}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              className="max-md:h-11"
              onClick={() => onDiscard?.()}
            >
              {t("review.discard")}
            </Button>
            <Button
              type="button"
              disabled={saving || !onSave}
              aria-busy={saving}
              className="max-md:h-11"
              onClick={() => void handleSaveClick()}
            >
              {saving ? (
                <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
              ) : null}
              {tCommon("save")}
            </Button>
          </div>
        </div>
      )}

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
