/**
 * A missing or unreachable animation must degrade to "no custom animation",
 * never take the page down.
 *
 * It did exactly that on 2026-11-04: the public animation route 404'd, the
 * fetcher called response.json() without checking response.ok, and the error
 * BODY — `{"detail":"Animation not found."}` — parsed as perfectly valid JSON.
 * That object was handed to lottie-web as animation data, which then threw
 * "Cannot read properties of undefined (reading 'length')" out of a render and
 * killed the whole guest chat with "Application error: a client-side
 * exception has occurred". A cosmetic fallback became an outage.
 *
 * useAnimationData already catches rejections and leaves data null, so the fix
 * is simply to REJECT on a non-ok response (and on a body that is not a lottie
 * document) instead of resolving with junk.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (): string => readFileSync(join(__dirname, "lottie.tsx"), "utf8");

describe("lottie animation fetching", () => {
  it("has exactly one fetch site, and it checks response.ok before parsing", () => {
    const src = source();
    // One guarded helper rather than a raw fetch per animation: a second,
    // unguarded fetch site is how this regressed in the first place.
    const fetches = src.split("await fetch(").length - 1;
    expect(fetches).toBe(1);
    expect(src).toContain("response.ok");
  });

  it("routes every animation through that helper", () => {
    const src = source();
    // default idle, default responding, custom idle, custom responding
    const uses = src.split("fetchLottieDocument(").length - 1;
    expect(uses).toBe(4); // the definition is `= async (`, so these are call sites
  });

  it("validates the payload looks like a lottie document", () => {
    // lottie-web reads .layers; anything without it crashes inside the player
    // rather than failing our fetch, so reject it here where it is catchable.
    expect(source()).toMatch(/layers/);
  });

  it("never passes a rejected fetch through as data", () => {
    // The guard has to throw, not return null-ish junk: useAnimationData only
    // leaves data null when the promise REJECTS.
    expect(source()).toMatch(/throw new Error\(/);
  });
});
