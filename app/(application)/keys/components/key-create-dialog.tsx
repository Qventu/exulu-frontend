"use client";

/**
 * Create-key dialog (L3) — keys-token.md §3 "Create-key Dialog".
 *
 * Step 1: name + scope option cards (Admin / Agents) with one-line
 * consequence copy each — including the honest "acts as a super admin"
 * wording for Admin scope until the backend's U1 decision lands; RoleSelector
 * for Admin scope, allowlist builder for Agents scope (the role field is
 * REPLACED by the allowlist when scope = Agents, ladder row 5). Inline field
 * errors, CTA disabled until valid (ladder row 8).
 *
 * Step 2 (same dialog — no dialog-on-dialog): one-time reveal with the full
 * key in a wrapped mono block (`break-all`, responsive.md S5), CopyButton,
 * "shown only once" warning and an explicit Done button. While revealing,
 * Esc / outside-click / the X are disabled so the key cannot be lost
 * (ladder rows 11/20).
 *
 * Responsive (T5): full-screen sheet below `sm`; scope cards stack; allowlist
 * chips wrap. Step transition: 200 ms fade/rise, reduced-motion safe.
 */

import { Loader2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { CopyButton } from "@/components/primitives/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { CreateKeyInput, KeyScopeMode } from "../hooks";
import { KeyAttributionSelects } from "./key-attribution-selects";
import { KeysRoleSelector } from "./keys-role-selector";

export interface KeyCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Array<{ id: string; name: string }>;
  /** Performs generation + mutation; resolves the plaintext key (shown once). */
  onCreate: (input: CreateKeyInput) => Promise<string>;
}

type Step = "form" | "reveal";

