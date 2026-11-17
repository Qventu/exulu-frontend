import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";

import { createProjectCallIds, describeCreateProjectInput, projectIdOf } from "./create-project";

const msg = (parts: unknown[]): UIMessage => ({ id: "m", role: "assistant", parts }) as unknown as UIMessage;
const call = (toolCallId: string, extra: Record<string, unknown>) => ({ type: "tool-create_project", toolCallId, ...extra });

describe("createProjectCallIds", () => {
  it("returns finished create_project calls only", () => {
    const ids = createProjectCallIds([
      msg([
        call("a", { state: "output-available", output: { result: "ok" } }),
        call("b", { state: "approval-requested" }),
        call("c", { state: "output-available", preliminary: true }),
        call("d", { state: "output-error" }),
        call("e", { state: "output-denied" }),
        { type: "tool-other", toolCallId: "f", state: "output-available" },
        { type: "text", text: "hi" },
      ]),
    ]);
    expect(ids).toEqual(["a"]);
  });
});

describe("describeCreateProjectInput", () => {
  it("lists name and file names", () => {
    expect(describeCreateProjectInput({ name: "Alpha", files: ["a.pdf", "b.pdf"] })).toEqual({ name: "Alpha", files: ["a.pdf", "b.pdf"] });
  });
  it("tolerates missing files and junk", () => {
    expect(describeCreateProjectInput({ name: "Alpha" })).toEqual({ name: "Alpha", files: [] });
    expect(describeCreateProjectInput(null)).toEqual({ name: "", files: [] });
    expect(describeCreateProjectInput({ name: 3, files: ["x", 4] })).toEqual({ name: "", files: ["x"] });
  });
});

describe("projectIdOf", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  it("extracts the project link from a result envelope or string", () => {
    expect(projectIdOf({ result: `Created. Open /projects/${id} now.` })).toBe(id);
    expect(projectIdOf(`see /projects/${id}`)).toBe(id);
  });
  it("rejects a malformed id", () => {
    expect(projectIdOf({ result: "/projects/123e4567-e89b-12d3-a456-4266141740001" })).toBeNull();
    expect(projectIdOf({ result: "/projects/----------------------------------------" })).toBeNull();
  });
  it("returns null without a link", () => {
    expect(projectIdOf({ result: "failed" })).toBeNull();
    expect(projectIdOf(undefined)).toBeNull();
  });
});
