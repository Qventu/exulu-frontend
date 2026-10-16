import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * NEXT_PUBLIC_DEMO_MODE is inlined into the browser bundle at BUILD time
 * (lib/demo/flag.ts). A Docker image built without it and run with it gives a
 * half demo: server components (layout, locale, tour chrome) say demo, the
 * browser code says product — "AI Studio" after hydration, the full nav, and
 * "No valid session token available." on every REST-driven screen. Exactly
 * what imp-demo.ai.open.de showed on 2026-10-16. The build arg has to reach
 * `npm run build`, and the runner stage carries the same value so one arg
 * configures both layers.
 */
describe("Dockerfile demo flag", () => {
  const dockerfile = readFileSync("Dockerfile", "utf8");
  const stage = (name: string) => {
    const start = dockerfile.indexOf(`AS ${name}`);
    const next = dockerfile.indexOf("\nFROM ", start + 1);
    return dockerfile.slice(start, next === -1 ? undefined : next);
  };

  it("takes NEXT_PUBLIC_DEMO_MODE as a build arg into the builder stage, before the build", () => {
    const builder = stage("builder");
    const arg = builder.indexOf("ARG NEXT_PUBLIC_DEMO_MODE");
    const env = builder.indexOf("ENV NEXT_PUBLIC_DEMO_MODE=${NEXT_PUBLIC_DEMO_MODE}");
    const build = builder.indexOf("RUN npm run build");
    expect(arg).toBeGreaterThan(-1);
    expect(env).toBeGreaterThan(arg);
    expect(build).toBeGreaterThan(env);
  });

  it("carries the same value into the runner stage, so the server agrees with the bundle", () => {
    const runner = stage("runner");
    expect(runner).toContain("ARG NEXT_PUBLIC_DEMO_MODE");
    expect(runner).toContain("ENV NEXT_PUBLIC_DEMO_MODE=${NEXT_PUBLIC_DEMO_MODE}");
  });

  it("defaults to unset, so a product image never serves the demo", () => {
    expect(dockerfile).not.toMatch(/ARG NEXT_PUBLIC_DEMO_MODE=/);
  });
});
