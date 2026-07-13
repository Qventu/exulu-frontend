import { describe, test, expect } from "vitest";
import { withFragmentNavFix, FRAGMENT_NAV_SCRIPT } from "./fragment-nav";

describe("withFragmentNavFix", () => {
  test("injects the interceptor script before </body>", () => {
    const html = "<html><body><h1 id=\"top\">Hi</h1></body></html>";
    const out = withFragmentNavFix(html);
    expect(out).toBe(
      `<html><body><h1 id="top">Hi</h1>${FRAGMENT_NAV_SCRIPT}</body></html>`,
    );
  });

  test("injects before the last </body> when the markup mentions one earlier", () => {
    const html = "<body><code>&lt;/body&gt;</code><pre></body></pre></body>";
    const out = withFragmentNavFix(html);
    expect(out.endsWith(`${FRAGMENT_NAV_SCRIPT}</body>`)).toBe(true);
    expect(out.split(FRAGMENT_NAV_SCRIPT)).toHaveLength(2);
  });

  test("matches </body> case-insensitively", () => {
    const out = withFragmentNavFix("<BODY>x</BODY>");
    expect(out).toBe(`<BODY>x${FRAGMENT_NAV_SCRIPT}</BODY>`);
  });

  test("appends the script when there is no </body>", () => {
    const out = withFragmentNavFix("<h1>bare fragment</h1>");
    expect(out).toBe(`<h1>bare fragment</h1>${FRAGMENT_NAV_SCRIPT}`);
  });

  test("script intercepts same-page fragment links only", () => {
    // The script itself runs in the browser; here we pin the load-bearing
    // pieces so a refactor can't silently drop them.
    expect(FRAGMENT_NAV_SCRIPT).toContain("document.baseURI");
    expect(FRAGMENT_NAV_SCRIPT).toContain("preventDefault");
    expect(FRAGMENT_NAV_SCRIPT).toContain("scrollIntoView");
    expect(FRAGMENT_NAV_SCRIPT).toContain('closest("a[href]")');
  });
});
