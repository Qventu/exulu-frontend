import { describe, expect, it } from "vitest";

import { contentText } from "./content";
import { DEMO_SCENES, sceneRoute } from "./scenes";

describe("demo scenes", () => {
  // The four steps that used to render full-bleed. Their ids are the step ids
  // they replace, so a reader can trace a scene back to the beat it serves.
  it.each(["daten-pile", "daten-problem", "aufnahme-page", "zugriff-consequence"])(
    "has a scene for %s",
    (id) => {
      expect(DEMO_SCENES[id], id).toBeDefined();
      expect(DEMO_SCENES[id].title.length).toBeGreaterThan(0);
      expect(DEMO_SCENES[id].content.length).toBeGreaterThan(0);
    },
  );

  it("carries real copy, not placeholders", () => {
    for (const [id, scene] of Object.entries(DEMO_SCENES)) {
      expect(contentText(scene.content).length, id).toBeGreaterThan(40);
      expect(contentText(scene.content), id).not.toMatch(/lorem|TODO|TBD/i);
    }
  });

  it("builds a route under the demo scene path", () => {
    expect(sceneRoute("daten-pile")).toBe("/demo/szene/daten-pile");
  });
});
