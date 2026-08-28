import type { TourPosition } from "../tour";
import type { DemoWorld } from "../types";
import { memoryWorld } from "./chapter-memory";
import { DEMO_AGENT_ID, DEMO_AGENT_SLUG, techdocWorld } from "./chapter-techdoc";

export { DEMO_AGENT_ID, DEMO_AGENT_SLUG };

/** Deep clone so a caller mutating the returned world cannot poison later reads. */
function clone(world: DemoWorld): DemoWorld {
  return structuredClone(world);
}

export function getWorld(pos: TourPosition): DemoWorld {
  switch (pos.chapter) {
    case "techdoc":
      return clone(techdocWorld(pos.step));
    case "memory":
      return clone(memoryWorld(pos.step));
    // The remaining chapters reuse chapter 1's world until their own plans
    // land, so the shell always has a coherent application behind every step.
    default:
      return clone(techdocWorld(0));
  }
}
