"use client";

import { useMutation, useQuery } from "@apollo/client";
import {
  CANCEL_TRANSCRIPTION_JOB,
  FINALIZE_TRANSCRIPTION_JOB,
  GET_PROJECTS,
  GET_TRANSCRIPTION_JOB,
  GET_TRANSCRIPTION_JOBS,
  REMOVE_TRANSCRIPTION_JOB,
  START_TRANSCRIPTION_JOB,
} from "@/queries/queries";
import UppyDashboard, { getPresignedUrl } from "@/components/uppy-dashboard";
import { RBACControl } from "@/components/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileAudio, Loader2, Trash2, X } from "lucide-react";
import Link from "next/link";

type Mode = "private" | "users" | "roles" | "teams" | "public";

// Rough multiplier for processing time vs. realtime audio length.
// WhisperX `large-v3` with diarization on:
//   - Mac CPU/MPS: ~8–12× slower than realtime
//   - CUDA consumer GPU: ~0.5–2× realtime
// We use 10 as a deliberately-conservative default; tune via NEXT_PUBLIC_TRANSCRIPTION_FACTOR.
const PROCESSING_FACTOR = Number(
  process.env.NEXT_PUBLIC_TRANSCRIPTION_FACTOR ?? "2",
);

type Job = {
  id: string;
  audio_s3key: string;
  title: string | null;
  status:
    | "queued"
    | "transcribing"
    | "awaiting_review"
    | "saved"
    | "failed"
    | "cancelled";
  whisper_job_id: string | null;
  language: string | null;
  duration_seconds: number | null;
  speakers: Record<string, string> | string | null;
  project_id: string | null;
  target_rights_mode: Mode | null;
  target_rbac_users: { id: number; rights: "read" | "write" }[] | null;
  target_rbac_roles: { id: string; rights: "read" | "write" }[] | null;
  saved_item_id: string | null;
  error: string | null;
  rights_mode: Mode;
  created_by: number;
  createdAt: string;
  updatedAt: string;
};

// Render an ISO timestamp as a short relative-time string ("3m ago",
// "5h ago", "2d ago", "May 27"). The `tick` arg is unused inside but lets
// callers re-render once per second to keep the "X ago" counter live for
// recently-saved rows.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const formatRelative = (iso: string, _tick: number): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year:
        new Date(iso).getFullYear() === new Date().getFullYear()
          ? undefined
          : "numeric",
    });
  } catch {
    return iso;
  }
};

const parseSpeakers = (raw: Job["speakers"]): Record<string, string> => {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
};

type Segment = { start: number; end: number; text: string; speaker: string };

