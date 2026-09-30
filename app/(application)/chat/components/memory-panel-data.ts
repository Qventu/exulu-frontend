/**
 * Pure helpers for the "What <agent> remembers" panel (spec 2026-09-29
 * agent-memory-redesign, Task 13, §4.3). Kept dependency-free (no Apollo, no
 * i18n) so they stay unit-testable without a provider tree.
 */

import type { UIMessage } from "ai";

export type MyMemory = { id: string; name: string; information: string; type?: string | null; rights_mode: string; created_by: number | null; createdAt: string };

export function splitByVisibility(items: MyMemory[]): { privateItems: MyMemory[]; publicItems: MyMemory[] } {
  return {
    privateItems: items.filter((i) => i.rights_mode === "private"),
    publicItems: items.filter((i) => i.rights_mode !== "private"),
  };
}

/** Ids saved through remember cards in the open session → "New" badge. */
export function savedIdsFromMessages(messages: UIMessage[]): Set<string> {
  const ids = new Set<string>();
  for (const m of messages) {
    for (const part of (m.parts ?? []) as any[]) {
      if (part?.type === "tool-memory_remember" && part?.state === "output-available" && part?.output?.type === "memory_saved" && typeof part.output.itemId === "string") ids.add(part.output.itemId);
    }
  }
  return ids;
}
