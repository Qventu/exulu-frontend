/** Pure helpers for the memory detail page (spec §4.4). */
import type { MemoryItem } from "../../components/memory-list-data";

const QUOTE_MAX = 280;

/** First user turn of the source session, as a short quote; null when there is none. */
export function sourceQuote(messages: { content: string }[]): string | null {
  for (const m of messages) {
    let parsed: { role?: string; parts?: { type?: string; text?: string }[]; content?: unknown };
    try { parsed = JSON.parse(m.content); } catch { continue; }
    if (parsed?.role !== "user") continue;
    const text = Array.isArray(parsed.parts)
      ? parsed.parts.filter((p) => p?.type === "text" && typeof p.text === "string").map((p) => p.text).join(" ")
      : typeof parsed.content === "string" ? parsed.content : "";
    const trimmed = text.trim();
    if (!trimmed) continue;
    return trimmed.length > QUOTE_MAX ? `${trimmed.slice(0, QUOTE_MAX - 1)}…` : trimmed;
  }
  return null;
}

export interface Viewer { id?: number | null; super_admin?: boolean | null }

/** Same rule as the chat's forget/update: creator, super admin, or an explicit write grant. */
export function detailActions(item: Pick<MemoryItem, "created_by" | "rights_mode" | "RBAC">, user: Viewer | undefined) {
  const id = user?.id;
  const isCreator = typeof id === "number" && item.created_by === id;
  const hasWrite = typeof id === "number" && !!item.RBAC?.users?.some((u) => String(u.id) === String(id) && u.rights === "write");
  const canEdit = !!user?.super_admin || isCreator || hasWrite;
  return { canEdit, canMakePrivate: canEdit && item.rights_mode !== "private", canDelete: canEdit };
}
