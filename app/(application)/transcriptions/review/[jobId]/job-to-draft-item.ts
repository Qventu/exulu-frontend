/**
 * Adapts an in-review job into the shape `TranscriptDocument` expects
 * (task-12 brief, Step 7). Extracted out of `page.tsx` (a "use client" page
 * that imports the whole `TranscriptDocument` component tree, Apollo, and
 * next/navigation) so this pure mapping can be unit tested without dragging
 * all of that into the test environment.
 *
 * The item doesn't exist yet, so `id`/`name`/etc are placeholders good only
 * for seeding the edit draft — edit mode never renders the read-mode item
 * chrome (Share/Export/Move/Delete/Open-in-library) that would depend on a
 * real item id.
 *
 * `RBAC` is seeded from the job's *chosen* sharing — `target_rbac_users` /
 * `target_rbac_roles` / `target_rights_mode`, set in the composer before the
 * job ever started — so an unchanged review round-trips that choice
 * byte-for-byte. (fix-round-1, gating finding: this previously hardcoded
 * `RBAC: null`, so Save wrote `target_rbac_users: []` and silently discarded
 * whatever the composer's sharing step had chosen.)
 */
import type { Job, Segment, TranscriptItemDetail } from "../../types";

export type JobWithSegments = Job & { raw_segments: Segment[] | string };

export function jobToDraftItem(job: JobWithSegments): TranscriptItemDetail {
  return {
    id: job.id,
    name: job.title,
    recording_source: job.source ?? null,
    job_id: job.id,
    recorded_at: job.join_at ?? job.createdAt,
    duration_seconds: job.duration_seconds,
    speaker_count: null,
    project_id: job.project_id,
    rights_mode: job.target_rights_mode ?? "private",
    created_by: job.created_by,
    post_processing: job.post_processing_outputs ?? null,
    transcript_text: null,
    raw_segments: job.raw_segments,
    corrected_segments: null,
    speakers: job.speakers,
    language: job.language,
    audio_s3key: job.audio_s3key,
    video_s3key: job.video_s3key ?? null,
    recall_recording_id: job.recall_recording_id ?? null,
    RBAC: {
      type: job.target_rights_mode ?? "private",
      users: job.target_rbac_users ?? [],
      roles: job.target_rbac_roles ?? [],
    },
    updatedAt: job.updatedAt,
  };
}
