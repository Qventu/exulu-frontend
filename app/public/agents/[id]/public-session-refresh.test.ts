/**
 * A session created lazily on the guest's first message has to appear in the
 * history rail straight away.
 *
 * It did not: the rail renders from the GET_AGENT_SESSIONS query (via
 * useChatSessions), and the public manager ran CREATE_AGENT_SESSION as a bare
 * useMutation, so nothing ever invalidated that query. The new conversation
 * only showed up after a full page reload, which re-ran the query from
 * scratch. The internal chat does not have this problem because
 * useSessionMutations registers the refetch on every session mutation
 * (app/(application)/chat/hooks.ts).
 *
 * Nothing here can be asserted through the component tree — the rail, the
 * manager and the query live in three different files and the mutation is
 * Apollo-internal — so this pins the wiring at the source, as
 * composer-send-gate.test.ts does.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const manager = (): string =>
  readFileSync(
    join(__dirname, "components/use-public-session-manager.ts"),
    "utf8",
  );

describe("public session manager — history refresh", () => {
  it("refetches the session list after creating a session", () => {
    const src = manager();
    const call = src.slice(src.indexOf("useMutation(CREATE_AGENT_SESSION"));
    const opts = call.slice(0, call.indexOf(");") + 1);
    expect(opts).toMatch(/refetchQueries/);
    expect(opts).toMatch(/GET_AGENT_SESSIONS/);
  });

  it("names the operation too, so a cached query by name is caught", () => {
    // Mirrors the internal call: the document alone misses an instance
    // registered under its operation name.
    const src = manager();
    const call = src.slice(src.indexOf("useMutation(CREATE_AGENT_SESSION"));
    expect(call.slice(0, call.indexOf(");") + 1)).toMatch(/"GetAgentSessions"/);
  });

  it("imports the query it refetches", () => {
    expect(manager()).toMatch(/GET_AGENT_SESSIONS/);
  });
});
