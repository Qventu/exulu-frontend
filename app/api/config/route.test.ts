import { describe, test, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";

describe("/api/config", () => {
  beforeEach(() => {
    vi.stubEnv("BACKEND", "http://backend.test");
    vi.stubEnv("COMPANION_S3_ENDPOINT", "https://s3.test/bucket");
  });

  test("includes s3_endpoint from COMPANION_S3_ENDPOINT", async () => {
    const res = await GET(new Request("http://localhost/api/config"));
    const json = await res.json();
    expect(json.s3_endpoint).toBe("https://s3.test/bucket");
  });
});
