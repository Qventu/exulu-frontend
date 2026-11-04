import { describe, expect, test } from "vitest";

import { EMPTY_RBAC, sharingPayload } from "./sharing-form";

describe("sharingPayload", () => {
  test("sharingPayload omits agent_slots outside regular mode", () => {
    const value = { authMode: "public", expiry: "never", rightsMode: "public", rbac: EMPTY_RBAC, agentSlots: [{ key: "a", agentId: "a1" }] } as any;
    expect("agent_slots" in sharingPayload(value)).toBe(false);
  });

  test("sharingPayload includes agent_slots in regular mode", () => {
    const value = { authMode: "regular", expiry: "never", rightsMode: "private", rbac: EMPTY_RBAC, agentSlots: [{ key: "a", agentId: "a1" }] } as any;
    expect(sharingPayload(value).agent_slots).toEqual([{ key: "a", agentId: "a1" }]);
  });
});
