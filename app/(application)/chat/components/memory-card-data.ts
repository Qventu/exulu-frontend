/**
 * Pure logic for the in-chat memory cards (backend spec
 * docs/superpowers/specs/2026-09-29-agent-memory-redesign-design.md §2.3–2.4, §4.1).
 * No React, no fetch — mirrors credential-request-data.ts.
 */
import type { DynamicToolUIPart } from "ai";

export const MEMORY_TOOL_PART_TYPES = {
  remember: "tool-memory_remember",
  update: "tool-memory_update",
  forget: "tool-memory_forget",
} as const;

export type MemoryKind = keyof typeof MEMORY_TOOL_PART_TYPES;
export type RightsMode = "private" | "users" | "roles" | "teams" | "public";
export type RbacGrant = { id: number | string; rights: "read" | "write" };

export type MemoryDecision =
  | { v: 1; kind: "remember"; title: string; information: string; type: string; rights_mode: RightsMode; rbac?: { users?: RbacGrant[]; roles?: RbacGrant[]; teams?: RbacGrant[] } }
  | { v: 1; kind: "update"; information?: string; title?: string; type?: string }
  | { v: 1; kind: "forget" };

export const DECLINED_REASON = "declined" as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export function memoryKind(part: { type?: string } | null | undefined): MemoryKind | null {
  const type = part?.type;
  for (const kind of Object.keys(MEMORY_TOOL_PART_TYPES) as MemoryKind[]) {
    if (MEMORY_TOOL_PART_TYPES[kind] === type) return kind;
  }
  return null;
}

export const isMemoryToolPart = (part: { type?: string } | null | undefined): boolean => memoryKind(part) !== null;

export const encodeMemoryDecision = (decision: MemoryDecision): string => JSON.stringify(decision);

export type MemoryProposal = {
  kind: MemoryKind;
  memoryId: string | null;
  title: string;
  information: string;
  type: string;
  whySaved: string;
  visibility: "private" | "public" | null;
};

export function memoryProposalFromPart(part: DynamicToolUIPart | Record<string, unknown>): MemoryProposal | null {
  const kind = memoryKind(part as { type?: string });
  const input = (part as { input?: unknown }).input;
  if (!kind || !isRecord(input)) return null;
  const str = (k: string) => (typeof input[k] === "string" ? (input[k] as string) : "");
  return {
    kind,
    memoryId: typeof input.memoryId === "string" ? input.memoryId : null,
    title: str("title"),
    information: str("information"),
    type: str("type"),
    whySaved: str("whySaved"),
    visibility: input.visibility === "public" || input.visibility === "private" ? input.visibility : null,
  };
}

export type ResolvedState =
  | { status: "pending" }
  | { status: "working" }
  | { status: "declined" }
  | { status: "saved" | "updated"; contextId: string; itemId: string; title: string; rights_mode: RightsMode }
  | { status: "forgotten"; contextId: string; itemId: string; title: string }
  | { status: "no_access"; createdBy: { id: number; name: string } | null }
  | { status: "error"; message: string };

export function memoryResolvedState(part: DynamicToolUIPart | Record<string, unknown>): ResolvedState {
  const p = part as Record<string, unknown>;
  const approval = isRecord(p.approval) ? p.approval : undefined;
  if (p.state === "approval-requested") return { status: "pending" };
  if (p.state === "approval-responded") return approval?.approved === false ? { status: "declined" } : { status: "working" };
  if (p.state === "output-error") return { status: "error", message: typeof p.errorText === "string" ? p.errorText : "error" };
  if (p.state === "output-available") {
    const out = isRecord(p.output) ? p.output : {};
    const str = (k: string) => (typeof out[k] === "string" ? (out[k] as string) : "");
    switch (out.type) {
      case "memory_saved":
        return { status: "saved", contextId: str("contextId"), itemId: str("itemId"), title: str("title"), rights_mode: (str("rights_mode") || "private") as RightsMode };
      case "memory_updated":
        return { status: "updated", contextId: str("contextId"), itemId: str("itemId"), title: str("title"), rights_mode: (str("rights_mode") || "private") as RightsMode };
      case "memory_forgotten":
        return { status: "forgotten", contextId: str("contextId"), itemId: str("itemId"), title: str("title") };
      case "memory_no_access":
        return { status: "no_access", createdBy: isRecord(out.createdBy) ? { id: Number(out.createdBy.id), name: String(out.createdBy.name ?? "") } : null };
      case "memory_error":
        return { status: "error", message: str("message") || "error" };
      default:
        return { status: "error", message: "unexpected memory result" };
    }
  }
  if (approval?.approved === false) return { status: "declined" };
  return { status: "working" };
}

export type RememberGroup = { kind: "single"; index: number } | { kind: "stack"; indices: number[] };

/** Consecutive pending `memory_remember` approvals render under one "Save all" bar (spec §4.1). */
export function groupRememberParts(parts: ReadonlyArray<Record<string, unknown>>): RememberGroup[] {
  const groups: RememberGroup[] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length > 1) groups.push({ kind: "stack", indices: run });
    else if (run.length === 1) groups.push({ kind: "single", index: run[0]! });
    run = [];
  };
  parts.forEach((part, index) => {
    const kind = memoryKind(part as { type?: string });
    if (!kind) { flush(); return; }
    const pending = kind === "remember" && memoryResolvedState(part).status === "pending";
    if (pending) { run.push(index); return; }
    flush();
    groups.push({ kind: "single", index });
  });
  flush();
  return groups;
}
