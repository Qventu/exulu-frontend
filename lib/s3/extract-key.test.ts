import { describe, expect, it } from "vitest";

import { extractS3KeyFromUrl } from "@/lib/s3/extract-key";

describe("extractS3KeyFromUrl", () => {
  it("re-prepends the bucket for AWS virtual-hosted URLs", () => {
    expect(
      extractS3KeyFromUrl(
        "https://mybucket.s3.eu-central-1.amazonaws.com/user_1/abc-_EXULU_report.pdf?X-Amz-Signature=xyz",
      ),
    ).toBe("mybucket/user_1/abc-_EXULU_report.pdf");
  });

  it("returns the decoded pathname for path-style endpoints (MinIO/custom)", () => {
    expect(
      extractS3KeyFromUrl(
        "https://api.s3.exulu.com/exulu/user_1/abc-_EXULU_my%20file.pdf?X-Amz-Signature=xyz",
      ),
    ).toBe("exulu/user_1/abc-_EXULU_my file.pdf");
  });

  it("does not treat a custom host with s3 in the name as virtual-hosted", () => {
    expect(extractS3KeyFromUrl("https://api.s3.exulu.com/bucket/key.png")).toBe(
      "bucket/key.png",
    );
  });

  it("falls back to the last URL segment when parsing fails", () => {
    expect(extractS3KeyFromUrl("not a url/last-bit")).toBe("last-bit");
  });
});
