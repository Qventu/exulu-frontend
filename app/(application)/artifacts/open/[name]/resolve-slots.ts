/**
 * Joining an artifact's stored agent slots to the agents the viewer can
 * actually reach.
 *
 * Three slot shapes exist on purpose:
 *   - `AgentSlot { key, agentId }` is what is stored and what crosses the wire
 *     from `GET /shared-artifacts/:name/panel`;
 *   - `PanelSlot { key, label }` (lib/artifacts/agent-panel-protocol.ts) is
 *     what crosses the channel into the sandboxed artifact — agent ids never
 *     go there;
 *   - `ResolvedSlot { key, label, agent }` is this page's internal join. It
 *     carries the whole `Agent` because `AgentPanel` hands it to both
 *     `SessionScreen` and `HistoryRail`; resolving it again client-side would
 *     re-fetch data the page already holds.
 *
 * Its own module rather than a helper inside `viewer-client.tsx` because the
 * server page needs it: everything exported from a `"use client"` module is a
 * client reference when a server component imports it, so a plain function
 * living there could not be CALLED during the render that needs it.
 */

import type { AgentSlot } from "@/lib/api/shared-artifacts";
import type { Agent } from "@/types/models/agent";

/** One assigned slot, joined to the agent it points at. */
export interface ResolvedSlot {
  key: string;
  label: string;
  agent: Agent;
}

/**
 * The slots the viewer may actually be offered, in the order their owner put
 * them in.
 *
 * `agents` is the result of the RBAC-scoped agents query, so an agent the
 * viewer cannot see is simply absent from it and the slot pointing at that
 * agent is dropped. That is the whole reachability rule, and it is a DROP, not
 * an error: an assignment the current user cannot reach degrades to "no agent
 * is offered here", exactly as the artifact sees it over the channel (the slot
 * is absent from `host.slots`, so the artifact hides its own trigger rather
 * than offering one that would fail).
 *
 * The stored column is json, so a row written before validation existed can
 * hold anything; a slot without both a key and an agent id is dropped for the
 * same reason.
 */
export function resolveSlots(slots: AgentSlot[], agents: Agent[]): ResolvedSlot[] {
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const resolved: ResolvedSlot[] = [];
  for (const slot of slots ?? []) {
    if (!slot?.key || !slot?.agentId) continue;
    const agent = byId.get(slot.agentId);
    if (!agent) continue;
    // The agent's current name, read at render time rather than stored with
    // the assignment: names are editable free text, and a stale copy in the
    // picker would be worse than none.
    resolved.push({ key: slot.key, label: agent.name, agent });
  }
  return resolved;
}
