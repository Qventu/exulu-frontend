/** Pure helpers for usage display (spec §4.4). */

export interface UsageSummary { memoryId?: string; count: number; lastUsedAt: string | null }
export interface UsageEntry {
  sessionId: string | null; messageId: string; usedAt: string;
  agent: { id: string; name: string } | null; user: { id: number; name: string } | null; title: string | null;
}
export interface BaseUsage {
  used: number; neverUsed: number; stale: number;
  mostUsed: { id: string; information: string; count: number; lastUsedAt: string | null }[];
  newPerWeek: { weekStart: string; count: number }[];
}

export type UsageLabel = { kind: "never" } | { kind: "used"; count: number; lastUsedAt: string | null };

export function usageLabel(summary: Pick<UsageSummary, "count" | "lastUsedAt"> | undefined): UsageLabel {
  if (!summary || summary.count <= 0) return { kind: "never" };
  return { kind: "used", count: summary.count, lastUsedAt: summary.lastUsedAt };
}

export function unusedFilterToMode(value: string | undefined): "NEVER" | "STALE" | null {
  if (value === "never") return "NEVER";
  if (value === "stale") return "STALE";
  return null;
}

export function weekBars(buckets: { weekStart: string; count: number }[]) {
  const max = Math.max(0, ...buckets.map((b) => b.count));
  return buckets.map((b) => {
    const [, m, d] = b.weekStart.split("-");
    return { ...b, height: max > 0 ? Math.round((b.count / max) * 100) : 0, label: `${d}.${m}.` };
  });
}

export function usageEntryLabel(entry: Pick<UsageEntry, "agent" | "user">, guestLabel: string, unknownLabel: string): string {
  return `${entry.agent?.name ?? unknownLabel} · ${entry.user?.name ?? guestLabel}`;
}
