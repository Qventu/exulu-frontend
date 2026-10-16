// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { withApprovedTools } from "./approved-tools-body";

const KEY = (s: string) => `pre-approved-tool-calls-${s}`;

afterEach(() => window.localStorage.clear());

describe("withApprovedTools", () => {
  it("fills in the pre-approval list when the caller sent no body at all", () => {
    // This is the resume case. The AI SDK re-submits automatically after an
    // approval answer (sendAutomaticallyWhen) with no body override, so the
    // list that sendMessage would have attached is simply absent — and the
    // server then rebuilds every gated tool as needing approval again. That is
    // the bug: "Allow for this chat" appeared to do nothing for the rest of
    // the turn.
    window.localStorage.setItem(KEY("s1"), JSON.stringify(["tool-moco_list_activities"]));
    expect(withApprovedTools(undefined, "s1")).toEqual({
      approvedTools: JSON.stringify(["tool-moco_list_activities"]),
    });
  });

  it("fills it in when a body exists but carries no approvedTools", () => {
    window.localStorage.setItem(KEY("s1"), JSON.stringify(["tool-bash"]));
    expect(withApprovedTools({ disabledTools: ["x"] }, "s1")).toEqual({
      disabledTools: ["x"],
      approvedTools: JSON.stringify(["tool-bash"]),
    });
  });

  it("never overwrites a list the caller supplied", () => {
    // sendMessage already reads localStorage itself; if it sent a list, that
    // one is authoritative for this request.
    window.localStorage.setItem(KEY("s1"), JSON.stringify(["tool-from-storage"]));
    expect(withApprovedTools({ approvedTools: JSON.stringify(["tool-explicit"]) }, "s1")).toEqual({
      approvedTools: JSON.stringify(["tool-explicit"]),
    });
  });

  it("leaves an explicitly empty list alone rather than refilling it", () => {
    // An empty array is a decision ("nothing is pre-approved"), not a gap.
    // Treating it as absent would silently re-approve tools after a revoke.
    window.localStorage.setItem(KEY("s1"), JSON.stringify(["tool-bash"]));
    expect(withApprovedTools({ approvedTools: [] }, "s1")).toEqual({ approvedTools: [] });
  });

  it("adds nothing when there is no session", () => {
    window.localStorage.setItem(KEY("undefined"), JSON.stringify(["tool-bash"]));
    expect(withApprovedTools({ a: 1 }, undefined)).toEqual({ a: 1 });
  });

  it("adds nothing when the session has no stored pre-approvals", () => {
    expect(withApprovedTools({ a: 1 }, "s-empty")).toEqual({ a: 1 });
  });

  it("survives unreadable storage rather than breaking the request", () => {
    // A request that throws here would lose the user's message entirely; a
    // request without the list merely asks for approval again.
    window.localStorage.setItem(KEY("s1"), "{not json");
    expect(withApprovedTools({ a: 1 }, "s1")).toEqual({ a: 1 });
  });
});
