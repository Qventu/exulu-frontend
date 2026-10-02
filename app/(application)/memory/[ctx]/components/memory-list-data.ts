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
  usage?: string;
  [key: string]: string | number | undefined;
}

export function buildMemoryFilters(args: {
  search: string;
  mine: boolean;
  userId: number | null | undefined;
  filters: MemoryListFilters;
  ids?: string[];
}): Record<string, unknown>[] {
  const f: Record<string, unknown> = { archived: { eq: false } };
  const q = args.search.trim();
  // The server passes `contains` straight into a LIKE pattern, so the LIKE
  // wildcards (and the escape character itself) have to be escaped here or a
  // search for "100%" matches everything.
  if (q) f.information = { contains: q.replace(/[\\%_]/g, (m) => "\\" + m) };
  if (args.filters.visibility) f.rights_mode = { eq: args.filters.visibility };
  if (args.filters.type) f.type = { eq: args.filters.type };
  if (args.mine) {
    if (typeof args.userId === "number") f.created_by = { eq: args.userId };
  } else if (args.filters.creator) {
    f.created_by = { eq: Number(args.filters.creator) };
  }
  if (args.ids) f.id = { in: args.ids };
  return [f];
}

export function activeFilterCount(filters: MemoryListFilters): number {
  return ["visibility", "type", "creator", "usage"].filter((k) => !!filters[k]).length;
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

/** A row of `memoryBaseContributors`: the server already resolved the display name. */
export interface MemoryContributor { id: number; name: string }

export function creatorName(contributors: MemoryContributor[], id: number | null | undefined): string | null {
  if (typeof id !== "number") return null;
  return contributors.find((c) => Number(c.id) === id)?.name ?? null;
}

export type VisibilityKey = "public" | "private" | "users" | "roles" | "teams";

export function visibilityKey(mode: string | null | undefined): VisibilityKey {
  return mode === "public" || mode === "users" || mode === "roles" || mode === "teams" ? mode : "private";
}
