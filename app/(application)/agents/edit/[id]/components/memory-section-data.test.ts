import { describe, expect, it } from "vitest";

import { normalizeMemoryConfig, sortContextsForPicker } from "./memory-section-data";

describe("normalizeMemoryConfig", () => {
  it("mirrors the backend defaults and clamps", () => {
    expect(normalizeMemoryConfig(null)).toEqual({ retrieval: { enabled: true, limit: 10 }, visibility: "ask", guests: { showRecalled: false } });
    expect(normalizeMemoryConfig('{"retrieval":{"limit":99}}').retrieval.limit).toBe(50);
    expect(normalizeMemoryConfig({ visibility: "preselect_private" }).visibility).toBe("preselect_private");
  });
});

describe("sortContextsForPicker", () => {
  const contexts = [
    { id: "docs", name: "Docs", memoryBase: { ok: false, missing: ["information", "type"] } },
    { id: "team", name: "Team memory", memoryBase: { ok: true, missing: [] } },
    { id: "mem", name: "Agent memory", memoryBase: { ok: true, missing: [] } },
  ] as any;
  it("lists valid bases used by other agents first, then valid, then invalid (disabled with missing fields)", () => {
    const r = sortContextsForPicker(contexts, { team: ["Alfredinio", "Ersatzteil-Bot"] });
    expect(r.map((e) => e.id)).toEqual(["team", "mem", "docs"]);
    expect(r[0]).toMatchObject({ usedBy: ["Alfredinio", "Ersatzteil-Bot"], disabled: false });
    expect(r[2]).toMatchObject({ disabled: true, missing: ["information", "type"] });
  });
});
