import { describe, expect, it } from "vitest";

import { canResolve, commonType, groupTitle, memberLine, scanToastKey, type Conflict } from "./conflicts-data";

const member = (id: string, author: { id: number; name: string } | null, type: string | null = "FACT") => ({ id, information: `M ${id}`, type, author, createdAt: "2026-09-01T00:00:00.000Z", usedCount: 2 });
const group: Conflict = { id: "g1", kind: "duplicate", status: "open", similarity: 0.91, reason: null, members: [member("a", { id: 4, name: "Sara" }), member("b", { id: 9, name: "Lena" })], scannedAt: "2026-10-03T10:00:00.000Z", resolvedAt: null, resolution: null, mergedInto: null };

describe("groupTitle", () => {
  it("names the kind and the member count", () => {
    expect(groupTitle(group)).toEqual({ kind: "duplicate", count: 2 });
  });
});

describe("canResolve", () => {
  it("super admins may do everything; merge only on duplicates", () => {
    expect(canResolve(group, { id: 1, super_admin: true })).toEqual({ keep: true, merge: true, dismiss: true, blockedBy: null });
    expect(canResolve({ ...group, kind: "contradiction" }, { id: 1, super_admin: true })).toEqual({ keep: true, merge: false, dismiss: true, blockedBy: null });
  });
  it("a non-admin needs to be the author of every member; the first foreign member blocks and is named", () => {
    expect(canResolve(group, { id: 4 })).toEqual({ keep: false, merge: false, dismiss: false, blockedBy: "Lena" });
    const own: Conflict = { ...group, members: [member("a", { id: 4, name: "Sara" }), member("c", { id: 4, name: "Sara" })] };
    expect(canResolve(own, { id: 4 })).toEqual({ keep: true, merge: true, dismiss: true, blockedBy: null });
    expect(canResolve(group, undefined).keep).toBe(false);
  });
});

describe("helpers", () => {
  it("picks the most common type, null when mixed evenly or absent", () => {
    expect(commonType([member("a", null, "FACT"), member("b", null, "FACT"), member("c", null, "RULE")])).toBe("FACT");
    expect(commonType([member("a", null, null), member("b", null, null)])).toBeNull();
  });
  it("scan toast key depends on unjudged pairs", () => {
    expect(scanToastKey({ open: 2, unjudged: 0 })).toBe("scanDone");
    expect(scanToastKey({ open: 2, unjudged: 5 })).toBe("scanDoneUnjudged");
  });
  it("member line joins type, author and leaves out blanks", () => {
    expect(memberLine(member("a", { id: 4, name: "Sara" }), "Unknown")).toBe("FACT · Sara");
    expect(memberLine(member("a", null, null), "Unknown")).toBe("Unknown");
  });
});
