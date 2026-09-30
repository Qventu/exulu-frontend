import { describe, expect, it } from "vitest";

import { jobToDraftItem, type JobWithSegments } from "./job-to-draft-item";

function job(overrides: Partial<JobWithSegments> = {}): JobWithSegments {
  return {
    id: "job-1",
    audio_s3key: "audio.mp3",
    title: "Kickoff",
    status: "awaiting_review",
    whisper_job_id: null,
    language: "en",
    duration_seconds: 120,
    speakers: {},
    project_id: null,
    target_rights_mode: null,
    target_rbac_users: null,
    target_rbac_roles: null,
    saved_item_id: null,
    error: null,
    rights_mode: "private",
    created_by: 1,
    createdAt: "2026-09-29T00:00:00.000Z",
    updatedAt: "2026-09-29T00:00:00.000Z",
    raw_segments: [],
    ...overrides,
  };
}

describe("jobToDraftItem", () => {
  // fix-round-1 gating finding: RBAC used to be hardcoded null, so an
  // unchanged review's Save wrote target_rbac_users: [] and silently
  // destroyed whatever the composer's sharing step had chosen.
  it("round-trips the composer's sharing choice instead of discarding it", () => {
    const draft = jobToDraftItem(
      job({
        target_rights_mode: "users",
        target_rbac_users: [
          { id: 2, rights: "read" },
          { id: 3, rights: "write" },
        ],
        target_rbac_roles: [],
      }),
    );
    expect(draft.rights_mode).toBe("users");
    expect(draft.RBAC?.users).toEqual([
      { id: 2, rights: "read" },
      { id: 3, rights: "write" },
    ]);
    expect(draft.RBAC?.roles).toEqual([]);
  });

  it("seeds role grants the same way", () => {
    const draft = jobToDraftItem(
      job({
        target_rights_mode: "roles",
        target_rbac_roles: [{ id: "role-1", rights: "write" }],
      }),
    );
    expect(draft.rights_mode).toBe("roles");
    expect(draft.RBAC?.roles).toEqual([{ id: "role-1", rights: "write" }]);
  });

  it("defaults to private with no grants when the job never set a target audience", () => {
    const draft = jobToDraftItem(job());
    expect(draft.rights_mode).toBe("private");
    expect(draft.RBAC).toEqual({ type: "private", users: [], roles: [] });
  });
});
