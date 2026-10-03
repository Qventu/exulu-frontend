/** Pure helpers for the Conflicts page (spec §5.3). */

export interface ConflictMember { id: string; information: string; type: string | null; author: { id: number; name: string } | null; createdAt: string; usedCount: number }
export interface Conflict {
  id: string; kind: "duplicate" | "contradiction" | string; status: string; similarity: number; reason: string | null;
  members: ConflictMember[]; scannedAt: string; resolvedAt: string | null; resolution: string | null; mergedInto: string | null;
}
export interface Viewer { id?: number | null; super_admin?: boolean | null }

export function groupTitle(group: Conflict): { kind: string; count: number } {
  return { kind: group.kind, count: group.members.length };
}

/**
 * Mirrors the server rule the client can see: super admin, or author of every
 * member (write grants are checked server-side). `unknownLabel` names a member
 * whose author the viewer cannot see, so the blocked line stays a sentence.
 */
export function canResolve(group: Conflict, user: Viewer | undefined, unknownLabel: string): { keep: boolean; merge: boolean; dismiss: boolean; blockedBy: string | null } {
  const none = { keep: false, merge: false, dismiss: false, blockedBy: null as string | null };
  if (!user?.id) return none;
  if (!user.super_admin) {
    const foreign = group.members.find((m) => m.author?.id !== user.id);
    if (foreign) return { ...none, blockedBy: foreign.author?.name ?? unknownLabel };
  }
  return { keep: true, merge: group.kind === "duplicate", dismiss: true, blockedBy: null };
}

export function commonType(members: Pick<ConflictMember, "type">[]): string | null {
  const counts = new Map<string, number>();
  for (const m of members) if (m.type) counts.set(m.type, (counts.get(m.type) ?? 0) + 1);
  if (counts.size === 0) return null;
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return null;
  return sorted[0][0];
}

/** Unjudged and skipped pairs are both work left for the next scan, so both ask for a rerun. */
export function scanToastKey(result: { open: number; unjudged: number; skipped: number }): "scanDone" | "scanDoneUnjudged" {
  return result.unjudged > 0 || result.skipped > 0 ? "scanDoneUnjudged" : "scanDone";
}

export function memberLine(member: Pick<ConflictMember, "type" | "author">, unknownLabel: string): string {
  const parts = [member.type, member.author?.name].filter((x): x is string => !!x);
  return parts.length ? parts.join(" · ") : unknownLabel;
}
