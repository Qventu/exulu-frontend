import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The demo is deployed from a prebuilt image (Dokploy pulls
 * ghcr.io/qventu/exulu-frontend:<tag>), so the build arg from the Dockerfile
 * has to be supplied by the workflow that publishes images — in a SECOND
 * image, suffixed -demo, never in the product image customers pull.
 */
describe("release workflow publishes a -demo image", () => {
  const workflow = readFileSync(".github/workflows/release-blacksmith.yml", "utf8");
  const steps = workflow.split(/\n {6}- name: /).slice(1);
  const step = (prefix: string) => steps.find((s) => s.startsWith(prefix)) ?? "";

  it("builds the demo image from the same Dockerfile with NEXT_PUBLIC_DEMO_MODE=true", () => {
    const demo = step("Build and push the demo image");
    expect(demo).toContain("uses: useblacksmith/build-push-action@v2");
    expect(demo).toMatch(/build-args: \|\n\s+NEXT_PUBLIC_DEMO_MODE=true/);
    expect(demo).toContain("tags: ${{ steps.meta-demo.outputs.tags }}");
  });

  it("tags it with a -demo suffix on the same image name, so a product tag can never be the demo", () => {
    const meta = step("Extract Docker metadata for the demo image");
    expect(meta).toContain("id: meta-demo");
    expect(meta).toMatch(/flavor: \|\n\s+suffix=-demo/);
    expect(meta).toContain("images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}");
  });

  it("leaves the product image without the flag", () => {
    const product = step("Build and push Docker image");
    expect(product).toContain("id: build-and-push");
    expect(product).not.toContain("NEXT_PUBLIC_DEMO_MODE");
  });

  it("signs the demo image like the product image", () => {
    const sign = step("Sign the published demo image");
    expect(sign).toContain("steps.meta-demo.outputs.tags");
    expect(sign).toContain("steps.build-and-push-demo.outputs.digest");
    expect(sign).toContain("cosign sign --yes");
  });
});
