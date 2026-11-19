import { afterEach, describe, expect, it, vi } from "vitest";

import { buildCsp } from "./proxy";

/**
 * Regression for the ALGI report of 2026-09-23: the meeting video player
 * rendered a blank 0:00 <video> because the CSP media-src only allowed
 * 'self' and blob:, while Recall's mixed-video download URLs live on
 * regional S3 hosts (e.g. eu-central-1-recallai-production-bot-data.s3
 * .amazonaws.com) and the deployment's own presigned URLs live on the
 * COMPANION_S3_ENDPOINT origin. Same directive also gated the local-copy
 * video and the Whisper-upload <audio> preview.
 */
function mediaSrc(csp: string): string {
  const directive = csp
    .split("; ")
    .find((d) => d.startsWith("media-src "));
  if (!directive) throw new Error("media-src directive missing");
  return directive.slice("media-src ".length);
}

describe("buildCsp media-src", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps 'self' and blob: (chat TTS plays object URLs)", () => {
    vi.stubEnv("COMPANION_S3_ENDPOINT", "https://minio.api.example.com");
    const sources = mediaSrc(buildCsp()).split(" ");
    expect(sources).toContain("'self'");
    expect(sources).toContain("blob:");
  });

  it("allows the deployment's S3 origin so presigned audio/video can play", () => {
    vi.stubEnv("COMPANION_S3_ENDPOINT", "https://minio.api.example.com/some/path");
    expect(mediaSrc(buildCsp()).split(" ")).toContain("https://minio.api.example.com");
  });

  it("allows Recall's regional S3 buckets for on-demand meeting video", () => {
    vi.stubEnv("COMPANION_S3_ENDPOINT", "https://minio.api.example.com");
    expect(mediaSrc(buildCsp()).split(" ")).toContain("https://*.amazonaws.com");
  });

  it("emits no empty token when COMPANION_S3_ENDPOINT is unset", () => {
    vi.stubEnv("COMPANION_S3_ENDPOINT", "");
    expect(mediaSrc(buildCsp())).toBe("'self' blob: https://*.amazonaws.com");
  });
});

/**
 * One deployment under several hostnames (lib/host-routing.ts holds the rules
 * and their unit tests). These run the proxy itself, because the parts that
 * went wrong on paper are the ones the rules cannot see: whether the query
 * survives a redirect, whether a rewrite still carries the CSP, and whether
 * ?lang= reaches a cookie before the page's own redirects drop it.
 */
describe("proxy host routing", () => {
  const HOSTS = {
    EXULU_PUBLIC_HOST: "newton.example.com",
    EXULU_INTERNAL_HOST: "newton-intern.example.com",
    EXULU_REDIRECT_HOSTS: "old-123.run.app",
  };

  const run = async (host: string, path: string, headers: Record<string, string> = {}) => {
    for (const [key, value] of Object.entries(HOSTS)) vi.stubEnv(key, value);
    const { NextRequest } = await import("next/server");
    const { default: proxy } = await import("./proxy");
    return proxy(new NextRequest(`https://${host}${path}`, { headers: { host, ...headers } }));
  };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rewrites the public root to the published agents and keeps the query", async () => {
    const res = await run("newton.example.com", "/?lang=en");
    expect(res.status).toBe(200);
    const rewrite = new URL(res.headers.get("x-middleware-rewrite")!);
    expect(rewrite.pathname).toBe("/public/agents");
    expect(rewrite.searchParams.get("lang")).toBe("en");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
  });

  it("writes ?lang= to the locale cookie so it survives the page's redirects", async () => {
    const res = await run("newton.example.com", "/?lang=en");
    expect(res.headers.get("set-cookie")).toMatch(/NEXT_LOCALE=en/);
    expect(res.headers.get("x-middleware-request-x-locale")).toBe("en");
  });

  it("does not set a cookie for an unsupported or absent language", async () => {
    expect((await run("newton.example.com", "/?lang=fr")).headers.get("set-cookie")).toBeNull();
    expect((await run("newton.example.com", "/public/agents")).headers.get("set-cookie")).toBeNull();
  });

  it("answers 404 for an internal route on the public host", async () => {
    for (const path of ["/login", "/chat", "/intern/agents", "/agents/edit/abc"]) {
      const res = await run("newton.example.com", path);
      expect(res.status).toBe(404);
      expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    }
  });

  it("is not talked out of the 404 by a forged X-Forwarded-Host", async () => {
    const res = await run("newton.example.com", "/chat", {
      "x-forwarded-host": "newton-intern.example.com",
    });
    expect(res.status).toBe(404);
  });

  it("serves the public surface with and without a trailing slash", async () => {
    for (const path of ["/public/agents", "/public/agents/"]) {
      const res = await run("newton.example.com", path);
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("serves the application on the internal host", async () => {
    const res = await run("newton-intern.example.com", "/chat");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("sends the public surface from the internal host to the public one", async () => {
    const res = await run("newton-intern.example.com", "/public/agents/abc?lang=en");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://newton.example.com/public/agents/abc?lang=en");
  });

  it("redirects a former hostname by path, keeping path and query", async () => {
    const guest = await run("old-123.run.app", "/public/agents/abc?session=s1");
    expect(guest.headers.get("location")).toBe(
      "https://newton.example.com/public/agents/abc?session=s1",
    );
    const staff = await run("old-123.run.app", "/chat/abc?x=1");
    expect(staff.headers.get("location")).toBe("https://newton-intern.example.com/chat/abc?x=1");
  });

  it("changes nothing when no public host is configured", async () => {
    vi.stubEnv("EXULU_PUBLIC_HOST", "");
    const { NextRequest } = await import("next/server");
    const { default: proxy } = await import("./proxy");
    const res = proxy(
      new NextRequest("https://anything.example.com/chat", { headers: { host: "anything.example.com" } }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
  });
});
