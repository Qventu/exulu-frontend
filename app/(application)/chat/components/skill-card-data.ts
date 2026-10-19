/**
 * Pure helpers for the skill-authoring card: which tool parts it owns, what
 * the model proposed, what the tool returned, and the decision the card
 * sends back inside the approval response (the backend's
 * src/exulu/skills/decisions.ts is the other half of this contract).
 */
import type { DynamicToolUIPart } from "ai";

import type { Agent } from "@/types/models/agent";

import type { RbacGrant, RightsMode } from "./memory-card-data";

export const SKILL_TOOL_PART_TYPES = { create: "tool-skill_create", update: "tool-skill_update" } as const;
export type SkillKind = keyof typeof SKILL_TOOL_PART_TYPES;

export type SkillDecision =
  | { v: 1; kind: "create"; name: string; description: string; rights_mode: RightsMode; rbac?: { users?: RbacGrant[]; roles?: RbacGrant[]; teams?: RbacGrant[] }; enableOnAgent?: boolean }
  | { v: 1; kind: "update"; label?: string; description?: string; enableOnAgent?: boolean };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export function skillKind(part: { type?: string } | null | undefined): SkillKind | null {
  const type = part?.type;
  for (const kind of Object.keys(SKILL_TOOL_PART_TYPES) as SkillKind[]) {
    if (SKILL_TOOL_PART_TYPES[kind] === type) return kind;
  }
  return null;
}
export const isSkillToolPart = (part: { type?: string } | null | undefined): boolean => skillKind(part) !== null;
export const encodeSkillDecision = (decision: SkillDecision): string => JSON.stringify(decision);

export type SkillProposal = {
  kind: SkillKind;
  /** create: the proposed name; update: the referenced skill (name or id). */
  name: string;
  description: string;
  files: Array<{ path: string; bytes: number }>;
  deletePaths: string[];
  label: string;
};

export function skillProposalFromPart(part: DynamicToolUIPart | Record<string, unknown>): SkillProposal | null {
  const kind = skillKind(part as { type?: string });
  const input = (part as { input?: unknown }).input;
  if (!kind || !isRecord(input)) return null;
  const str = (k: string) => (typeof input[k] === "string" ? (input[k] as string) : "");
  const files = Array.isArray(input.files)
    ? (input.files as unknown[]).filter(isRecord).map((f) => ({ path: String(f.path ?? ""), bytes: typeof f.content === "string" ? new TextEncoder().encode(f.content).length : 0 }))
    : [];
  const deletePaths = Array.isArray(input.deletePaths) ? (input.deletePaths as unknown[]).filter((p): p is string => typeof p === "string") : [];
  return { kind, name: kind === "create" ? str("name") : str("skill"), description: str("description"), files, deletePaths, label: str("label") };
}

export type SkillResolvedState =
  | { status: "pending" }
  | { status: "working" }
  | { status: "declined" }
  | { status: "created" | "updated"; skillId: string; name: string; version: number; rights_mode: RightsMode; enableOnAgent: boolean }
  | { status: "no_access"; skill: string }
  | { status: "error"; message: string };

export function skillResolvedState(part: DynamicToolUIPart | Record<string, unknown>): SkillResolvedState {
  const p = part as Record<string, unknown>;
  const approval = isRecord(p.approval) ? p.approval : undefined;
  if (p.state === "approval-requested") return { status: "pending" };
  if (p.state === "approval-responded" || p.state === "input-available" || p.state === "input-streaming") {
    if (approval && approval.approved === false) return { status: "declined" };
    return { status: "working" };
  }
  if (p.state === "output-denied") return { status: "declined" };
  if (p.state === "output-error") return { status: "error", message: String(p.errorText ?? "") };
  const output = isRecord(p.output) ? p.output : undefined;
  if (!output) return approval && approval.approved === false ? { status: "declined" } : { status: "working" };
  switch (output.type) {
    case "skill_created":
    case "skill_updated":
      return {
        status: output.type === "skill_created" ? "created" : "updated",
        skillId: String(output.skillId ?? ""),
        name: String(output.name ?? ""),
        version: Number(output.version ?? 1),
        rights_mode: (output.rights_mode as RightsMode) ?? "private",
        enableOnAgent: output.enableOnAgent === true,
      };
    case "skill_no_access":
      return { status: "no_access", skill: String(output.skill ?? "") };
    default:
      return { status: "error", message: String(output.result ?? "") };
  }
}

/** The agent's skills as the chat holds them: the column is JSON and may arrive stringified. */
export function agentSkillRefs(agent: Pick<Agent, "skills">): Array<{ id: string; name: string }> {
  const raw: unknown = (agent as { skills?: unknown }).skills;
  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      list = [];
    }
  }
  return Array.isArray(list) ? list.filter(isRecord).map((s) => ({ id: String(s.id ?? ""), name: String(s.name ?? "") })).filter((s) => s.id) : [];
}

/**
 * A client-side read of the agent's write rights, good enough to decide
 * whether to offer "enable on this agent": the server re-checks on write.
 */
export function canEditAgent(
  agent: Pick<Agent, "rights_mode" | "RBAC"> & { created_by?: number | string | null },
  user: { id?: number; super_admin?: boolean; role?: { id?: string } | null; team?: { id?: string } | null } | null | undefined,
): boolean {
  if (!user?.id) return false;
  if (user.super_admin) return true;
  if (agent.created_by != null && String(agent.created_by) === String(user.id)) return true;
  if (agent.rights_mode === "public") return true;
  const rbac = agent.RBAC;
  if (!rbac) return false;
  if (agent.rights_mode === "users") return (rbac.users ?? []).some((u) => String(u.id) === String(user.id) && u.rights === "write");
  if (agent.rights_mode === "roles") return !!user.role?.id && (rbac.roles ?? []).some((r) => r.id === user.role?.id && r.rights === "write");
  if (agent.rights_mode === "teams") return !!user.team?.id && (rbac.teams ?? []).some((t) => t.id === user.team?.id && t.rights === "write");
  return false;
}
