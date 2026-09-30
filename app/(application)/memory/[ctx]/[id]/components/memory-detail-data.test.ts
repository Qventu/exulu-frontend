import { describe, expect, it } from "vitest";
import { detailActions, sourceQuote } from "./memory-detail-data";

const msg = (o: unknown) => ({ content: JSON.stringify(o) });

describe("sourceQuote", () => {
  it("takes the first user message's text from parts or legacy content, trimmed and capped", () => {
    expect(sourceQuote([msg({ role: "assistant", parts: [{ type: "text", text: "Hi" }] }), msg({ role: "user", parts: [{ type: "text", text: "  Remember the gearbox tip  " }] })])).toBe("Remember the gearbox tip");
    expect(sourceQuote([msg({ role: "user", content: "legacy text" })])).toBe("legacy text");
    expect(sourceQuote([msg({ role: "user", parts: [{ type: "text", text: "x".repeat(300) }] })])).toBe("x".repeat(279) + "…");
  });
  it("returns null for no messages, unparseable rows, or no user turn", () => {
    expect(sourceQuote([])).toBeNull();
    expect(sourceQuote([{ content: "{not json" }])).toBeNull();
    expect(sourceQuote([msg({ role: "assistant", parts: [{ type: "text", text: "Hi" }] })])).toBeNull();
  });
});

describe("detailActions", () => {
  const item = { id: "m1", created_by: 9, rights_mode: "public", RBAC: { users: [{ id: "4", rights: "write" }, { id: "5", rights: "read" }] } };
  it("creator, super admin and explicit write grant may act; make-private only when not private", () => {
    expect(detailActions(item, { id: 9 })).toEqual({ canEdit: true, canMakePrivate: true, canDelete: true });
    expect(detailActions(item, { id: 1, super_admin: true })).toEqual({ canEdit: true, canMakePrivate: true, canDelete: true });
    expect(detailActions(item, { id: 4 })).toEqual({ canEdit: true, canMakePrivate: true, canDelete: true });
    expect(detailActions(item, { id: 5 })).toEqual({ canEdit: false, canMakePrivate: false, canDelete: false });
    expect(detailActions({ ...item, rights_mode: "private" }, { id: 9 })).toEqual({ canEdit: true, canMakePrivate: false, canDelete: true });
    expect(detailActions(item, undefined)).toEqual({ canEdit: false, canMakePrivate: false, canDelete: false });
  });
});
