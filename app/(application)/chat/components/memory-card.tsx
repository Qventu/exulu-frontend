"use client";

/**
 * Memory-specific approval card (spec §4.1). Renders for tool-memory_* parts in
 * place of ToolCallApproval. Save approves the call with the edits encoded in
 * the approval reason; Don't save denies with "declined". No "Allow for this
 * chat" — the card is the consent.
 *
 * DEVIATION (task-11-report.md): GET_ITEMS/PAGINATION_POSTFIX/GET_CONTEXT_BY_ID
 * are imported from the local ../queries (chat/queries.ts), not
 * @/app/(application)/data/queries — eslint's feature-isolation guardrail
 * (eslint.config.mjs) bans chat/** from importing data/**. Chat's copy is
 * byte-identical to the data feature's GET_ITEMS/PAGINATION_POSTFIX (itself a
 * verbatim copy of queries/queries.ts), so the generated Filter<Ctx>_items
 * input and items/pageInfo shape still match the schema exactly.
 */
import { useQuery } from "@apollo/client";
import type { ChatAddToolApproveResponseFunction, DynamicToolUIPart } from "ai";
import { Bookmark, CheckCircle2, Loader2, Trash2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { RBACControl } from "@/components/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/models/agent";

import { GET_CONTEXT_BY_ID, GET_ITEMS, PAGINATION_POSTFIX } from "../queries";
import {
  DECLINED_REASON, encodeMemoryDecision, memoryProposalFromPart, memoryResolvedState,
  type MemoryDecision, type RbacGrant, type RightsMode,
} from "./memory-card-data";
import { useMemoryEdits } from "./memory-stack";

export interface MemoryCardProps {
  part: DynamicToolUIPart;
  agent: Agent;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  /** Rendered inside a stack: hide per-card Save (the stack's Save all approves). */
  inStack?: boolean;
}

type Edits = { title: string; information: string; type: string; rights_mode: RightsMode; users: RbacGrant[]; roles: RbacGrant[]; teams: RbacGrant[] };

// Priority: an explicit visibility hint (the user told the agent who may see
// this) outranks the agent's preselect_private default, which outranks the
// context default — an explicit statement always wins over a standing default.
const preselect = (agent: Agent, contextDefault: RightsMode | undefined, hint: "private" | "public" | null): RightsMode => {
  if (hint) return hint;
  const raw = (agent as { memory_config?: unknown }).memory_config;
  // memory_config is a json column; the hooks.ts save path sends it
  // JSON.stringify'd (mirrors tools/skills — see hooks.ts's save callback),
  // and a demo/mock resolver can hand back the same raw string too. Parse
  // before reading `.visibility` so a stringified source doesn't silently
  // fall through to the context default instead of preselecting private.
  let cfg: { visibility?: string } | undefined;
  if (typeof raw === "string") {
    try {
      cfg = JSON.parse(raw);
    } catch {
      cfg = undefined;
    }
  } else if (raw && typeof raw === "object") {
    cfg = raw as { visibility?: string };
  }
  if (cfg?.visibility === "preselect_private") return "private";
  return contextDefault ?? "private";
};

export function MemoryCard({ part, agent, addToolApprovalResponse, inStack = false }: MemoryCardProps) {
  const t = useTranslations("chat");
  const proposal = memoryProposalFromPart(part);
  const resolved = memoryResolvedState(part);
  const approvalId = (part as { approval?: { id?: string } }).approval?.id;
  const edits = useMemoryEdits();

  const { data, loading } = useQuery(GET_CONTEXT_BY_ID, {
    variables: { id: agent.memory ?? "" },
    skip: !agent.memory,
  });
  const context = data?.contextById as { fields?: { name: string; type: string; enumValues?: string[] }[]; configuration?: { defaultRightsMode?: RightsMode } } | undefined;
  // Memoized: a fresh [] every render would churn the effects below (both
  // list `typeValues` as a dependency) on every render, not just when the
  // context query result actually changes.
  const typeValues = React.useMemo(
    () => context?.fields?.find((f) => f.name === "type")?.enumValues ?? [],
    [context],
  );

  // `state` starts null and is only populated once the context query settles
  // (or there is no memory context to query) — a lazy useState initializer
  // ran once at mount, before GET_CONTEXT_BY_ID resolved, so the context
  // default was always undefined and RBACControl (uncontrolled after mount)
  // never saw the real default land. Gating the form on `state !== null`
  // means RBACControl only ever mounts with its final initialRightsMode.
  const [state, setState] = React.useState<Edits | null>(null);
  const [confirmForget, setConfirmForget] = React.useState(false);

  React.useEffect(() => {
    if (state !== null) return;
    if (agent.memory && loading) return;
    setState({
      title: proposal?.title ?? "",
      information: proposal?.information ?? "",
      type: proposal?.type || typeValues[0] || "",
      rights_mode: preselect(agent, context?.configuration?.defaultRightsMode, proposal?.visibility ?? null),
      users: [], roles: [], teams: [],
    });
  }, [state, agent, loading, proposal, context, typeValues]);

  // Register current edits with the stack so "Save all" can read them.
  // No-ops while `state` is still null — nothing to register yet.
  React.useEffect(() => {
    if (!approvalId || state === null) return;
    edits?.register(part.toolCallId, () => decisionFor(proposal?.kind ?? "remember", state, typeValues));
    return () => edits?.unregister(part.toolCallId);
  }, [approvalId, part.toolCallId, state, proposal?.kind, edits, typeValues]);

  if (!proposal) return null;

  // ── Resolved line ─────────────────────────────────────────────────────────
  if (resolved.status !== "pending") {
    const tone = resolved.status === "declined" || resolved.status === "error" || resolved.status === "no_access" ? "muted" : resolved.status === "working" ? "muted" : "success";
    const Icon = resolved.status === "working" ? Loader2 : tone === "success" ? CheckCircle2 : XCircle;
    // Deviation from the brief's nested-ternary chain: with `status` as a
    // union discriminant that one member ("saved" | "updated") itself
    // multiplexes, TS's ternary control-flow narrowing left `resolved`
    // un-narrowed at the final branch (TS2339 on `.message`). A switch
    // narrows each case reliably.
    let text: string;
    switch (resolved.status) {
      case "working": text = t("memory.working"); break;
      case "saved": text = t("memory.saved", { mode: t(`memory.mode.${resolved.rights_mode}`) }); break;
      case "updated": text = t("memory.updated"); break;
      case "forgotten": text = t("memory.forgotten"); break;
      case "declined": text = t("memory.declined"); break;
      case "no_access": text = resolved.createdBy ? t("memory.noAccess", { name: resolved.createdBy.name }) : t("memory.noAccessUnknown"); break;
      case "error": text = t("memory.error", { message: resolved.message }); break;
      default: text = t("memory.error", { message: "error" });
    }
    return (
      <div role="status" className={cn("mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", tone === "success" ? "border-success/30 bg-success/5 text-success" : "border-border bg-muted/40 text-muted-foreground")}>
        <Icon className={cn("size-4 shrink-0", resolved.status === "working" && "animate-spin")} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{text}</span>
        {(resolved.status === "saved" || resolved.status === "updated") && (
          <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
            <Link href={`/data/${resolved.contextId}/items/${resolved.itemId}`}>{t("memory.open")}</Link>
          </Button>
        )}
      </div>
    );
  }

  if (!approvalId) return null;

  // Waiting on the context query (RBAC default + type enum): render the
  // header only, never the form — RBACControl must mount with its final
  // initialRightsMode, not a placeholder that a later prop change can't fix.
  if (state === null) {
    return (
      <Card className="mt-3 border-border bg-card" data-demo-id="chat-memory-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            {proposal.kind === "forget" ? <Trash2 className="size-4 text-muted-foreground" aria-hidden="true" /> : <Bookmark className="size-4 text-muted-foreground" aria-hidden="true" />}
            {proposal.kind === "update" ? t("memory.updateTitle") : proposal.kind === "forget" ? t("memory.forgetTitle") : t("memory.rememberTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const decide = (approved: boolean) =>
    addToolApprovalResponse({ id: approvalId, approved, reason: approved ? encodeMemoryDecision(decisionFor(proposal.kind, state, typeValues)) : DECLINED_REASON });

  // ── Forget: ConfirmDialog instead of a form ───────────────────────────────
  if (proposal.kind === "forget") {
    return (
      <Card className="mt-3 border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-medium"><Trash2 className="size-4 text-muted-foreground" aria-hidden="true" />{t("memory.forgetTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <MemoryRef memoryId={proposal.memoryId} agent={agent} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="h-11 sm:h-9 sm:flex-1" onClick={() => decide(false)}>{t("memory.keep")}</Button>
            <Button variant="destructive" className="h-11 sm:h-9 sm:flex-1" onClick={() => setConfirmForget(true)}>{t("memory.forget")}</Button>
          </div>
          <ConfirmDialog open={confirmForget} onOpenChange={setConfirmForget} variant="destructive" title={t("memory.forgetTitle")}
            description={t("memory.forgetDescription", { title: proposal.title || proposal.memoryId || "", agent: agent.name })}
            confirmLabel={t("memory.forget")} onConfirm={async () => { decide(true); }} />
        </CardContent>
      </Card>
    );
  }

  // ── Remember / update form ────────────────────────────────────────────────
  const isUpdate = proposal.kind === "update";
  return (
    <Card className="mt-3 border-border bg-card" data-demo-id="chat-memory-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Bookmark className="size-4 text-muted-foreground" aria-hidden="true" />
          {isUpdate ? t("memory.updateTitle") : t("memory.rememberTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isUpdate && <MemoryRef memoryId={proposal.memoryId} agent={agent} label={t("memory.current")} />}
        <div className="space-y-1">
          <Label htmlFor={`mem-${part.toolCallId}`}>{isUpdate ? t("memory.proposed") : t("memory.wording")}</Label>
          <Textarea id={`mem-${part.toolCallId}`} value={state.information} rows={3} onChange={(e) => setState((s) => (s ? { ...s, information: e.target.value } : s))} />
        </div>
        {typeValues.length > 0 && (
          <div className="space-y-1">
            <Label>{t("memory.type")}</Label>
            <Select value={state.type || typeValues[0]} onValueChange={(v) => setState((s) => (s ? { ...s, type: v } : s))}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>{typeValues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {!isUpdate && (
          <div className="space-y-1">
            <Label>{t("memory.whoCanSee")}</Label>
            <RBACControl subjectLabel="memory" initialRightsMode={state.rights_mode} initialUsers={[]} initialRoles={[]} initialTeams={[]}
              onChange={(rights_mode, users, roles, teams) => setState((s) => (s ? { ...s, rights_mode, users, roles, teams } : s))} />
          </div>
        )}
        {!inStack && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="h-11 sm:h-9 sm:flex-1" onClick={() => decide(false)}>{isUpdate ? t("memory.keep") : t("memory.dontSave")}</Button>
            <Button className="h-11 sm:h-9 sm:flex-1" disabled={!state.information.trim()} onClick={() => decide(true)}>{isUpdate ? t("memory.update") : t("memory.save")}</Button>
          </div>
        )}
        {!isUpdate && <p className="text-xs text-muted-foreground">{t("memory.rememberHint")}</p>}
      </CardContent>
    </Card>
  );
}

function decisionFor(kind: "remember" | "update" | "forget", s: Edits, typeValues: string[]): MemoryDecision {
  if (kind === "forget") return { v: 1, kind: "forget" };
  if (kind === "update") return { v: 1, kind: "update", information: s.information, ...(s.title ? { title: s.title } : {}), ...(s.type ? { type: s.type } : {}) };
  const rbac = s.rights_mode === "users" ? { users: s.users } : s.rights_mode === "roles" ? { roles: s.roles } : s.rights_mode === "teams" ? { teams: s.teams } : undefined;
  // A "remember" always needs a type — fall back to the first available
  // value rather than let an empty select submit "" (finding 3).
  const type = s.type || typeValues[0] || "";
  return { v: 1, kind: "remember", title: s.title || s.information.slice(0, 80), information: s.information, type, rights_mode: s.rights_mode, ...(rbac ? { rbac } : {}) };
}

/** Shows the current wording of an existing memory (update/forget cards). */
function MemoryRef({ memoryId, agent, label }: { memoryId: string | null; agent: Agent; label?: string }) {
  const contextId = agent.memory ?? "";
  const { data } = useQuery(GET_ITEMS(contextId, ["id", "name", "information", "rights_mode", "created_by", "createdAt"]), {
    variables: { page: 1, limit: 1, filters: [{ id: { eq: memoryId ?? "" } }] },
    skip: !memoryId || !contextId,
  });
  const item = data?.[`${contextId}${PAGINATION_POSTFIX}`]?.items?.[0] as { name?: string; information?: string } | undefined;
  if (!memoryId) return null;
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
      {label && <p className="mb-1 text-xs text-muted-foreground">{label}</p>}
      <p className={cn(label && "line-through decoration-muted-foreground/60")}>{item?.information ?? item?.name ?? memoryId}</p>
    </div>
  );
}
