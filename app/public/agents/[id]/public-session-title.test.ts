/**
 * Guest sessions showed up in the history rail as "New chat" / "Neuer Chat"
 * forever, so a list of them was unreadable — which is exactly what Newlift
 * reported.
 *
 * Internal chat names a session after the message that started it
 * (app/(application)/chat/hooks.ts: `createSession(text.substring(0, 50))`).
 * The public manager instead passed the i18n literal `t("newChat")` as the
 * title and never revisited it. The two spellings in the rail are the giveaway:
 * the literal is whatever locale the browser had at creation time, not anything
 * about the conversation.
 *
 * The text is available where the session is created lazily — the transport's
 * prepareSendMessagesRequest holds the outgoing messages — so the title can be
 * derived there, the same way and with the same 50-character cut as internal.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const manager = (): string =>
  readFileSync(
    join(__dirname, "components/use-public-session-manager.ts"),
    "utf8",
  );
const session = (): string =>
  readFileSync(
    join(__dirname, "components/use-public-chat-session.ts"),
    "utf8",
  );

describe("public session titles", () => {
  it("ensureSession accepts a title from the caller", () => {
    const src = manager();
    expect(src).toMatch(/ensureSession:\s*\(\s*title\?/);
  });

  it("does not hardcode the i18n literal as the stored title", () => {
    const src = manager();
    const call = src.slice(src.indexOf("createAgentSession({"));
    const vars = call.slice(0, call.indexOf("});"));
    // t("newChat") may remain only as a fallback, never as the sole value.
    expect(vars).toMatch(/title:\s*(?!t\("newChat"\)\s*,)/);
  });

  it("cuts the title to 50 characters, as internal chat does", () => {
    expect(manager()).toMatch(/\.(slice|substring)\(0,\s*50\)/);
  });

  it("passes the outgoing message text when creating the session", () => {
    const src = session();
    const call = src.slice(src.indexOf("ensureSession("));
    expect(call.slice(0, 120)).not.toMatch(/ensureSession\(\)/);
  });
});
