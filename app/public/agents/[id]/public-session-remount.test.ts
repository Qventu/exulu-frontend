/**
 * Switching sessions in the guest chat must change the conversation WITHOUT
 * tearing down the shell and history rail around it.
 *
 * First attempt keyed <PublicChatScreen> on the session param. That fixed the
 * original bug — the screen not changing at all — but remounted the whole
 * screen, so the rail refetched and the page visibly reloaded on every switch.
 * The internal chat does not behave that way because its shell and rail live
 * in [agent]/layout.tsx while only [session]/page.tsx remounts.
 *
 * So the boundary belongs below the shell: the rail stays mounted, only the
 * conversation remounts, and the session manager — which sits above the
 * boundary because the rail needs its current id for the highlight — follows
 * the navigation by syncing to the server-provided session instead.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = (): string => readFileSync(join(__dirname, "page.tsx"), "utf8");
const screen = (): string =>
  readFileSync(join(__dirname, "components/public-chat-screen.tsx"), "utf8");
const manager = (): string =>
  readFileSync(
    join(__dirname, "components/use-public-session-manager.ts"),
    "utf8",
  );

describe("public agent page — session switching", () => {
  it("does NOT key the whole screen: that remounts the rail too", () => {
    const keys = [...page().matchAll(/<PublicChatScreen[\s\S]*?\/>/g)]
      .map((m) => m[0])
      .filter((tag) => /key=\{/.test(tag));
    expect(keys).toHaveLength(0);
  });

  it("remounts the conversation below the shell instead", () => {
    const src = screen();
    // The boundary must sit inside <PublicChatShell>, so the rail survives.
    const shellOpen = src.indexOf("<PublicChatShell");
    const boundary = src.indexOf("<ConversationBoundary");
    expect(shellOpen).toBeGreaterThan(-1);
    expect(boundary).toBeGreaterThan(shellOpen);
  });

  it("keys that boundary on the session as well as the new-chat nonce", () => {
    const src = screen();
    // Grab the component body rather than regexing the key expression: it is a
    // template literal, so a naive [^}]* stops at the first interpolation.
    const start = src.indexOf("function ConversationBoundary");
    expect(start).toBeGreaterThan(-1);
    // Fixed window: the destructured params contain "\n}" themselves, so
    // searching for the closing brace truncates before the JSX.
    const body = src.slice(start, start + 600);
    expect(body).toMatch(/key=\{/);
    expect(body).toMatch(/newChatNonce/);
    expect(body).toMatch(/sessionId/);
  });

  it("session manager follows the server session across a navigation", () => {
    // It lives above the boundary (the rail needs its id), so it cannot rely
    // on remounting — it has to react to the prop changing.
    const src = manager();
    expect(src).toMatch(/React\.useEffect/);
    expect(src).toMatch(/initialSession\?\.id/);
  });

  it("keys the boundary on the SERVER session, not the manager's", () => {
    // The manager's currentSession also moves on a lazy create — with no
    // server render, because the URL is swapped via history.replaceState.
    // Keying on it would remount mid-send and kill the in-flight stream that
    // replaceState exists to protect.
    const src = screen();
    const tag = src.match(/<ConversationBoundary[^>]*>/);
    expect(tag).not.toBeNull();
    expect(tag![0]).toMatch(/initialSession/);
    expect(tag![0]).not.toMatch(/currentSession/);
  });

  it("seeds messages from the same source the key uses", () => {
    // Mismatched sources showed an empty conversation when opening a session
    // from a fresh chat: the key had already changed while currentSession was
    // still catching up in an effect.
    const src = screen();
    const tag = src.match(/<PublicChatBody[\s\S]*?\/>/);
    expect(tag).not.toBeNull();
    expect(tag![0]).toMatch(/initialMessages=\{initialSession \?/);
  });

  it("bumps the new-chat nonce only when a push cannot navigate", () => {
    // Bumping unconditionally remounted before router.push resolved, so the
    // conversation re-seeded from the session being left and "New chat"
    // needed two clicks.
    const src = readFileSync(
      join(__dirname, "components/public-chat-shell.tsx"),
      "utf8",
    );
    const fn = src.slice(src.indexOf("const startNewChat"));
    const body = fn.slice(0, fn.indexOf("}, ["));
    expect(body).toMatch(/searchParams/);
    expect(body).toMatch(/router\.push/);
    expect(body).toMatch(/setNewChatNonce/);
    // the bump must be in the branch, not unconditional
    expect(body.indexOf("if (")).toBeLessThan(body.indexOf("setNewChatNonce"));
  });
});