export function KeyCreateDialog({
  open,
  onOpenChange,
  agents,
  onCreate,
}: KeyCreateDialogProps) {
  const t = useTranslations("keys");
  const tCommon = useTranslations("common");

  const [step, setStep] = React.useState<Step>("form");
  const [name, setName] = React.useState("");
  const [scopeMode, setScopeMode] = React.useState<KeyScopeMode>("admin");
  const [roleId, setRoleId] = React.useState("");
  const [agentIds, setAgentIds] = React.useState<string[]>([]);
  const [teamId, setTeamId] = React.useState<string | null>(null);
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [createdKey, setCreatedKey] = React.useState<string | null>(null);
  const [nameTouched, setNameTouched] = React.useState(false);
  const [agentsTouched, setAgentsTouched] = React.useState(false);

  // Fresh state every time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setStep("form");
      setName("");
      setScopeMode("admin");
      setRoleId("");
      setAgentIds([]);
      setTeamId(null);
      setProjectId(null);
      setSubmitting(false);
      setCreatedKey(null);
      setNameTouched(false);
      setAgentsTouched(false);
    }
  }, [open]);

  const nameError = name.trim().length === 0;
  const agentsError = scopeMode === "agents" && agentIds.length === 0;
  const valid = !nameError && !agentsError;
  // The one-time key (or an in-flight create) must not be lost to a stray
  // Esc / outside click — closing then requires the explicit Done button.
  const lockClose = submitting || step === "reveal";

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const plainKey = await onCreate({
        name: name.trim(),
        scopeMode,
        roleId: roleId || undefined,
        agentIds,
        teamId: teamId || undefined,
        projectId: projectId || undefined,
      });
      setCreatedKey(plainKey);
      setStep("reveal");
    } catch (error) {
      toast.error(t("create.createFailed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && lockClose) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (lockClose) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (lockClose) event.preventDefault();
        }}
        className={cn(
          // T5: full-screen sheet below `sm`, centered dialog from `sm:`.
          "flex h-dvh max-h-dvh w-full max-w-none flex-col gap-4 overflow-y-auto rounded-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:h-auto sm:max-h-[85dvh] sm:max-w-lg sm:rounded-lg sm:p-6",
          lockClose && "[&>button.absolute]:hidden",
        )}
      >
        {step === "form" ? (
          <div
            key="form"
            className="flex min-h-0 flex-1 flex-col gap-4 duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
          >
            <DialogHeader className="text-left">
              <DialogTitle>{t("create.title")}</DialogTitle>
              <DialogDescription>{t("create.description")}</DialogDescription>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4 sm:flex-none">
              {/* Name */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="key-name">{t("create.nameLabel")}</Label>
                <Input
                  id="key-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={() => setNameTouched(true)}
                  placeholder={t("create.namePlaceholder")}
                  autoComplete="off"
                  className="text-base sm:text-sm"
                  aria-invalid={nameTouched && nameError}
                />
                {nameTouched && nameError ? (
                  <p className="text-xs text-destructive" role="alert">
                    {t("create.nameRequired")}
                  </p>
                ) : null}
              </div>

              {/* Scope option cards */}
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">
                  {t("create.scopeLabel")}
                </legend>
                <RadioGroup
                  value={scopeMode}
                  onValueChange={(value) => setScopeMode(value as KeyScopeMode)}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                >
                  <ScopeCard
                    value="admin"
                    selected={scopeMode === "admin"}
                    title={t("create.scopeAdminTitle")}
                    description={t("create.scopeAdminDescription")}
                  />
                  <ScopeCard
                    value="agents"
                    selected={scopeMode === "agents"}
                    title={t("create.scopeAgentsTitle")}
                    description={t("create.scopeAgentsDescription")}
                  />
                </RadioGroup>
                {scopeMode === "agents" ? (
                  <p className="text-xs text-muted-foreground">
                    {t("create.roleIgnoredForAgents")}
                  </p>
                ) : null}
              </fieldset>

              {scopeMode === "admin" ? (
                /* Role (Admin scope only) */
                <div className="flex flex-col gap-2">
                  <Label>{t("create.roleLabel")}</Label>
                  <KeysRoleSelector
                    value={roleId}
                    onChange={setRoleId}
                    placeholder={t("create.rolePlaceholder")}
                  />
                  {/* Honest scope copy until the backend U1 decision lands. */}
                  <p className="text-xs text-warning">{t("adminRoleNotice")}</p>
                </div>
              ) : (
                /* Allowlist builder (Agents scope only) */
                <div className="flex flex-col gap-2">
                  <Label>{t("create.agentsLabel")}</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {agentIds.map((id) => {
                      const agent = agents.find((a) => a.id === id);
                      const agentLabel = agent?.name ?? id;
                      return (
                        <Badge
                          key={id}
                          variant="secondary"
                          className="h-10 gap-1 rounded-md pl-3 pr-1 md:h-8 md:pl-2.5"
                        >
                          <span className="max-w-40 truncate font-medium">
                            {agentLabel}
                          </span>
                          {/* The ONLY path to remove an agent — touch target:
                              size-10 (40 px) rendered below md, padded to 44 px
                              via the ::after inset overlay (responsive.md §2);
                              compact size-6 is desktop-pointer sugar at md+. */}
                          <button
                            type="button"
                            onClick={() => {
                              setAgentIds(agentIds.filter((x) => x !== id));
                              setAgentsTouched(true);
                            }}
                            aria-label={t("create.removeAgent", {
                              name: agentLabel,
                            })}
                            className="relative flex size-10 shrink-0 items-center justify-center rounded-md transition-colors duration-150 after:absolute after:-inset-0.5 hover:bg-muted-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-6 md:rounded-sm md:after:hidden"
                          >
                            <X aria-hidden="true" className="size-4 md:size-3.5" />
                          </button>
                        </Badge>
                      );
                    })}
                    <Select
                      value=""
                      onValueChange={(value) => {
                        if (value && !agentIds.includes(value)) {
                          setAgentIds([...agentIds, value]);
                          setAgentsTouched(true);
                        }
                      }}
                    >
                      <SelectTrigger className="h-10 w-full md:h-8 md:w-56">
                        <SelectValue placeholder={t("create.addAgent")} />
                      </SelectTrigger>
                      <SelectContent>
                        {agents
                          .filter((agent) => !agentIds.includes(agent.id))
                          .map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {agentsTouched && agentsError ? (
                    <p className="text-xs text-destructive" role="alert">
                      {t("create.agentsRequired")}
                    </p>
                  ) : null}
                </div>
              )}

              {/* Optional attribution targets (team / project) for LiteLLM
                  cost tracking — applies to both scopes. */}
              <KeyAttributionSelects
                teamId={teamId}
                projectId={projectId}
                onTeamChange={setTeamId}
                onProjectChange={setProjectId}
                disabled={submitting}
              />
            </div>

            <DialogFooter className="mt-auto gap-2 sm:mt-0">
              <Button
                type="button"
                variant="ghost"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!valid || submitting}
                aria-busy={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="mr-2 size-4 animate-spin"
                    />
                    {t("create.creating")}
                  </>
                ) : (
                  <>
                    <Plus aria-hidden="true" className="mr-2 size-4" />
                    {t("create.submit")}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div
            key="reveal"
            className="flex min-h-0 flex-1 flex-col gap-4 duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
          >
            <DialogHeader className="text-left">
              <DialogTitle>{t("create.revealTitle")}</DialogTitle>
              <DialogDescription>
                {t("create.revealDescription")}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-start gap-2 rounded-md bg-muted p-3">
              {/* break-all: the full key is verifiable without scrolling (S5). */}
              <code className="min-w-0 flex-1 select-all break-all font-mono text-sm">
                {createdKey}
              </code>
              <CopyButton
                value={createdKey ?? ""}
                label={t("create.copyKey")}
              />
            </div>

            <DialogFooter className="mt-auto sm:mt-0">
              <Button type="button" onClick={() => onOpenChange(false)}>
                {tCommon("done")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Selectable scope option card — RadioGroup semantics, card visuals. */
function ScopeCard({
  value,
  selected,
  title,
  description,
}: {
  value: KeyScopeMode;
  selected: boolean;
  title: string;
  description: string;
}) {
  const id = `key-scope-${value}`;
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex min-h-11 cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors duration-150",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
        selected ? "border-primary" : "border-input hover:bg-muted/50",
      )}
    >
      <RadioGroupItem value={value} id={id} className="sr-only" />
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs font-normal text-muted-foreground">
        {description}
      </span>
    </Label>
  );
}
