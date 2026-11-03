/**
 * The "New chat" button arms an in-flight flag (navigatingToNew) and clears it
 * when the location changes. Keying that reset on usePathname() alone is wrong
 * for the public/guest chat: it routes sessions through the QUERY STRING
 * (`basePath?session=…`, newChat = `basePath`, see
 * app/public/agents/[id]/components/public-chat-shell.tsx), and usePathname()
 * excludes the query string. Going from `…?session=X` back to `…` therefore
 * leaves pathname identical, the reset effect never fires, and the button stays
 * on "Loading…" with pointer-events-none — permanently dead for guests.
 *
 * There is no harness for this component (Apollo, next-intl, the session
 * mutations), so this asserts against its source the way
 * composer-send-gate.test.ts does.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (): string =>
  readFileSync(join(__dirname, "history-rail.tsx"), "utf8");

describe("history rail — new-chat in-flight reset", () => {
  it("reads the query string, not just the pathname", () => {
    expect(source()).toContain("useSearchParams");
  });

  it("clears navigatingToNew on a key that includes the query string", () => {
    const src = source();
    // The reset effect must not depend on pathname alone.
    const resetEffect = src.match(
      /setNavigatingToNew\(false\);\s*\}\s*,\s*\[([^\]]*)\]/,
    );
    expect(resetEffect).not.toBeNull();
    const deps = resetEffect![1];
    expect(deps).not.toBe("pathname");
    expect(deps).toMatch(/locationKey/);
  });

  it("derives the location key from both pathname and search", () => {
    const src = source();
    const keyLine = src.match(/const locationKey\s*=\s*[^;]+;/);
    expect(keyLine).not.toBeNull();
    expect(keyLine![0]).toMatch(/pathname/);
    expect(keyLine![0]).toMatch(/search/i);
  });
});
