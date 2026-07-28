import { describe, expect, it } from "vitest";

import type { Routine } from "../../../types";
import { buildRunWorkflowCurl } from "./build-curl";

const routine = (over: Partial<Routine>): Routine =>
  ({
    id: "abc-123",
    name: "R",
    agent: "a",
    created_by: 1,
    rights_mode: "private",
    RBAC: { users: [], roles: [], teams: [] },
    createdAt: "",
    updatedAt: "",
    ...over,
  }) as Routine;

function parseBody(curl: string) {
  const m = curl.match(/-d '([\s\S]*)'$/);
  if (!m) throw new Error("no -d body found");
  return JSON.parse(m[1]);
}

describe("buildRunWorkflowCurl", () => {
  it("targets the given endpoint with a bearer-token header", () => {
    const out = buildRunWorkflowCurl(routine({ id: "xyz" }), "https://api.test");
    expect(out).toContain("curl -X POST https://api.test/graphql");
    expect(out).toContain('-H "Authorization: Bearer $EXULU_TOKEN"');
  });

  it("prefills the routine id and its variable names in the mutation body", () => {
    const body = parseBody(
      buildRunWorkflowCurl(
        routine({ id: "xyz", variables: ["topic", "count"] }),
        "https://api.test",
      ),
    );
    expect(body.query).toContain('runWorkflow(id: "xyz"');
    expect(body.variables).toEqual({ variables: { topic: "...", count: "..." } });
  });

  it("renders empty variables when the routine has none", () => {
    const body = parseBody(buildRunWorkflowCurl(routine({ variables: [] }), ""));
    expect(body.variables).toEqual({ variables: {} });
  });
});
