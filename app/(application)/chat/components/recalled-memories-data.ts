/** Pure helpers for the "Recalled N memories" block (spec §2.5, §4.2). */
export type RecalledMemory = {
  id: string; contextId: string; title: string; information: string; type?: string;
  rights_mode: "private" | "users" | "roles" | "teams" | "public";
  createdBy: { id: number; name: string } | null;
  createdAt: string; updatedAt: string; source: "prefetch" | "knowledge_search";
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const isMemory = (v: unknown): v is RecalledMemory =>
  isRecord(v) && typeof v.id === "string" && typeof v.contextId === "string" && typeof v.information === "string" && typeof v.rights_mode === "string";

export function parseRecalledMemories(metadata: unknown): RecalledMemory[] {
  if (!isRecord(metadata) || !Array.isArray(metadata.recalledMemories)) return [];
  return metadata.recalledMemories.filter(isMemory);
}

/** Forget from chat is for the creator (or a super admin); others use Open. */
export function canForget(memory: RecalledMemory, userId: number | null | undefined, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  return !!memory.createdBy && typeof userId === "number" && memory.createdBy.id === userId;
}
