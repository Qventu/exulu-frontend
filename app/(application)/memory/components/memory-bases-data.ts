/** Pure helpers for the /memory overview (spec §4.2). No React, no Apollo. */

export interface MemoryBaseStats {
  total: number;
  public: number;
  private: number;
  contributors: number;
  visible: number;
  lastSavedAt: string | null;
  lastSavedBy: { id: number; name: string } | null;
}

export interface MemoryBase {
  id: string;
  name: string;
  description: string | null;
  valid: boolean;
  missing: string[];
  missingFromCode: boolean;
  agents: { id: string; name: string }[];
  stats: MemoryBaseStats | null;
}

export type BaseFilterMode = "all" | "inUse" | "unused";
export type BaseState = "inUse" | "unused" | "invalid" | "missingFromCode";

export function baseState(base: MemoryBase): BaseState {
  if (base.missingFromCode) return "missingFromCode";
  if (!base.valid) return "invalid";
  return base.agents.length > 0 ? "inUse" : "unused";
}

export function filterBases(bases: MemoryBase[], search: string, mode: BaseFilterMode): MemoryBase[] {
  const q = search.trim().toLowerCase();
  return bases.filter((b) => {
    if (mode === "inUse" && b.agents.length === 0) return false;
    if (mode === "unused" && (b.agents.length > 0 || !b.valid)) return false;
    if (!q) return true;
    return b.name.toLowerCase().includes(q) || b.agents.some((a) => a.name.toLowerCase().includes(q));
  });
}

export function overviewTotals(bases: MemoryBase[], agentCount: number) {
  const agentIds = new Set(bases.flatMap((b) => b.agents.map((a) => a.id)));
  return {
    bases: bases.filter((b) => b.valid).length,
    agentsWithMemory: agentIds.size,
    agentCount,
    memories: bases.reduce((s, b) => s + (b.stats?.total ?? 0), 0),
    contributors: bases.reduce((s, b) => s + (b.stats?.contributors ?? 0), 0),
  };
}

export type BaseSubtitle =
  | { kind: "description"; text: string }
  | { kind: "createdWith"; agent: string }
  | { kind: "none" };

export function baseSubtitle(base: MemoryBase): BaseSubtitle {
  const text = base.description?.trim();
  if (text) return { kind: "description", text };
  if (base.agents.length === 1) return { kind: "createdWith", agent: base.agents[0].name };
  return { kind: "none" };
}
