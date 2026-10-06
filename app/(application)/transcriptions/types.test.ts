import { describe, expect, it } from "vitest";

import {
  applyFindReplace,
  canWriteTranscriptItem,
  displayTitle,
  effectiveSegments,
  filterTranscriptRows,
  findRecoveredJob,
  findReplacePreview,
  groupTranscriptRows,
  hasPostProcessing,
  isLiveJob,
  isPlaceholderSpeaker,
  isSharingConfigured,
  mergeTranscriptRows,
  shouldFinalizeItemSave,
  speakerNeedsName,
  transcriptPublishState,
  type ItemRBAC,
  type Job,
  type Segment,
  type TranscriptItem,
} from "./types";

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

describe("live recording helpers", () => {
  it("isLiveJob is true only for source 'live'", () => {
    expect(isLiveJob(job({ source: "live" }))).toBe(true);
    expect(isLiveJob(job({ source: "recall" }))).toBe(false);
    expect(isLiveJob(job({ source: null }))).toBe(false);
  });

  it("hasPostProcessing is true when prompts or outputs exist (array or JSON string)", () => {
    expect(hasPostProcessing(job({}))).toBe(false);
    expect(hasPostProcessing(job({ post_processing_prompts: [] }))).toBe(false);
    expect(hasPostProcessing(job({ post_processing_prompts: [{ prompt_id: "p", agent_id: "a" }] }))).toBe(true);
    expect(hasPostProcessing(job({ post_processing_prompts: JSON.stringify([{ prompt_id: "p", agent_id: "a" }]) }))).toBe(true);
    expect(
      hasPostProcessing(
        job({ post_processing_outputs: [{ prompt_id: "p", agent_id: "a", prompt_name: null, status: "done", output: "x", error: null, ran_at: "t" }] }),
      ),
    ).toBe(true);
  });

  it("displayTitle falls back to 'Live recording' for untitled live jobs", () => {
    expect(displayTitle({ title: null, audio_s3key: "", source: "live" })).toBe("Live recording");
  });
});

function item(overrides: Partial<TranscriptItem>): TranscriptItem {
  return {
    id: "item-1",
    name: "Kick-off Comfort-Line",
    recording_source: "recall",
    job_id: "job-1",
    recorded_at: "2026-09-10T09:00:00.000Z",
    duration_seconds: 3494,
    speaker_count: 6,
    project_id: "proj-1",
    rights_mode: "private",
    created_by: 1,
    post_processing: null,
    ...overrides,
  };
}

