import { describe, test, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";

describe("/manifest.webmanifest", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("BACKEND", "http://backend.test");
  });

  test("serves the manifest content type", async () => {
    const res = await GET();
    expect(res.headers.get("Content-Type")).toBe("application/manifest+json");
  });

  test("points the icon at the backend favicon", async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.icons).toEqual([
      {
        src: "http://backend.test/favicon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ]);
  });

  test("uses APP_NAME for name and short_name", async () => {
    vi.stubEnv("APP_NAME", "Acme Agents");
    const res = await GET();
    const json = await res.json();
    expect(json.name).toBe("Acme Agents");
    expect(json.short_name).toBe("Acme Agents");
  });

  test("defaults the name to IMP when APP_NAME is unset", async () => {
    vi.stubEnv("APP_NAME", undefined);
    const res = await GET();
    const json = await res.json();
    expect(json.name).toBe("IMP");
    expect(json.short_name).toBe("IMP");
  });

  test("is installable: standalone display and root start_url", async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.display).toBe("standalone");
    expect(json.start_url).toBe("/");
  });
});
