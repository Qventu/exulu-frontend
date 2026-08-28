import { describe, expect, it, vi } from "vitest";

import {
  ALGI_MEETINGS,
  ALGI_MEETING_ID,
} from "@/lib/demo/fixtures/chapter-meetings";
import { runDemoQueryThroughCache } from "@/lib/demo/test-support";

import { GET_TRANSCRIPTION_JOB, GET_TRANSCRIPTION_JOBS } from "./queries";

/**
 * Chapter 7's list screen.
 *
 * The selection set here is unusually wide — twenty-five fields, most of which
 * the list never renders — and the fixture answers many of them as null
 * because the export deliberately dropped them. That makes it exactly the
 * shape of query where one forgotten field hides: omitting `join_at` produced
 * one Apollo error per recording, twenty-eight on first paint, and the page
 * still rendered perfectly. Found in the browser, not here, which is why the
 * console guard below exists.
 */

const at = { chapter: "meetings", step: 0 } as const;

describe("the recordings list", () => {
  it("returns every meeting", async () => {
    const data = await runDemoQueryThroughCache(
      GET_TRANSCRIPTION_JOBS,
      { limit: 50 },
      at,
    );
    const page = data.transcription_jobsPagination as {
      pageInfo: { itemCount: number };
      items: { title: string; status: string }[];
    };

    expect(page.items).toHaveLength(ALGI_MEETINGS.length);
    expect(page.pageInfo.itemCount).toBe(ALGI_MEETINGS.length);

    // The chapter's copy promises a list that is not tidy — a cancelled row
    // and a failed one are part of the argument, not blemishes to hide.
    const states = new Set(page.items.map((job) => job.status));
    expect(states.has("cancelled")).toBe(true);
    expect(states.has("failed")).toBe(true);
  });

  it("answers every field the selection asks for", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await runDemoQueryThroughCache(GET_TRANSCRIPTION_JOBS, { limit: 50 }, at);
      expect(
        spy.mock.calls.map((c) => String(c[0])),
        "Apollo logged while writing the recordings — a selected field is missing from the resolver",
      ).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("opening one recording", () => {
  it("returns the excerpt for the meeting the chapter opens", async () => {
    const data = await runDemoQueryThroughCache(
      GET_TRANSCRIPTION_JOB,
      { id: ALGI_MEETING_ID },
      at,
    );
    const job = data.transcription_jobById as {
      id: string;
      raw_segments: { speaker: string; text: string }[];
    };

    expect(job.id).toBe(ALGI_MEETING_ID);
    expect(job.raw_segments.length).toBeGreaterThan(0);
  });

  it("returns nothing for any other recording", async () => {
    // Twenty-seven of these transcripts were never redacted, and the fixture
    // holds no text for them. A resolver that fell back to the excerpt would
    // put one meeting's words under another meeting's title — which is worse
    // than an empty transcript, because it looks like data.
    const other = ALGI_MEETINGS.find((m) => m.id !== ALGI_MEETING_ID)!;
    const data = await runDemoQueryThroughCache(
      GET_TRANSCRIPTION_JOB,
      { id: other.id },
      at,
    );
    const job = data.transcription_jobById as {
      raw_segments: unknown[];
    };

    expect(job.raw_segments).toEqual([]);
  });

  it("never exposes the recording, the join link or the bot", async () => {
    // These were dropped at export rather than redacted afterwards. The
    // resolver answers them as null because the selection asks for them; this
    // asserts null is what actually arrives.
    const data = await runDemoQueryThroughCache(
      GET_TRANSCRIPTION_JOB,
      { id: ALGI_MEETING_ID },
      at,
    );
    const job = data.transcription_jobById as Record<string, unknown>;

    for (const field of [
      "audio_s3key",
      "meeting_url",
      "recall_bot_id",
      "whisper_job_id",
    ]) {
      expect(job[field], `${field} should never reach the bundle`).toBeNull();
    }
  });
});
