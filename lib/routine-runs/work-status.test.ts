import { describe, expect, it } from "vitest";

import {
  deriveStatusKey,
  parseWorkStatusConfig,
  resolveRunStatus,
  validateWorkStatusDraft,
  workStatusBadgeClass,
  WORK_STATUS_COLORS,
} from "./work-status";

describe("parseWorkStatusConfig", () => {
  it("parses null, {}, garbage and JSON strings", () => {
    for (const raw of [null, undefined, {}, "x", { statuses: "y" }])
      expect(parseWorkStatusConfig(raw)).toEqual({ statuses: [], default: null });
    expect(
      parseWorkStatusConfig(JSON.stringify({ statuses: [{ key: "neu", label: "Neu" }], default: "neu" })).default,
    ).toBe("neu");
  });
  it("drops entries without a valid key, unknown colours, and a default that is not a status", () => {
    const c = parseWorkStatusConfig({
      statuses: [{ key: "neu", label: "Neu", color: "pink", done: true }, { key: "Bad Key", label: "x" }, { key: "ok1", label: "Ok", color: "blue" }],
      default: "weg",
    });
    expect(c).toEqual({ statuses: [{ key: "neu", label: "Neu", done: true }, { key: "ok1", label: "Ok", color: "blue" }], default: null });
  });
});

describe("deriveStatusKey", () => {
  it("derives keys", () => {
    expect(deriveStatusKey("Angebot im ERP angelegt", [])).toBe("angebot_im_erp_angelegt");
    expect(deriveStatusKey("Rückfrage – vorbereitet!", [])).toBe("rueckfrage_vorbereitet");
    expect(deriveStatusKey("Erledigt", ["erledigt"])).toBe("erledigt_2");
    expect(deriveStatusKey("Erledigt", ["erledigt", "erledigt_2"])).toBe("erledigt_3");
    expect(deriveStatusKey("123", [])).toBe("status_123");
    expect(deriveStatusKey("  ", [])).toBe("status");
    expect(deriveStatusKey("x".repeat(80), []).length).toBeLessThanOrEqual(40);
    expect(deriveStatusKey("Größe ß", [])).toBe("groesse_ss");
  });
  it("always yields a key the backend accepts", () => {
    for (const label of ["A", "é", "x".repeat(80), "---", "9", "Ö"])
      expect(deriveStatusKey(label, [])).toMatch(/^[a-z][a-z0-9_]{1,39}$/);
  });
});

describe("validateWorkStatusDraft", () => {
  const ok = { statuses: [{ key: "neu", label: "Neu" }, { key: "erledigt", label: "Erledigt", done: true }], default: "neu" };
  it("validates a draft", () => {
    expect(validateWorkStatusDraft(ok)).toEqual({ errors: [], warnings: [] });
    expect(validateWorkStatusDraft({ ...ok, default: "erledigt" }).errors).toContain("defaultIsDone");
    expect(validateWorkStatusDraft({ ...ok, default: null }).errors).toContain("defaultMissing");
    expect(validateWorkStatusDraft({ statuses: [{ key: "neu", label: " " }], default: "neu" }).errors).toContain("labelEmpty");
    expect(validateWorkStatusDraft({ statuses: [{ key: "neu", label: "Neu" }], default: "neu" }).warnings).toContain("noDoneStatus");
    expect(validateWorkStatusDraft({ statuses: [], default: null })).toEqual({ errors: [], warnings: [] });
  });
});

describe("badge helpers", () => {
  it("has seven colours and falls back to gray", () => {
    expect(WORK_STATUS_COLORS).toHaveLength(7);
    expect(workStatusBadgeClass("green")).not.toBe(workStatusBadgeClass("gray"));
    expect(workStatusBadgeClass("pink")).toBe(workStatusBadgeClass("gray"));
    expect(workStatusBadgeClass(undefined)).toBe(workStatusBadgeClass("gray"));
  });
  it("resolves a run's status, including a removed key", () => {
    const c = parseWorkStatusConfig({ statuses: [{ key: "neu", label: "Neu", color: "blue" }], default: "neu" });
    expect(resolveRunStatus(c, "neu")).toEqual({ key: "neu", label: "Neu", color: "blue", removed: false });
    expect(resolveRunStatus(c, "alt")).toEqual({ key: "alt", label: "alt", removed: true });
    expect(resolveRunStatus(c, null)).toBeNull();
  });
});
