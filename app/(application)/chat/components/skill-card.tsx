"use client";

/**
 * The skill-authoring card (spec: memory card pattern). Replaces the generic
 * approval card for tool-skill_create / tool-skill_update parts:
 *
 *   pending  → name, description, the proposed files, who may see it
 *              (RBACControl, create only), "enable on this agent" when the
 *              viewer may edit the agent; Create / Don't create
 *   working  → spinner
 *   created / updated → status, "Open skill", enable-on-agent outcome, and
 *              "Reload skills" which re-installs the agent's skills into the
 *              live sandbox so the new version is usable right away
 *
 * The card's choices travel back inside the approval reason; the tool reads
 * them (backend src/exulu/skills/decisions.ts).
 */

import { useMutation } from "@apollo/client";
import type { ChatAddToolApproveResponseFunction, DynamicToolUIPart } from "ai";
import { BookOpen, Check, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { RBACControl } from "@/components/rbac";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sessionFilesApi } from "@/lib/api/session-files";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/models/agent";

import { ENABLE_SKILL_ON_AGENT } from "../queries";
import { DECLINED_REASON, type RbacGrant, type RightsMode } from "./memory-card-data";
import { agentSkillRefs, canEditAgent, encodeSkillDecision, skillProposalFromPart, skillResolvedState, type SkillDecision } from "./skill-card-data";

export interface SkillCardProps {
  part: DynamicToolUIPart;
  agent: Agent;
  sessionId: string;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
}

type Edits = { name: string; description: string; label: string; rights_mode: RightsMode; users: RbacGrant[]; roles: RbacGrant[]; teams: RbacGrant[]; enableOnAgent: boolean };

const formatBytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

