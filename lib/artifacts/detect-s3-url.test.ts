import { describe, test, expect } from "vitest";
import { isS3ArtifactUrl, extractS3Key } from "./detect-s3-url";

const ENDPOINT = "https://s3.test/bucket";

describe("isS3ArtifactUrl", () => {
  test("matches a url under the endpoint", () => {
    expect(isS3ArtifactUrl("https://s3.test/bucket/sessions/a/r.html", ENDPOINT)).toBe(true);
  });
  test("rejects a non-s3 url", () => {
    expect(isS3ArtifactUrl("https://example.com/x", ENDPOINT)).toBe(false);
  });
  test("rejects when endpoint is empty", () => {
    expect(isS3ArtifactUrl("https://s3.test/bucket/x", "")).toBe(false);
  });
  test("tolerates a non-url string", () => {
    expect(isS3ArtifactUrl("not a url", ENDPOINT)).toBe(false);
  });
});

describe("extractS3Key", () => {
  test("returns the path after the endpoint base", () => {
    expect(extractS3Key("https://s3.test/bucket/sessions/a/r.html", ENDPOINT)).toBe(
      "sessions/a/r.html",
    );
  });
  test("url-decodes segments", () => {
    expect(extractS3Key("https://s3.test/bucket/a%20b/r.pdf", ENDPOINT)).toBe("a b/r.pdf");
  });
  test("returns null for a non-s3 url", () => {
    expect(extractS3Key("https://example.com/x", ENDPOINT)).toBeNull();
  });
});
