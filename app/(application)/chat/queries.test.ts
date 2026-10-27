/**
 * The activity marker reads three fields off each session row, so the queries
 * that feed the chat list and the chat screen have to ASK for them — a badge
 * that never appears because the field was never selected looks exactly like a
 * badge that has nothing to report.
 */
import { print } from "graphql";
import { describe, expect, it } from "vitest";

import {
  GET_AGENT_SESSIONS,
  GET_AGENT_SESSION_BY_ID,
  MARK_SESSION_SEEN,
} from "./queries";

const ACTIVITY_FIELDS = ["generating_since", "last_answer_at", "last_seen_at"];

describe("chat session queries", () => {
  it.each(ACTIVITY_FIELDS)("the session list selects %s", (field) => {
    expect(print(GET_AGENT_SESSIONS)).toContain(field);
  });

  it.each(ACTIVITY_FIELDS)("the single-session query selects %s", (field) => {
    expect(print(GET_AGENT_SESSION_BY_ID)).toContain(field);
  });
});

describe("MARK_SESSION_SEEN", () => {
  it("calls the server-clock mutation, not a generic session update", () => {
    const document = print(MARK_SESSION_SEEN);
    expect(document).toContain("agentSessionMarkSeen");
    expect(document).not.toContain("agent_sessionsUpdateOneById");
  });

  it("takes only the session id, so no client timestamp can be injected", () => {
    expect(print(MARK_SESSION_SEEN)).toContain("$id: ID!");
    expect(print(MARK_SESSION_SEEN)).not.toContain("last_seen_at");
  });
});