export function SkillCard({ part, agent, sessionId, addToolApprovalResponse }: SkillCardProps) {
  const t = useTranslations("chat");
  const { user } = React.useContext(UserContext);
  const proposal = React.useMemo(() => skillProposalFromPart(part), [part]);
  const resolved = React.useMemo(() => skillResolvedState(part), [part]);
  const approvalId = (part as { approval?: { id?: string } }).approval?.id;
  const isUpdate = proposal?.kind === "update";
  const canEdit = canEditAgent(agent as any, user);
  const agentSkills = React.useMemo(() => agentSkillRefs(agent), [agent]);

  const [state, setState] = React.useState<Edits>(() => ({
    name: proposal?.name ?? "",
    description: proposal?.description ?? "",
    label: proposal?.label ?? "",
    rights_mode: "private",
    users: [],
    roles: [],
    teams: [],
    enableOnAgent: canEdit,
  }));

  const decide = (approved: boolean) => {
    if (!approvalId || !proposal) return;
    const decision: SkillDecision = isUpdate
      ? { v: 1, kind: "update", ...(state.label.trim() ? { label: state.label.trim() } : {}), ...(state.description.trim() && state.description !== proposal.description ? { description: state.description.trim() } : {}), ...(state.enableOnAgent ? { enableOnAgent: true } : {}) }
      : {
          v: 1,
          kind: "create",
          name: state.name.trim(),
          description: state.description.trim(),
          rights_mode: state.rights_mode,
          ...(state.rights_mode === "users" ? { rbac: { users: state.users } } : state.rights_mode === "roles" ? { rbac: { roles: state.roles } } : state.rights_mode === "teams" ? { rbac: { teams: state.teams } } : {}),
          ...(state.enableOnAgent ? { enableOnAgent: true } : {}),
        };
    addToolApprovalResponse({ id: approvalId, approved, reason: approved ? encodeSkillDecision(decision) : DECLINED_REASON });
  };

  // After a successful create/update with "enable on this agent": one write
  // per card, then the reload offer.
  const [enableSkill, { loading: enabling }] = useMutation(ENABLE_SKILL_ON_AGENT);
  const enabledRef = React.useRef<string | null>(null);
  const [enabledState, setEnabledState] = React.useState<"idle" | "done" | "already" | "failed">("idle");
  React.useEffect(() => {
    if (resolved.status !== "created" && resolved.status !== "updated") return;
    if (!resolved.enableOnAgent || !resolved.skillId || enabledRef.current === resolved.skillId) return;
    enabledRef.current = resolved.skillId;
    if (agentSkills.some((s) => s.id === resolved.skillId)) {
      setEnabledState("already");
      return;
    }
    enableSkill({ variables: { id: agent.id, skills: JSON.stringify([...agentSkills, { id: resolved.skillId, name: resolved.name }]) } })
      .then(() => setEnabledState("done"))
      .catch(() => setEnabledState("failed"));
  }, [resolved, agent.id, agentSkills, enableSkill]);

  const [reloading, setReloading] = React.useState(false);
  const [reloaded, setReloaded] = React.useState(false);
  const reload = async () => {
    if (!sessionId) return;
    setReloading(true);
    try {
      const out = await sessionFilesApi.reloadSkills(sessionId);
      setReloaded(true);
      toast.success(out?.sandbox ? t("skillAuthor.reloaded", { count: out.refreshed ?? 0 }) : t("skillAuthor.reloadNoSandbox"));
    } catch (err) {
      toast.error(t("skillAuthor.reloadFailed"), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setReloading(false);
    }
  };

  if (!proposal) return null;

  const subjectsMissing =
    !isUpdate &&
    ((state.rights_mode === "users" && state.users.length === 0) || (state.rights_mode === "roles" && state.roles.length === 0) || (state.rights_mode === "teams" && state.teams.length === 0));

  const header = (title: string, hint?: string) => (
    <div className="flex items-start gap-3">
      <div className="rounded-md bg-muted p-2">
        <BookOpen aria-hidden="true" className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );

  if (resolved.status === "pending") {
    return (
      <div className="my-2 space-y-4 rounded-lg border p-4">
        {header(isUpdate ? t("skillAuthor.updateTitle", { name: proposal.name }) : t("skillAuthor.createTitle"), t("skillAuthor.hint"))}
        {!isUpdate && (
          <div className="space-y-1.5">
            <Label htmlFor={`skill-name-${part.toolCallId}`}>{t("skillAuthor.name")}</Label>
            <Input id={`skill-name-${part.toolCallId}`} value={state.name} maxLength={80} onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor={`skill-desc-${part.toolCallId}`}>{t("skillAuthor.description")}</Label>
          <Textarea id={`skill-desc-${part.toolCallId}`} rows={2} value={state.description} onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))} />
        </div>
        {isUpdate && (
          <div className="space-y-1.5">
            <Label htmlFor={`skill-label-${part.toolCallId}`}>{t("skillAuthor.versionLabel")}</Label>
            <Input id={`skill-label-${part.toolCallId}`} value={state.label} onChange={(e) => setState((s) => ({ ...s, label: e.target.value }))} placeholder={t("skillAuthor.versionLabelPlaceholder")} />
          </div>
        )}
        {(proposal.files.length > 0 || proposal.deletePaths.length > 0) && (
          <div className="space-y-1.5">
            <Label>{t("skillAuthor.files")}</Label>
            <ul className="divide-y rounded-md border text-sm">
              {proposal.files.map((f) => (
                <li key={f.path} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <code className="truncate">{f.path}</code>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.bytes)}</span>
                </li>
              ))}
              {proposal.deletePaths.map((p) => (
                <li key={`del-${p}`} className="flex items-center justify-between gap-3 px-3 py-1.5 text-muted-foreground">
                  <code className="truncate line-through">{p}</code>
                  <span className="shrink-0 text-xs">{t("skillAuthor.removed")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!isUpdate && (
          <div className="space-y-1.5">
            <Label>{t("skillAuthor.whoCanSee")}</Label>
            <RBACControl
              subjectLabel="skill"
              initialRightsMode={state.rights_mode}
              initialUsers={[]}
              initialRoles={[]}
              initialTeams={[]}
              onChange={(rights_mode, users, roles, teams) => setState((s) => ({ ...s, rights_mode, users, roles, teams }))}
            />
          </div>
        )}
        {canEdit && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={state.enableOnAgent} onCheckedChange={(v) => setState((s) => ({ ...s, enableOnAgent: v === true }))} />
            {isUpdate ? t("skillAuthor.reloadAfter", { agent: agent.name }) : t("skillAuthor.enableOnAgent", { agent: agent.name })}
          </label>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => decide(false)}>
            {t("skillAuthor.decline")}
          </Button>
          <Button type="button" className="h-11 sm:h-9" disabled={(!isUpdate && !state.name.trim()) || subjectsMissing} onClick={() => decide(true)}>
            {isUpdate ? t("skillAuthor.publish") : t("skillAuthor.create")}
          </Button>
        </div>
      </div>
    );
  }

  if (resolved.status === "working") {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm text-muted-foreground">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        {isUpdate ? t("skillAuthor.publishing") : t("skillAuthor.creating")}
      </div>
    );
  }

  if (resolved.status === "declined") {
    return <div className="my-2 rounded-lg border px-4 py-3 text-sm text-muted-foreground">{t("skillAuthor.declined")}</div>;
  }

  if (resolved.status === "no_access") {
    return <div className="my-2 rounded-lg border px-4 py-3 text-sm">{t("skillAuthor.noAccess", { skill: resolved.skill })}</div>;
  }

  if (resolved.status === "error") {
    return <div className="my-2 rounded-lg border border-destructive/40 px-4 py-3 text-sm">{t("skillAuthor.error", { message: resolved.message })}</div>;
  }

  const mode = t(`memory.mode.${resolved.rights_mode}`);
  return (
    <div className="my-2 space-y-3 rounded-lg border p-4">
      {header(
        resolved.status === "created" ? t("skillAuthor.created", { name: resolved.name, mode }) : t("skillAuthor.updated", { name: resolved.name, version: resolved.version }),
        resolved.enableOnAgent
          ? enabledState === "done"
            ? t("skillAuthor.enabled", { agent: agent.name })
            : enabledState === "already"
              ? t("skillAuthor.alreadyEnabled", { agent: agent.name })
              : enabledState === "failed"
                ? t("skillAuthor.enableFailed")
                : enabling
                  ? t("skillAuthor.enabling")
                  : undefined
          : undefined,
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild type="button" variant="outline" size="sm">
          <Link href={`/skills/${resolved.skillId}`}>
            <ExternalLink aria-hidden="true" className="mr-2 size-4" />
            {t("skillAuthor.open")}
          </Link>
        </Button>
        {(resolved.status === "updated" || enabledState === "done" || enabledState === "already") && sessionId && (
          <Button type="button" size="sm" variant={reloaded ? "outline" : "default"} disabled={reloading || reloaded} onClick={() => void reload()} className={cn(reloaded && "text-muted-foreground")}>
            {reloaded ? <Check aria-hidden="true" className="mr-2 size-4" /> : <RefreshCw aria-hidden="true" className={cn("mr-2 size-4", reloading && "animate-spin")} />}
            {reloaded ? t("skillAuthor.reloadedShort") : t("skillAuthor.reload")}
          </Button>
        )}
      </div>
    </div>
  );
}
