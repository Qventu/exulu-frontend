import { describe, expect, it } from "vitest";
import { decideGate } from "@/lib/public-agents/gate";

describe("decideGate", () => {
  it("public mode always chats anonymously (even when logged in — spec §5)", () => {
    expect(decideGate("public", false, false)).toBe("chat-anonymous");
    expect(decideGate("public", false, true)).toBe("chat-anonymous");
  });

  it("password mode gates on the cookie", () => {
    expect(decideGate("password", false, false)).toBe("password-gate");
    expect(decideGate("password", true, false)).toBe("chat-anonymous");
    expect(decideGate("password", false, true)).toBe("password-gate");
  });

  it("regular mode gates on authentication", () => {
    expect(decideGate("regular", false, false)).toBe("auth-redirect");
    expect(decideGate("regular", false, true)).toBe("chat-authenticated");
  });
});
