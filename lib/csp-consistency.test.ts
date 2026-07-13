import { describe, test, expect } from "vitest";
import { evaluateS3CspConfig } from "./csp-consistency";

describe("evaluateS3CspConfig", () => {
  test("no warning when backend has no S3 endpoint (uploads are optional)", () => {
    expect(evaluateS3CspConfig(undefined, undefined)).toBeNull();
    // Frontend var set but backend has no uploads configured — harmless.
    expect(evaluateS3CspConfig(undefined, "https://s3.test")).toBeNull();
  });

  test("no warning when origins match", () => {
    expect(
      evaluateS3CspConfig("https://s3.test", "https://s3.test"),
    ).toBeNull();
    // Same origin, different paths still match.
    expect(
      evaluateS3CspConfig("https://s3.test/bucket", "https://s3.test"),
    ).toBeNull();
  });

  test("warns when frontend endpoint is missing", () => {
    const warning = evaluateS3CspConfig("https://s3.test", undefined);
    expect(warning).toContain("COMPANION_S3_ENDPOINT is not set");
    expect(warning).toContain("https://s3.test");
  });

  test("warns when frontend endpoint is an invalid URL", () => {
    const warning = evaluateS3CspConfig("https://s3.test", "not-a-url");
    expect(warning).toContain("COMPANION_S3_ENDPOINT is not set");
  });

  test("warns when origins differ", () => {
    const warning = evaluateS3CspConfig(
      "https://s3.prod.test",
      "https://s3.staging.test",
    );
    expect(warning).toContain("https://s3.prod.test");
    expect(warning).toContain("https://s3.staging.test");
    expect(warning).toContain("wrong origin");
  });

  test("treats invalid backend endpoint as not configured", () => {
    expect(evaluateS3CspConfig("not-a-url", undefined)).toBeNull();
  });
});