export default function TranscriptionsPage() {
  const [showNewPanel, setShowNewPanel] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const { data, refetch } = useQuery<{
    transcription_jobsPagination: { items: Job[] };
  }>(GET_TRANSCRIPTION_JOBS, {
    variables: {
      filters: [
        {
          status: {
            in: ["queued", "transcribing", "awaiting_review", "failed"],
          },
        },
      ],
    },
    fetchPolicy: "cache-and-network",
    pollInterval: 5000,
  });

  const {
    data: savedData,
    refetch: refetchSaved,
  } = useQuery<{ transcription_jobsPagination: { items: Job[] } }>(
    GET_TRANSCRIPTION_JOBS,
    {
      variables: {
        filters: [{ status: { eq: "saved" } }],
        limit: 50,
      },
      fetchPolicy: "cache-and-network",
    },
  );

  const jobs = data?.transcription_jobsPagination?.items ?? [];
  const savedJobs = savedData?.transcription_jobsPagination?.items ?? [];

  const onJobsChanged = () => {
    refetch();
    refetchSaved();
  };

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Transcriptions</h1>
          <p className="text-sm text-muted-foreground">
            Upload audio, review the diarized transcript, and save it as a context item.{" "}
            <Link href="/data/transcriptions" className="underline">
              View previously saved transcripts
            </Link>
            .
          </p>
        </div>
        <Button
          onClick={() => {
            setShowNewPanel((v) => !v);
            setExpandedJobId(null);
          }}
        >
          {showNewPanel ? "Cancel" : "New transcription"}
        </Button>
      </header>

      {showNewPanel && (
        <NewTranscriptionPanel
          onCancel={() => setShowNewPanel(false)}
          onStarted={() => {
            setShowNewPanel(false);
            onJobsChanged();
          }}
        />
      )}

      <section className="mt-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          In progress
        </h2>
        {jobs.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
            No transcriptions in progress. Click "New transcription" to start one.
          </div>
        ) : (
          <ul className="space-y-2">
            {jobs.map((j) => (
              <JobRow
                key={j.id}
                job={j}
                tick={tick}
                expanded={expandedJobId === j.id}
                onToggle={() =>
                  setExpandedJobId(expandedJobId === j.id ? null : j.id)
                }
                onChanged={onJobsChanged}
              />
            ))}
          </ul>
        )}
      </section>

      {savedJobs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Completed
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Re-open a saved transcript to rename speakers; saving will update
            the existing context item.
          </p>
          <ul className="space-y-2">
            {savedJobs.map((j) => (
              <JobRow
                key={j.id}
                job={j}
                tick={tick}
                expanded={expandedJobId === j.id}
                onToggle={() =>
                  setExpandedJobId(expandedJobId === j.id ? null : j.id)
                }
                onChanged={onJobsChanged}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// New-transcription panel

function NewTranscriptionPanel({
  onCancel,
  onStarted,
}: {
  onCancel: () => void;
  onStarted: () => void;
}) {
  const [s3Key, setS3Key] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string | "">("");
  const [rightsMode, setRightsMode] = useState<Mode>("private");
  const [rbacUsers, setRbacUsers] = useState<
    { id: number; rights: "read" | "write" }[]
  >([]);
  const [rbacRoles, setRbacRoles] = useState<
    { id: string; rights: "read" | "write" }[]
  >([]);
  const [language, setLanguage] = useState<string>("auto");
  const [numSpeakers, setNumSpeakers] = useState<string>("auto");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const { data: projectsData } = useQuery<{
    projectsPagination: { items: { id: string; name: string }[] };
  }>(GET_PROJECTS, { variables: { page: 1, limit: 100 } });
  const projects = projectsData?.projectsPagination?.items ?? [];

  const [startJob] = useMutation(START_TRANSCRIPTION_JOB);

  const filename = useMemo(() => {
    if (!s3Key) return "";
    const last = s3Key.split("/").pop() ?? s3Key;
    return last.includes("_EXULU_") ? last.split("_EXULU_").pop()! : last;
  }, [s3Key]);

  useEffect(() => {
    if (s3Key && !title) setTitle(filename.replace(/\.[^/.]+$/, ""));
  }, [s3Key]);

  const canStart = Boolean(s3Key) && !busy;

  const onStart = async () => {
    if (!s3Key) return;
    setBusy(true);
    try {
      await startJob({
        variables: {
          input: {
            audio_s3key: s3Key,
            filename,
            title: title || filename,
            language: language === "auto" ? null : language,
            num_speakers: numSpeakers === "auto" ? null : Number(numSpeakers),
            project_id: projectId || null,
            target_rights_mode: rightsMode,
            target_rbac_users: rbacUsers,
            target_rbac_roles: rbacRoles,
          },
        },
      });
      toast({ title: "Transcription started" });
      onStarted();
    } catch (err: any) {
      const msg = err?.message ?? "Failed to start transcription";
      toast({
        title: "Could not start transcription",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-card">
      <div className="space-y-2">
        <Label>Audio file</Label>
        {s3Key ? (
          <div className="flex items-center gap-2 text-sm border rounded-md p-2 bg-muted/30">
            <FileAudio className="h-4 w-4" />
            <span className="flex-1 truncate">{filename}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setS3Key(null)}
              type="button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <UppyDashboard
            id="transcriptions-upload"
            selectionLimit={1}
            buttonText="Upload audio"
            allowedFileTypes={[
              ".mp3",
              ".wav",
              ".m4a",
              ".mp4",
              ".mpeg",
            ]}
            dependencies={[]}
            onConfirm={(keys) => {
              if (keys.length > 0) setS3Key(keys[0]);
            }}
          />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title for the resulting transcript"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="de">German</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="it">Italian</SelectItem>
              <SelectItem value="nl">Dutch</SelectItem>
              <SelectItem value="pt">Portuguese</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Speakers</Label>
          <Select value={numSpeakers} onValueChange={setNumSpeakers}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Project (optional)</Label>
        <Select
          value={projectId || "none"}
          onValueChange={(v) => setProjectId(v === "none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Permissions</Label>
        <RBACControl
          initialRightsMode={rightsMode}
          initialUsers={rbacUsers}
          initialRoles={rbacRoles}
          modalMode
          onChange={(mode, users, roles) => {
            setRightsMode(mode);
            setRbacUsers(users);
            setRbacRoles(roles);
          }}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={onStart} disabled={!canStart}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Start
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Job row (list item) + review panel

function JobRow({
  job,
  tick,
  expanded,
  onToggle,
  onChanged,
}: {
  job: Job;
  tick: number;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [cancelJob] = useMutation(CANCEL_TRANSCRIPTION_JOB);
  const [removeJob] = useMutation(REMOVE_TRANSCRIPTION_JOB);
  const { toast } = useToast();

  const filename = useMemo(() => {
    if (job.title) return job.title;
    const last = job.audio_s3key.split("/").pop() ?? job.audio_s3key;
    return last.includes("_EXULU_") ? last.split("_EXULU_").pop()! : last;
  }, [job.audio_s3key, job.title]);

  const fmtDuration = (totalSeconds: number) => {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (h > 0) return `${h}h ${m}m ${ss}s`;
    if (m > 0) return `${m}m ${ss}s`;
    return `${ss}s`;
  };

  // Recomputed every tick so the elapsed counter actually moves.
  const elapsedSeconds = useMemo(() => {
    return (Date.now() - new Date(job.createdAt).getTime()) / 1000;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.createdAt, tick]);
  const elapsed = fmtDuration(elapsedSeconds);

  const audioLengthLabel = job.duration_seconds
    ? fmtDuration(job.duration_seconds)
    : null;

  const remainingLabel = useMemo(() => {
    if (!job.duration_seconds) return null;
    const estimatedTotal = job.duration_seconds * PROCESSING_FACTOR;
    const remaining = estimatedTotal - elapsedSeconds;
    if (remaining <= 0) return "wrapping up";
    return `~${fmtDuration(remaining)} remaining`;
  }, [job.duration_seconds, elapsedSeconds]);

  const onCancel = async () => {
    try {
      await cancelJob({ variables: { id: job.id } });
      onChanged();
    } catch (err: any) {
      toast({
        title: "Cancel failed",
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  const onDismiss = async () => {
    try {
      await removeJob({ variables: { id: job.id } });
      onChanged();
    } catch (err: any) {
      toast({
        title: "Dismiss failed",
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  const transcribingLabel = audioLengthLabel
    ? `Transcribing ${audioLengthLabel} of audio… ${elapsed} elapsed${
        remainingLabel ? ` · ${remainingLabel}` : ""
      }`
    : `Transcribing… ${elapsed} elapsed`;

  // Build a "Saved …" / "Updated …" label that surfaces the most recent
  // meaningful timestamp. Re-saves bump updatedAt; first-save uses createdAt
  // (which is the upload time, but in practice updatedAt ≈ createdAt then).
  const savedLabel = (() => {
    const wasEdited =
      new Date(job.updatedAt).getTime() - new Date(job.createdAt).getTime() >
      2000; // ignore sub-2s jitter between initial insert and finalize
    const verb = wasEdited ? "Updated" : "Saved";
    const stamp = formatRelative(job.updatedAt, tick);
    const parts = [`${verb} ${stamp}`];
    if (audioLengthLabel) parts.push(audioLengthLabel);
    return parts.join(" · ");
  })();

  const statusLabel: Record<Job["status"], string> = {
    queued: "Queued…",
    transcribing: transcribingLabel,
    awaiting_review: audioLengthLabel
      ? `Awaiting review (${audioLengthLabel} of audio)`
      : "Awaiting review",
    saved: savedLabel,
    failed: "Failed",
    cancelled: "Cancelled",
  };

  // Full timestamp for the tooltip on hover. Falls back to ISO if the
  // browser locale doesn't have a nice formatter.
  const fullTimestamp = (() => {
    try {
      return new Date(job.updatedAt).toLocaleString();
    } catch {
      return job.updatedAt;
    }
  })();

  return (
    <li className="border rounded-lg">
      <div className="flex items-center gap-3 p-3">
        <FileAudio className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="truncate font-medium">{filename}</div>
          <div
            className="text-xs text-muted-foreground"
            title={job.status === "saved" ? fullTimestamp : undefined}
          >
            {statusLabel[job.status]}
            {job.error && (
              <span className="text-destructive ml-2">— {job.error}</span>
            )}
          </div>
        </div>
        {(job.status === "queued" || job.status === "transcribing") && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {job.status === "awaiting_review" && (
          <Button size="sm" onClick={onToggle}>
            {expanded ? "Close" : "Review & save"}
          </Button>
        )}
        {job.status === "saved" && (
          <Button variant="outline" size="sm" onClick={onToggle}>
            {expanded ? "Close" : "Edit speakers"}
          </Button>
        )}
        {job.status === "failed" && (
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            <Trash2 className="h-4 w-4 mr-1" /> Dismiss
          </Button>
        )}
      </div>

      {expanded && (job.status === "awaiting_review" || job.status === "saved") && (
        <ReviewPanel job={job} onSaved={onChanged} onClose={onToggle} />
      )}
    </li>
  );
}

function ReviewPanel({
  job,
  onSaved,
  onClose,
}: {
  job: Job;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { data, loading } = useQuery<{
    transcription_jobById: Job & { raw_segments: Segment[] | string };
  }>(GET_TRANSCRIPTION_JOB, {
    variables: { id: job.id },
    fetchPolicy: "cache-and-network",
  });

  const segments: Segment[] = useMemo(() => {
    const raw = data?.transcription_jobById?.raw_segments as any;
    if (!raw) return [];
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return raw;
  }, [data]);

  const distinctSpeakers = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const s of segments) {
      if (!seen.has(s.speaker)) {
        seen.add(s.speaker);
        ordered.push(s.speaker);
      }
    }
    return ordered;
  }, [segments]);

  const isReSave = job.status === "saved";
  const [title, setTitle] = useState(job.title ?? "");
  const [projectId, setProjectId] = useState(job.project_id ?? "");
  const [rightsMode, setRightsMode] = useState<Mode>(
    job.target_rights_mode ?? "private",
  );
  const [rbacUsers, setRbacUsers] = useState<
    { id: number; rights: "read" | "write" }[]
  >(job.target_rbac_users ?? []);
  const [rbacRoles, setRbacRoles] = useState<
    { id: string; rights: "read" | "write" }[]
  >(job.target_rbac_roles ?? []);
  // Pre-populate from the row's persisted speaker map so a re-edit starts
  // from the previously-saved names, not a blank slate.
  const [speakers, setSpeakers] = useState<Record<string, string>>(
    parseSpeakers(job.speakers),
  );
  const [busy, setBusy] = useState(false);

  const { data: projectsData } = useQuery<{
    projectsPagination: { items: { id: string; name: string }[] };
  }>(GET_PROJECTS, { variables: { page: 1, limit: 100 } });
  const projects = projectsData?.projectsPagination?.items ?? [];

  const [finalize] = useMutation(FINALIZE_TRANSCRIPTION_JOB);
  const [cancelJob] = useMutation(CANCEL_TRANSCRIPTION_JOB);
  const { toast } = useToast();

  const renderedPreview = useMemo(() => {
    if (segments.length === 0) return "";
    const blocks: { speaker: string; text: string }[] = [];
    for (const s of segments) {
      const text = (s.text ?? "").trim();
      if (!text) continue;
      const label = speakers[s.speaker] || s.speaker || "unknown";
      const last = blocks[blocks.length - 1];
      if (last && last.speaker === label) last.text = `${last.text} ${text}`.trim();
      else blocks.push({ speaker: label, text });
    }
    return blocks.map((b) => `${b.speaker}: ${b.text}`).join("\n");
  }, [segments, speakers]);

  const onSave = async () => {
    setBusy(true);
    try {
      const result = await finalize({
        variables: {
          id: job.id,
          input: {
            title: title || job.title || "Transcript",
            speakers,
            project_id: projectId || null,
            target_rights_mode: rightsMode,
            target_rbac_users: rbacUsers,
            target_rbac_roles: rbacRoles,
          },
        },
      });
      const itemId =
        (result.data as any)?.transcriptionJobFinalize?.item_id ?? null;
      toast({
        title: isReSave ? "Transcript updated" : "Transcript saved",
        description: itemId ? (
          <Link href={`/data/transcriptions/${itemId}`} className="underline">
            View in /data
          </Link>
        ) : undefined,
      });
      onSaved();
      if (isReSave) onClose();
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const onDiscardOrClose = async () => {
    if (isReSave) {
      // For an already-saved transcript "Discard" doesn't make sense — we
      // don't want to delete the context item. Just close the panel.
      onClose();
      return;
    }
    if (!confirm("Discard this transcript? The job will be cancelled.")) return;
    setBusy(true);
    try {
      await cancelJob({ variables: { id: job.id } });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({
        title: "Discard failed",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading && segments.length === 0) {
    return (
      <div className="border-t p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
        Loading transcript…
      </div>
    );
  }

  const diarizationDisabled = distinctSpeakers.every((s) => s === "unknown");

  return (
    <div className="border-t p-4 space-y-4 bg-muted/20">
      {diarizationDisabled && (
        <div className="text-xs rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 p-2">
          Diarization is disabled on the whisper server — all segments share a
          single speaker. Type one name below to label the whole transcript.
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`title-${job.id}`}>Title</Label>
        <Input
          id={`title-${job.id}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Project (optional)</Label>
        <Select
          value={projectId || "none"}
          onValueChange={(v) => setProjectId(v === "none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Permissions</Label>
        <RBACControl
          initialRightsMode={rightsMode}
          initialUsers={rbacUsers}
          initialRoles={rbacRoles}
          modalMode
          onChange={(mode, users, roles) => {
            setRightsMode(mode);
            setRbacUsers(users);
            setRbacRoles(roles);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Speakers (rename to save with real names)</Label>
        <div className="space-y-2">
          {distinctSpeakers.map((rawLabel) => (
            <div key={rawLabel} className="flex items-center gap-2">
              <code className="text-xs text-muted-foreground w-28 shrink-0">
                {rawLabel}
              </code>
              <Input
                value={speakers[rawLabel] ?? ""}
                onChange={(e) =>
                  setSpeakers({ ...speakers, [rawLabel]: e.target.value })
                }
                placeholder="(keep raw label)"
                className="flex-1"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Audio</Label>
        <AudioTimeline
          audioS3Key={job.audio_s3key}
          segments={segments}
          speakers={speakers}
        />
      </div>

      <div className="space-y-2">
        <Label>Preview</Label>
        <pre className="text-xs whitespace-pre-wrap bg-background border rounded-md p-3 max-h-60 overflow-auto">
          {renderedPreview}
        </pre>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDiscardOrClose} disabled={busy}>
          {isReSave ? "Close" : "Discard"}
        </Button>
        <Button onClick={onSave} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {isReSave ? "Save changes" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Audio timeline: <audio> + colored segment ribbon with hover popups

const SPEAKER_COLORS = [
  "hsl(210, 80%, 55%)", // blue
  "hsl(150, 60%, 45%)", // green
  "hsl(40, 90%, 55%)", // amber
  "hsl(0, 70%, 60%)", // red
  "hsl(280, 60%, 60%)", // purple
  "hsl(180, 60%, 45%)", // teal
  "hsl(20, 80%, 55%)", // orange
  "hsl(330, 65%, 60%)", // pink
];

function speakerColor(rawLabel: string): string {
  // Deterministic colour per raw speaker id so SPEAKER_00 always gets the
  // same hue, even after the user types a real name into the rename input.
  let hash = 0;
  for (let i = 0; i < rawLabel.length; i++) {
    hash = (hash * 31 + rawLabel.charCodeAt(i)) | 0;
  }
  return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length];
}

function formatTimestamp(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AudioTimeline({
  audioS3Key,
  segments,
  speakers,
}: {
  audioS3Key: string;
  segments: Segment[];
  speakers: Record<string, string>;
}) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hover, setHover] = useState<{
    segment: Segment;
    leftPct: number;
  } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPresignedUrl(audioS3Key).then((url) => {
      if (!cancelled) setAudioUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [audioS3Key]);

  // Fall back to the last segment's end time if the <audio> element hasn't
  // reported metadata yet (e.g. while the signed URL is still loading).
  const totalDuration =
    duration || (segments.length ? segments[segments.length - 1].end : 0);

  const seekTo = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    void audioRef.current.play();
  };

  if (!audioUrl) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin inline mr-2" />
        Loading audio…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <audio
        ref={audioRef}
        src={audioUrl}
        controls
        preload="metadata"
        className="w-full"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
      />
      <div className="relative">
        <div
          className="relative h-10 rounded-md overflow-hidden bg-muted/40 border"
          onMouseLeave={() => setHover(null)}
        >
          {totalDuration > 0 &&
            segments.map((seg, i) => {
              const left = (seg.start / totalDuration) * 100;
              const width = Math.max(
                0.15,
                ((seg.end - seg.start) / totalDuration) * 100,
              );
              return (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundColor: speakerColor(seg.speaker),
                  }}
                  onClick={() => seekTo(seg.start)}
                  onMouseEnter={() =>
                    setHover({ segment: seg, leftPct: left + width / 2 })
                  }
                />
              );
            })}
          {totalDuration > 0 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-foreground pointer-events-none"
              style={{
                left: `${(currentTime / totalDuration) * 100}%`,
              }}
            />
          )}
        </div>
        {hover && (
          <div
            className="absolute -top-2 -translate-y-full -translate-x-1/2 z-10 pointer-events-none max-w-xs"
            style={{ left: `${hover.leftPct}%` }}
          >
            <div className="bg-popover text-popover-foreground border rounded-md shadow-md p-2 text-xs">
              <div className="font-medium flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: speakerColor(hover.segment.speaker) }}
                />
                {speakers[hover.segment.speaker] || hover.segment.speaker}
                <span className="text-muted-foreground font-normal">
                  {formatTimestamp(hover.segment.start)} –{" "}
                  {formatTimestamp(hover.segment.end)}
                </span>
              </div>
              <div className="mt-1">{hover.segment.text}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

