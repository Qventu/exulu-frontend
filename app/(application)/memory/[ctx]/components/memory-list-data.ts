/** Pure helpers for the per-base memory list (spec §4.3). */

export interface MemoryContextField { name: string; type: string; enumValues?: string[] | null }
export interface MemoryContext {
  id: string;
  name: string;
  description?: string | null;
  fields?: MemoryContextField[] | null;
  configuration?: { defaultRightsMode?: string } | null;
  memoryBase?: { ok: boolean; missing: string[] } | null;
}

export interface MemoryItem {
  id: string;
  name?: string | null;
  information?: string | null;
  type?: string | null;
  description?: string | null;
  rights_mode?: string | null;
  created_by?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  source_session?: string | null;
  RBAC?: { type?: string | null; users?: { id: string; rights: string }[] | null; roles?: { id: string; rights: string }[] | null } | null;
}

export interface MemoryListFilters {
  visibility?: string;
  type?: string;
  creator?: string;
  [key: string]: string | number | undefined;
}

export function buildMemoryFilters(args: {
  search: string;
  mine: boolean;
  userId: number | null | undefined;
  filters: MemoryListFilters;
}): Record<string, unknown>[] {
  const f: Record<string, unknown> = { archived: { eq: false } };
  const q = args.search.trim();
  if (q) f.information = { contains: q };
  if (args.filters.visibility) f.rights_mode = { eq: args.filters.visibility };
  if (args.filters.type) f.type = { eq: args.filters.type };
  if (args.mine) {
    if (typeof args.userId === "number") f.created_by = { eq: args.userId };
  } else if (args.filters.creator) {
    f.created_by = { eq: Number(args.filters.creator) };
  }
  return [f];
}

export function activeFilterCount(filters: MemoryListFilters): number {
  return ["visibility", "type", "creator"].filter((k) => !!filters[k]).length;
}

export function memoryTypeOptions(context: Pick<MemoryContext, "fields">): string[] {
  const type = context.fields?.find((f) => f.name === "type");
  if (!type || type.type !== "enum") return [];
  return [...(type.enumValues ?? [])];
}

export function hasSourceSession(context: Pick<MemoryContext, "fields">): boolean {
  const f = context.fields?.find((x) => x.name === "source_session");
  return !!f && (f.type === "text" || f.type === "longText");
}

export function creatorIds(items: Pick<MemoryItem, "id" | "created_by">[]): number[] {
  return [...new Set(items.map((i) => i.created_by).filter((x): x is number => typeof x === "number"))];
}

export interface UserName { id: number; firstname?: string | null; lastname?: string | null; email?: string | null }

export function creatorName(users: UserName[], id: number | null | undefined): string | null {
  if (typeof id !== "number") return null;
  const u = users.find((x) => Number(x.id) === id);
  if (!u) return null;
  const full = [u.firstname, u.lastname].filter(Boolean).join(" ").trim();
  return full || u.email || null;
}

export type VisibilityKey = "public" | "private" | "users" | "roles" | "teams";

export function visibilityKey(mode: string | null | undefined): VisibilityKey {
  return mode === "public" || mode === "users" || mode === "roles" || mode === "teams" ? mode : "private";
}