describe("mergeTranscriptRows", () => {
  it("keeps in-progress jobs and ready items in one list", () => {
    const rows = mergeTranscriptRows(
      [job({ id: "job-9", status: "awaiting_review", title: "Fertigungsplanung" })],
      [item({ id: "item-1" })],
    );
    expect(rows.map((r) => r.id).sort()).toEqual(["item-1", "job-9"]);
  });

  it("never lists a saved job twice — its content is the item", () => {
    // The jobs query only asks for ACTIVE_STATUSES, but a job can be saved
    // between the two queries resolving. It must not appear beside its item.
    const rows = mergeTranscriptRows(
      [job({ id: "job-1", status: "saved", saved_item_id: "item-1" })],
      [item({ id: "item-1", job_id: "job-1" })],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("item");
  });

  it("points a needs-review job at the review route and an item at the reading view", () => {
    const rows = mergeTranscriptRows(
      [job({ id: "job-9", status: "awaiting_review" })],
      [item({ id: "item-1" })],
    );
    expect(rows.find((r) => r.id === "job-9")!.href).toBe("/transcriptions/review/job-9");
    expect(rows.find((r) => r.id === "item-1")!.href).toBe("/transcriptions/item-1");
  });

  it("sorts newest first by recorded_at across both sources", () => {
    const rows = mergeTranscriptRows(
      [job({ id: "older-job", status: "awaiting_review", createdAt: "2026-09-01T00:00:00Z" })],
      [item({ id: "newer-item", recorded_at: "2026-09-20T00:00:00.000Z" })],
    );
    expect(rows.map((r) => r.id)).toEqual(["newer-item", "older-job"]);
  });

  it("maps job statuses onto display states", () => {
    const rows = mergeTranscriptRows(
      [
        job({ id: "a", status: "recording" }),
        job({ id: "b", status: "transcribing" }),
        job({ id: "c", status: "awaiting_review" }),
        job({ id: "d", status: "failed" }),
      ],
      [],
    );
    expect(rows.map((r) => r.state).sort()).toEqual(
      ["failed", "needs_review", "recording", "transcribing"],
    );
  });

  it("leaves speakerCount null for an item saved before the column existed", () => {
    const rows = mergeTranscriptRows([], [item({ speaker_count: null })]);
    expect(rows[0].speakerCount).toBeNull();
  });

  it("excludes a job already claimed by an item even when the job's own status is stale", () => {
    // The real cross-query race: the jobs query resolved before the save
    // landed, so the job still says awaiting_review, but an item already
    // references it. Without the claimedJobIds check the user sees the same
    // recording twice — once to review, once to read.
    const rows = mergeTranscriptRows(
      [job({ id: "job-1", status: "awaiting_review", saved_item_id: null })],
      [item({ id: "item-1", job_id: "job-1" })],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("item");
  });
});

describe("transcriptPublishState", () => {
  it("reads the two axes off a job", () => {
    expect(transcriptPublishState({ status: "awaiting_review", saved_item_id: null })).toBe("draft");
    expect(transcriptPublishState({ status: "reviewed", saved_item_id: null })).toBe("reviewed");
    expect(transcriptPublishState({ status: "saved", saved_item_id: "item-1" })).toBe("published");
  });

  it("trusts saved_item_id over a lagging status", () => {
    // finalize writes the item before the status; a row caught in between is
    // published, whatever its status still says.
    expect(transcriptPublishState({ status: "reviewed", saved_item_id: "item-1" })).toBe("published");
  });
});

describe("mergeTranscriptRows with a reviewed job", () => {
  it("keeps a reviewed job in the list — it has no item to stand in for it", () => {
    const rows = mergeTranscriptRows(
      [{ id: "j1", status: "reviewed", saved_item_id: null, createdAt: "2026-10-01T00:00:00Z" } as never],
      [],
    );
    expect(rows.map((r) => r.id)).toContain("j1");
    expect(rows[0].state).toBe("reviewed");
  });

  it("still drops a job that produced an item", () => {
    const rows = mergeTranscriptRows(
      [{ id: "j1", status: "saved", saved_item_id: "i1", createdAt: "2026-10-01T00:00:00Z" } as never],
      [],
    );
    expect(rows).toHaveLength(0);
  });
});

describe("filterTranscriptRows", () => {
  const rows = mergeTranscriptRows(
    [job({ id: "job-9", status: "awaiting_review" })],
    [item({ id: "mine", created_by: 1 }), item({ id: "theirs", created_by: 2 })],
  );

  it("'all' keeps everything", () => {
    expect(filterTranscriptRows(rows, "all", 1)).toHaveLength(3);
  });

  it("'needs_review' keeps only jobs awaiting review", () => {
    expect(filterTranscriptRows(rows, "needs_review", 1).map((r) => r.id)).toEqual(["job-9"]);
  });

  it("'mine' keeps items I created", () => {
    expect(filterTranscriptRows(rows, "mine", 1).map((r) => r.id)).toEqual(["mine"]);
  });

  it("'shared' keeps readable items I did NOT create", () => {
    expect(filterTranscriptRows(rows, "shared", 1).map((r) => r.id)).toEqual(["theirs"]);
  });
});

describe("groupTranscriptRows", () => {
  const now = new Date("2026-09-29T12:00:00.000Z");

  it("puts the last seven days in This week and the rest in Earlier", () => {
    const rows = mergeTranscriptRows(
      [],
      [
        item({ id: "recent", recorded_at: "2026-09-26T09:00:00.000Z" }),
        item({ id: "old", recorded_at: "2026-09-10T09:00:00.000Z" }),
      ],
    );
    const { thisWeek, earlier } = groupTranscriptRows(rows, now);
    expect(thisWeek.map((r) => r.id)).toEqual(["recent"]);
    expect(earlier.map((r) => r.id)).toEqual(["old"]);
  });

  it("treats a future recorded_at as this week rather than hiding it", () => {
    // A scheduled meeting bot has a join_at in the future; the row must not
    // fall off the bottom of the list.
    const rows = mergeTranscriptRows([], [item({ id: "scheduled", recorded_at: "2026-10-02T09:00:00.000Z" })]);
    expect(groupTranscriptRows(rows, now).thisWeek.map((r) => r.id)).toEqual(["scheduled"]);
  });
});

const segs = (...texts: string[]): Segment[] =>
  texts.map((text, i) => ({ start: i, end: i + 1, text, speaker: "SPEAKER_00" }));

describe("applyFindReplace", () => {
  it("replaces every occurrence and reports the count", () => {
    const { segments, count } = applyFindReplace(
      segs("Zet Cad is slow", "open Zet Cad"),
      "Zet Cad",
      "ZWCAD",
      false,
    );
    expect(segments.map((s) => s.text)).toEqual(["ZWCAD is slow", "open ZWCAD"]);
    expect(count).toBe(2);
  });

  it("counts multiple hits inside one segment", () => {
    expect(applyFindReplace(segs("a a a"), "a", "b", false).count).toBe(3);
  });

  it("is case-insensitive by default and case-sensitive on request", () => {
    expect(applyFindReplace(segs("Zet cad"), "zet cad", "ZWCAD", false).count).toBe(1);
    expect(applyFindReplace(segs("Zet cad"), "zet cad", "ZWCAD", true).count).toBe(0);
  });

  it("treats the needle as literal text, not a regular expression", () => {
    // A user typing "(1)" must not blow up or match nothing.
    const { segments, count } = applyFindReplace(segs("item (1) here"), "(1)", "(2)", false);
    expect(count).toBe(1);
    expect(segments[0].text).toBe("item (2) here");
  });

  it("never changes timestamps or speakers", () => {
    const before = segs("one", "two");
    const { segments } = applyFindReplace(before, "one", "1", false);
    expect(segments.map((s) => [s.start, s.end, s.speaker])).toEqual(
      before.map((s) => [s.start, s.end, s.speaker]),
    );
  });

  it("returns the input unchanged for an empty needle", () => {
    const before = segs("one");
    const { segments, count } = applyFindReplace(before, "", "x", false);
    expect(segments).toEqual(before);
    expect(count).toBe(0);
  });
});

describe("effectiveSegments — a correction wholly replaces the raw transcript", () => {
  it("falls back to raw_segments when nothing was corrected", () => {
    const raw = segs("hello there");
    expect(effectiveSegments(raw, null)).toEqual(raw);
  });

  it("prefers corrected_segments once a correction exists", () => {
    const raw = segs("hello there");
    const corrected = segs("hello there fixed");
    expect(effectiveSegments(raw, corrected)).toEqual(corrected);
  });

  it("parses JSON-string fields the same as arrays", () => {
    const raw = segs("hello there");
    expect(effectiveSegments(JSON.stringify(raw), null)).toEqual(raw);
  });
});

describe("isSharingConfigured", () => {
  it("private and public need no further set-up", () => {
    expect(isSharingConfigured("private", [], [])).toBe(true);
    expect(isSharingConfigured("public", [], [])).toBe(true);
  });

  it("users/roles mode with nobody added yet is not configured", () => {
    expect(isSharingConfigured("users", [], [])).toBe(false);
    expect(isSharingConfigured("roles", [], [])).toBe(false);
  });

  it("users/roles mode with at least one grant is configured", () => {
    expect(isSharingConfigured("users", [{ id: 2, rights: "read" }], [])).toBe(true);
    expect(isSharingConfigured("roles", [], [{ id: "role-1", rights: "read" }])).toBe(true);
  });
});

describe("canWriteTranscriptItem — mirrors the backend's validateWriteAccess", () => {
  const rbac = (overrides: Partial<ItemRBAC> = {}): ItemRBAC => ({
    users: [],
    roles: [],
    ...overrides,
  });

  it("denies an unauthenticated viewer", () => {
    expect(
      canWriteTranscriptItem({ rights_mode: "public", created_by: 1, RBAC: null }, null),
    ).toBe(false);
  });

  it("a public item is writable by anyone", () => {
    expect(
      canWriteTranscriptItem(
        { rights_mode: "public", created_by: 1, RBAC: null },
        { id: 2, role: "role-1" },
      ),
    ).toBe(true);
  });

  it("a private item is writable only by its creator", () => {
    const item = { rights_mode: "private" as const, created_by: 1, RBAC: null };
    expect(canWriteTranscriptItem(item, { id: 1, role: "role-1" })).toBe(true);
    expect(canWriteTranscriptItem(item, { id: 2, role: "role-1" })).toBe(false);
  });

  it("the creator can always write, whatever rights_mode it's shared under", () => {
    const item = {
      rights_mode: "users" as const,
      created_by: 1,
      RBAC: rbac({ users: [] }),
    };
    expect(canWriteTranscriptItem(item, { id: 1, role: "role-1" })).toBe(true);
  });

  it("a users-mode grant needs rights: write, not just being listed", () => {
    const item = {
      rights_mode: "users" as const,
      created_by: 1,
      RBAC: rbac({ users: [{ id: 2, rights: "read" }] }),
    };
    expect(canWriteTranscriptItem(item, { id: 2, role: "role-1" })).toBe(false);
    expect(
      canWriteTranscriptItem(
        { ...item, RBAC: rbac({ users: [{ id: 2, rights: "write" }] }) },
        { id: 2, role: "role-1" },
      ),
    ).toBe(true);
  });

  it("a roles-mode grant checks the viewer's role id, hydrated or not", () => {
    const item = {
      rights_mode: "roles" as const,
      created_by: 1,
      RBAC: rbac({ roles: [{ id: "editor", rights: "write" }] }),
    };
    expect(canWriteTranscriptItem(item, { id: 2, role: "editor" })).toBe(true);
    expect(canWriteTranscriptItem(item, { id: 2, role: { id: "editor" } })).toBe(true);
    expect(canWriteTranscriptItem(item, { id: 2, role: "viewer" })).toBe(false);
  });

  it("super_admin always writes, regardless of rights_mode", () => {
    const item = { rights_mode: "private" as const, created_by: 1, RBAC: null };
    expect(canWriteTranscriptItem(item, { id: 99, super_admin: true })).toBe(true);
  });
});

/**
 * shouldFinalizeItemSave — the routing decision behind the task-13 fix
 * (`/transcriptions/[itemId]` save handler): a job-backed item's correction
 * must go through FINALIZE_TRANSCRIPTION_JOB (re-renders transcript_text) when
 * the saving user owns the job, since the server rejects finalize for anyone
 * else. This tests only the pure predicate, not either mutation.
 */
describe("shouldFinalizeItemSave — routes an owner's save through finalize, not item-update", () => {
  it("owner with a job_id routes to finalize", () => {
    const item = { job_id: "job-1", created_by: 1 };
    expect(shouldFinalizeItemSave(item, { id: 1 })).toBe(true);
  });

  it("a super_admin (not the creator) also routes to finalize", () => {
    const item = { job_id: "job-1", created_by: 1 };
    expect(shouldFinalizeItemSave(item, { id: 99, super_admin: true })).toBe(true);
  });

  it("a non-owner with write access (shared editor) uses item-update instead", () => {
    const item = { job_id: "job-1", created_by: 1 };
    expect(shouldFinalizeItemSave(item, { id: 2 })).toBe(false);
  });

  it("an item with no job_id always uses item-update, even for the creator", () => {
    const item = { job_id: null, created_by: 1 };
    expect(shouldFinalizeItemSave(item, { id: 1 })).toBe(false);
  });

  it("denies an unauthenticated viewer", () => {
    const item = { job_id: "job-1", created_by: 1 };
    expect(shouldFinalizeItemSave(item, null)).toBe(false);
  });
});

describe("isPlaceholderSpeaker", () => {
  it("recognises the diarization placeholders each source emits", () => {
    for (const raw of ["SPEAKER_00", "SPEAKER_1", "speaker_0", "Speaker A", "Speaker B", "speaker 12", "unknown", "0", "3"]) {
      expect(isPlaceholderSpeaker(raw)).toBe(true);
    }
  });

  it("treats a meeting bot's real participant names as real", () => {
    // Recall labels every segment with the participant's actual name.
    for (const raw of ["Behrami, Leutrim", "Mario Gramsch", "Götz, Sebastian", "Ilias Seifert"]) {
      expect(isPlaceholderSpeaker(raw)).toBe(false);
    }
  });

  it("does not mistake a real name that merely contains the word", () => {
    expect(isPlaceholderSpeaker("Speaker of the House")).toBe(false);
    expect(isPlaceholderSpeaker("Anja Speaker")).toBe(false);
  });
});

describe("speakerNeedsName", () => {
  it("asks for a name only for an unmapped placeholder", () => {
    expect(speakerNeedsName("SPEAKER_00", {})).toBe(true);
    expect(speakerNeedsName("SPEAKER_00", { SPEAKER_00: "Lena Brandt" })).toBe(false);
    expect(speakerNeedsName("SPEAKER_00", { SPEAKER_00: "   " })).toBe(true);
  });

  it("never asks for a name a meeting bot already supplied", () => {
    expect(speakerNeedsName("Mario Gramsch", {})).toBe(false);
  });
});

describe("findReplacePreview", () => {
  const seg = (text: string) => ({ start: 0, end: 1, speaker: "A", text });

  it("shows the replacement in place, split for highlighting", () => {
    const { rows, count } = findReplacePreview(
      [seg("Zet Cad und zet cad"), seg("nichts hier")],
      "zet cad",
      "ZetCAD",
      false,
    );
    expect(count).toBe(2);
    expect(rows).toHaveLength(1);
    expect(rows[0].index).toBe(0);
    expect(rows[0].after).toEqual([
      { text: "ZetCAD", hit: true },
      { text: " und ", hit: false },
      { text: "ZetCAD", hit: true },
    ]);
  });

  it("agrees with applyFindReplace on the resulting text", () => {
    const segments = [seg("a b a"), seg("b only"), seg("ends with a")];
    const { rows } = findReplacePreview(segments, "a", "X", true);
    const applied = applyFindReplace(segments, "a", "X", true).segments;
    for (const row of rows) {
      expect(row.after.map((part) => part.text).join("")).toBe(applied[row.index].text);
    }
  });

  it("respects match case", () => {
    expect(findReplacePreview([seg("Alpha alpha")], "alpha", "x", true).count).toBe(1);
    expect(findReplacePreview([seg("Alpha alpha")], "alpha", "x", false).count).toBe(2);
  });

  it("previews a deletion, which has no highlighted span", () => {
    const { rows, count } = findReplacePreview([seg("ähm also ähm ja")], "ähm ", "", false);
    expect(count).toBe(2);
    expect(rows[0].after.map((p) => p.text).join("")).toBe("also ja");
    expect(rows[0].after.every((p) => !p.hit)).toBe(true);
  });

  it("returns nothing for an empty search", () => {
    expect(findReplacePreview([seg("anything")], "", "x", false)).toEqual({ rows: [], count: 0 });
  });
});

