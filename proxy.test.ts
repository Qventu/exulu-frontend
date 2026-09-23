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
