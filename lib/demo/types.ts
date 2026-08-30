import type { Agent } from "@/types/models/agent";
import type { AgentSession } from "@/types/models/agent-session";
import type { Context } from "@/types/models/context";
import type { Item } from "@/types/models/item";
import type { TourPosition } from "./tour";

/**
 * The complete scripted world at one tour step.
 *
 * Every field is fully specified at every step — never a delta over the
 * previous step. The Tour bubble lets a visitor jump straight to chapter 6,
 * and accumulated state would land them in an incoherent application.
 */
export interface DemoWorld {
  agents: Agent[];
  contexts: Context[];
  items: Item[];
  sessions: AgentSession[];
  /**
   * Items belonging to a specific knowledge base, keyed by context id, for the
   * per-context `<ctx>Pagination` / `<ctx>ById` operations behind /data/[ctx].
   * `items` stays the flat default for contexts with no entry here.
   */
  itemsByContext?: Record<string, Item[]>;
  /**
   * The position this world was built for.
   *
   * Resolvers receive the world, not the position, and some of them need the
   * step: chapter 5's scrollback carries the correction exchange only from the
   * step that narrates it. Reading the module-level getCurrentPosition()
   * instead would be wrong on the server, where nothing ever writes it.
   */
  position?: TourPosition;
}
