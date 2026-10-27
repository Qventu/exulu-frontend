import { describe, expect, it } from "vitest";

import {
  WORKING_POLL_MS,
  WORKING_STALE_MS,
  listPollIntervalMs,
  sessionActivity,
  shouldWatchForAnswer,
} from "./session-activity";

const NOW = Date.parse("2026-10-27T12:00:00.000Z");
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe("sessionActivity", () => {
  it("says nothing about a conversation that has never run a turn", () => {
    expect(sessionActivity({}, NOW)).toBeNull();
  });

  it("reports a turn in flight as working", () => {
    expect(sessionActivity({ generating_since: at(-5_000) }, NOW)).toBe("working");
  });

  it("prefers working over unread while a follow-up turn is running", () => {
    expect(
      sessionActivity(
        { generating_since: at(-5_000), last_answer_at: at(-60_000), last_seen_at: at(-120_000) },
        NOW,
      ),
    ).toBe("working");
  });

  it("reports an answer nobody has opened as unread", () => {
    expect(sessionActivity({ last_answer_at: at(-60_000), last_seen_at: at(-120_000) }, NOW)).toBe(
      "unread",
    );
  });

  it("reports an answer in a session never opened since as unread", () => {
    expect(sessionActivity({ last_answer_at: at(-60_000) }, NOW)).toBe("unread");
  });

  it("stays quiet once the session has been opened after the answer", () => {
    expect(
      sessionActivity({ last_answer_at: at(-120_000), last_seen_at: at(-60_000) }, NOW),
    ).toBeNull();
  });

  it("treats a seen-at equal to the answer as read, not unread", () => {
    expect(sessionActivity({ last_answer_at: at(-60_000), last_seen_at: at(-60_000) }, NOW)).toBeNull();
  });

  it("gives up on a working flag older than the staleness window", () => {
    // A server that restarts mid-turn leaves generating_since set forever;
    // the row must not claim to be working for the rest of time.
    expect(sessionActivity({ generating_since: at(-WORKING_STALE_MS - 1) }, NOW)).toBeNull();
  });

  it("falls back to the unread answer when the working flag is stale", () => {
    expect(
      sessionActivity(
        { generating_since: at(-WORKING_STALE_MS - 1), last_answer_at: at(-60_000) },
        NOW,
      ),
    ).toBe("unread");
  });

  it("still reports working when the viewer's clock runs behind the server's", () => {
    expect(sessionActivity({ generating_since: at(30_000) }, NOW)).toBe("working");
  });

  it("ignores timestamps it cannot read rather than guessing", () => {
    expect(sessionActivity({ generating_since: "not a date", last_answer_at: "nope" }, NOW)).toBeNull();
  });

  it("accepts Date values as well as the ISO strings GraphQL sends", () => {
    expect(sessionActivity({ generating_since: new Date(NOW - 5_000) }, NOW)).toBe("working");
  });
});

describe("listPollIntervalMs", () => {
  it("does not poll an empty list", () => {
    expect(listPollIntervalMs([], NOW)).toBe(0);
  });

  it("does not poll a list where nothing is happening", () => {
    expect(
      listPollIntervalMs([{ last_answer_at: at(-120_000), last_seen_at: at(-60_000) }], NOW),
    ).toBe(0);
  });

  it("polls while any conversation is working, so the row can stop saying so", () => {
    expect(
      listPollIntervalMs([{}, { generating_since: at(-5_000) }, {}], NOW),
    ).toBe(WORKING_POLL_MS);
  });

  it("does not poll for an unread answer, which will not change on its own", () => {
    expect(listPollIntervalMs([{ last_answer_at: at(-60_000) }], NOW)).toBe(0);
  });

  it("stops polling once a working flag has gone stale", () => {
    // Otherwise a backend that died mid-turn would have every open chat list
    // polling it forever.
    expect(listPollIntervalMs([{ generating_since: at(-WORKING_STALE_MS - 1) }], NOW)).toBe(0);
  });
});

describe("shouldWatchForAnswer", () => {
  it("watches a session the server is working on", () => {
    expect(shouldWatchForAnswer({ generating_since: at(-5_000) }, "ready", NOW)).toBe(true);
  });

  it("does not watch while THIS tab is the one streaming the turn", () => {
    // The live stream is the better source; polling over it would fight it.
    expect(shouldWatchForAnswer({ generating_since: at(-5_000) }, "streaming", NOW)).toBe(false);
  });

  it("does not watch between sending and the first token either", () => {
    expect(shouldWatchForAnswer({ generating_since: at(-5_000) }, "submitted", NOW)).toBe(false);
  });

  it("watches again after this tab's turn failed, since the server may still finish", () => {
    expect(shouldWatchForAnswer({ generating_since: at(-5_000) }, "error", NOW)).toBe(true);
  });

  it("does not watch a session with nothing running", () => {
    expect(shouldWatchForAnswer({ last_answer_at: at(-60_000) }, "ready", NOW)).toBe(false);
  });

  it("does not watch on a stale working flag", () => {
    expect(
      shouldWatchForAnswer({ generating_since: at(-WORKING_STALE_MS - 1) }, "ready", NOW),
    ).toBe(false);
  });

  it("does not watch when there is no session yet", () => {
    expect(shouldWatchForAnswer(null, "ready", NOW)).toBe(false);
  });
});
