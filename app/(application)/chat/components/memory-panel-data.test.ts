import { describe, expect, it } from "vitest";
import { savedIdsFromMessages, splitByVisibility } from "./memory-panel-data";

const item = (id: string, rights_mode: string) => ({ id, name: id, information: "x", rights_mode, created_by: 4, createdAt: "2026-09-01" }) as any;

describe("splitByVisibility", () => {
  it("counts private vs everything else as public", () => {
    const r = splitByVisibility([item("a", "private"), item("b", "public"), item("c", "roles")]);
    expect(r.privateItems.map((i) => i.id)).toEqual(["a"]);
    expect(r.publicItems.map((i) => i.id)).toEqual(["b", "c"]);
  });
});

describe("savedIdsFromMessages", () => {
  it("collects item ids from memory_saved outputs in this session", () => {
    const messages = [{ id: "m", role: "assistant", parts: [
      { type: "tool-memory_remember", state: "output-available", output: { type: "memory_saved", itemId: "n1" } },
      { type: "tool-memory_update", state: "output-available", output: { type: "memory_updated", itemId: "n2" } },
      { type: "text", text: "hi" },
    ] }] as any;
    expect([...savedIdsFromMessages(messages)]).toEqual(["n1"]);
  });
});
