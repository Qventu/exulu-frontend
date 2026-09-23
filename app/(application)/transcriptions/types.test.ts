import { describe, expect, it } from "vitest";

import { findRecoveredJob, type Job } from "./types";

/**
 * findRecoveredJob — real incident, 2026-09-22: a customer reported 4 "failed"
 * recordings as lost. 3 of the 4 had actually succeeded on a later retry (same
 * meeting_url, new job row) and were already sitting in "Saved" — the failed
 * row just never got cleaned up. There was no way to see that link in the UI.
 */
function job(overrides: Partial<Job>): Job {
  return {
    id: "job-id",
    audio_s3key: "",
    title: null,
    status: "failed",
    whisper_job_id: null,
    language: null,
    duration_seconds: null,
    speakers: null,
    project_id: null,
    target_rights_mode: null,
    target_rbac_users: null,
    target_rbac_roles: null,
    saved_item_id: null,
    error: null,
    rights_mode: "private",
    created_by: 1,
    createdAt: "2026-09-17T12:02:02.357Z",
    updatedAt: "2026-09-17T12:02:02.357Z",
    source: "recall",
    meeting_url: null,
    ...overrides,
  };
}

describe("findRecoveredJob — links a failed meeting-bot job to a later successful retry", () => {
  it("finds a saved job for the same meeting_url created after the failure", () => {
    const failed = job({
      id: "failed-1",
      meeting_url: "https://teams.microsoft.com/meet/371696259435999?p=x",
      createdAt: "2026-09-17T12:02:02.357Z",
    });
    const saved = job({
      id: "saved-1",
      status: "saved",
      title: "Untitled transcript",
      meeting_url: "https://teams.microsoft.com/meet/371696259435999?p=x",
      createdAt: "2026-09-17T13:11:20.743Z",
      saved_item_id: "635f77ea-223a-4b2f-884b-cab57ead33ad",
    });

    expect(findRecoveredJob(failed, [saved]))
      .toEqual(saved);
  });

  it("returns null when there is no meeting_url (whisper upload job)", () => {
    const failed = job({ meeting_url: null });
    const saved = job({ status: "saved", meeting_url: null, createdAt: "2026-09-18T00:00:00Z" });

    expect(findRecoveredJob(failed, [saved])).toBeNull();
  });

  it("returns null when no saved job shares the meeting_url", () => {
    const failed = job({ meeting_url: "https://teams.microsoft.com/meet/AAA" });
    const saved = job({ status: "saved", meeting_url: "https://teams.microsoft.com/meet/BBB", createdAt: "2026-09-18T00:00:00Z" });

    expect(findRecoveredJob(failed, [saved])).toBeNull();
  });

  it("ignores a saved job with the same meeting_url that is OLDER than the failure", () => {
    // A genuinely different, earlier occurrence of a recurring meeting link
    // must not be mistaken for "this failure recovered".
    const failed = job({
      meeting_url: "https://teams.microsoft.com/meet/34556544209106?p=x",
      createdAt: "2026-09-05T08:29:59.052Z",
    });
    const olderSaved = job({
      status: "saved",
      meeting_url: "https://teams.microsoft.com/meet/34556544209106?p=x",
      createdAt: "2026-09-01T00:00:00Z",
    });

    expect(findRecoveredJob(failed, [olderSaved])).toBeNull();
  });

  it("picks the earliest later save, not a further-future reuse of a recurring link", () => {
    const failed = job({
      meeting_url: "https://teams.microsoft.com/meet/X",
      createdAt: "2026-09-05T08:00:00Z",
    });
    const immediateRetry = job({
      id: "immediate",
      status: "saved",
      meeting_url: "https://teams.microsoft.com/meet/X",
      createdAt: "2026-09-05T08:02:14Z",
    });
    const nextWeeksOccurrence = job({
      id: "next-week",
      status: "saved",
      meeting_url: "https://teams.microsoft.com/meet/X",
      createdAt: "2026-09-12T08:00:00Z",
    });

    expect(findRecoveredJob(failed, [nextWeeksOccurrence, immediateRetry]))
      .toEqual(immediateRetry);
  });
});
