import type { Agent } from "@/types/models/agent";
import type { AgentSession } from "@/types/models/agent-session";
import type { Context } from "@/types/models/context";
import type { Item } from "@/types/models/item";

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
}
