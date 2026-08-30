import type { TourPosition } from "../tour";
import type { DemoWorld } from "../types";
import { ingestionWorld } from "./chapter-ingestion";
import { memoryWorld } from "./chapter-memory";
import { DEMO_AGENT_ID, DEMO_AGENT_SLUG, techdocWorld } from "./chapter-techdoc";

export { DEMO_AGENT_ID, DEMO_AGENT_SLUG };

/** Deep clone so a caller mutating the returned world cannot poison later reads. */
function clone(world: DemoWorld): DemoWorld {
  return structuredClone(world);
}

export function getWorld(pos: TourPosition): DemoWorld {
  // Stamped onto the world so resolvers can reach the step they were built
  // for. They are handed the world and the operation's variables, and neither
  // carries it; the alternative — reading the module-level current position —
  // is wrong on the server, where nothing writes it.
  const at = (world: DemoWorld): DemoWorld => ({ ...clone(world), position: pos });

  switch (pos.chapter) {
    case "techdoc":
      return at(techdocWorld(pos.step));
    case "ingestion":
      return at(ingestionWorld(pos.step));
    case "memory":
      return at(memoryWorld(pos.step));
    // The remaining chapters reuse chapter 1's world until their own plans
    // land, so the shell always has a coherent application behind every step.
    default:
      return at(techdocWorld(0));
  }
}
