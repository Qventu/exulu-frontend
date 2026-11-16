import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";

import { createProjectCallIds, describeCreateProjectInput, projectLinkOf } from "./create-project";

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

describe("projectLinkOf", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  it("extracts the project link from a result envelope or string", () => {
    expect(projectLinkOf({ result: `Created. Open /projects/${id} now.` })).toBe(`/projects/${id}`);
    expect(projectLinkOf(`see /projects/${id}`)).toBe(`/projects/${id}`);
  });
  it("returns null without a link", () => {
    expect(projectLinkOf({ result: "failed" })).toBeNull();
    expect(projectLinkOf(undefined)).toBeNull();
  });
});
