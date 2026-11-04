/**
 * Clicking a session in the guest chat's history changed the URL to
 * `?session=<sid>` but left the screen on the previous conversation.
 *
 * The server page does its job: it reads the param, loads that session and
 * passes initialSession/initialMessages. The client never picks them up,
 * because the session manager seeds from them with
 *
 *   React.useState(initialSession ?? null)
 *
 * and useState only honours its argument on the FIRST mount. The internal chat
 * does not have this problem: every session is its own route segment
 * (/chat/[agent]/[session]), so React unmounts and remounts. The public chat
 * keeps one route and varies a query param, so the subtree survives the
 * navigation and the seeded state is frozen at whatever the first render saw.
 *
 * Fix: key the screen on the session param, which gives the public route the
 * same remount semantics the internal route gets for free. Syncing props into
 * state with an effect would leave two sources of truth for the same value.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (): string => readFileSync(join(__dirname, "page.tsx"), "utf8");

describe("public agent page — session remount", () => {
  it("keys PublicChatScreen so a session change remounts the subtree", () => {
    const src = source();
    const screens = src.split("<PublicChatScreen").length - 1;
    expect(screens).toBeGreaterThanOrEqual(2); // authenticated + anonymous

    // Every render site must carry a key derived from the session param,
    // otherwise that branch keeps the stale conversation.
    const keyed = src.split(/key=\{/).length - 1;
    expect(keyed).toBe(screens);
  });

  it("derives the key from the session param, not a constant", () => {
    const src = source();
    const keys = [...src.matchAll(/key=\{([^}]*)\}/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) {
      expect(k).toMatch(/sessionParam/);
    }
  });

  it("still renders a fresh chat when no session param is present", () => {
    // The fallback has to be a stable literal so repeated "New chat" clicks do
    // not remount endlessly.
    expect(source()).toMatch(/sessionParam\s*\?\?\s*"new"/);
  });
});
