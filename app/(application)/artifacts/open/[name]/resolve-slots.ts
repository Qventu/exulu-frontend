/**
 * The agent panel's two pure server-side decisions: which slots the viewing
 * user may be offered at all, and which of them (with which conversation) the
 * URL opens. Both are `page.tsx`'s, and both are here so they can be tested
 * without a server component or a GraphQL harness — the I/O shell left in
 * `loadPanelData` needs neither.
 *
 * Part one: joining an artifact's stored agent slots to the agents the viewer
 * can actually reach.
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
import type { AgentSession } from "@/types/models/agent-session";

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
 * `agents` is the result of the RBAC-scoped agents query (`agentByIds` applies
 * access control like every other generic resolver), so an agent the viewer
 * cannot see is simply absent from it and the slot pointing at that agent is
 * dropped. That is the whole reachability rule, and it is a DROP, not an
 * error: an assignment the current user cannot reach degrades to "no agent is
 * offered here", exactly as the artifact sees it over the channel (the slot is
 * absent from `host.slots`, so the artifact hides its own trigger rather than
 * offering one that would fail).
 *
 * A deactivated agent is dropped too. The assignment UI only ever offers
 * active agents, so a slot pointing at an inactive one is an agent that was
 * switched off after it was assigned — and it is `=== false` rather than
 * falsy because the field is optional in this hand-maintained type and an
 * unselected field must not hide every agent.
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
    if (!agent || agent.active === false) continue;
    // The agent's current name, read at render time rather than stored with
    // the assignment: names are editable free text, and a stale copy in the
    // picker would be worse than none.
    resolved.push({ key: slot.key, label: agent.name, agent });
  }
  return resolved;
}

/** Which slot the URL opens, and whether the session it names may be used. */
export interface PanelChoice {
  /** The slot to open the panel on, or null to leave it closed. */
  initialSlotKey: string | null;
  /** Whether `session` belongs to that slot's agent and may be rendered. */
  keep: boolean;
}

/**
 * Part two: what `?agent=` and `?session=` add up to.
 *
 * `?agent=` addresses a slot by key. When it is absent the slot is found from
 * the session's own agent instead — the history rail's rows and the chat
 * controller's lazy-create `replaceState` both land on `?session=<id>` with no
 * `?agent=`, because every session in the panel lives at the same URL, so
 * without that fallback a reload of one of those URLs would close the panel.
 *
 * `keep` is Review Focus 4: a session is only ever rendered beside the agent
 * it belongs to. A session the viewer may not read never gets this far (the
 * query behind it is RBAC-scoped, so it arrives as null); this is the other
 * half, where the session is the user's own but belongs to a different agent
 * than the slot being opened.
 */
export function choosePanelState({
  slots,
  session,
  urlAgent,
}: {
  slots: ResolvedSlot[];
  /** Only the owning agent is read; the row itself stays in the caller. */
  session: Pick<AgentSession, "agent"> | null;
  urlAgent?: string;
}): PanelChoice {
  const addressed = urlAgent ? (slots.find((slot) => slot.key === urlAgent) ?? null) : null;
  const owner = session
    ? (slots.find((slot) => slot.agent.id === session.agent) ?? null)
    : null;
  const active = urlAgent ? addressed : owner;
  // Compared by AGENT, not by slot key. Two slots may legitimately point at
  // the same agent — the assignment UI rejects a duplicate KEY, not a
  // duplicate agent — and `owner` above is only the first of them, so a key
  // comparison would throw away the user's own conversation whenever it had
  // been started through the other slot. It is also the exact predicate the
  // viewer applies client-side, so one rule now has one expression on both
  // sides of the boundary instead of two that can disagree.
  const keep = session !== null && active !== null && active.agent.id === session.agent;
  return { initialSlotKey: active?.key ?? null, keep };
}
