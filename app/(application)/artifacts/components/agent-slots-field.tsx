"use client";

/**
 * Assigns IMP agents to named "slots" on a published app artifact, so the
 * artifact's own sandboxed code can open one of them in a chat panel beside
 * it. The key is whatever string the artifact's code binds a button to —
 * renaming it later breaks that binding — hence its own helper text.
 *
 * Hidden entirely for non-app artifacts (`isApp` false): the gate lives in
 * the outer component, which calls no hooks, and renders the hook-using
 * part (translations, GET_AGENTS) only as a child component that mounts
 * when `isApp` is true. That keeps the isApp check from being a conditional
 * hook call — the inner component's hooks always run unconditionally
 * whenever it exists at all.
 */

import { useQuery } from "@apollo/client";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AgentSlot } from "@/lib/api/shared-artifacts";
import { GET_AGENTS } from "@/queries/queries";
import type { Agent } from "@/types/models/agent";

export interface AgentSlotsFieldProps {
  value: AgentSlot[];
  onChange: (slots: AgentSlot[]) => void;
  disabled?: boolean;
  isApp: boolean;
}

export function AgentSlotsField({ isApp, ...rest }: AgentSlotsFieldProps) {
  if (!isApp) return null;
  return <AgentSlotsFieldRows {...rest} />;
}

function AgentSlotsFieldRows({ value, onChange, disabled = false }: Omit<AgentSlotsFieldProps, "isApp">) {
  const t = useTranslations("artifacts");
  const [key, setKey] = React.useState("");
  const [agentId, setAgentId] = React.useState("");

  // `error` is destructured and rendered, not swallowed: a failed query also
  // yields `agents = []`, which makes the Select empty and `canAdd`
  // permanently false — a dead "Add" button indistinguishable from "this
  // instance has no agents at all". This field is the feature's ONLY
  // configuration surface, so a silent failure here means an admin cannot
  // assign an agent and is told nothing about why.
  const { data, error } = useQuery(GET_AGENTS, {
    variables: { page: 1, limit: 200, filters: [{ active: { eq: true } }] },
  });
  const agents: Agent[] = data?.agentsPagination?.items ?? [];
  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? id;

  const trimmedKey = key.trim();
  const duplicate = trimmedKey !== "" && value.some((slot) => slot.key === trimmedKey);
  const canAdd = !disabled && trimmedKey !== "" && agentId !== "" && !duplicate;

  const add = () => {
    if (!canAdd) return;
    onChange([...value, { key: trimmedKey, agentId }]);
    setKey("");
    setAgentId("");
  };

  const remove = (slotKey: string) => onChange(value.filter((slot) => slot.key !== slotKey));

  return (
    <div className="space-y-1.5">
      <Label>{t("agentSlotsLabel")}</Label>
      <p className="text-xs text-muted-foreground">{t("agentSlotsKeyHint")}</p>

      {value.length > 0 && (
        <div className="space-y-1">
          {value.map((slot) => (
            <div key={slot.key} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{slot.key}</span>
                <span className="text-muted-foreground"> → {agentName(slot.agentId)}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("agentSlotRemove", { key: slot.key })}
                title={t("agentSlotRemove", { key: slot.key })}
                disabled={disabled}
                onClick={() => remove(slot.key)}
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={t("agentSlotKeyPlaceholder")}
          aria-label={t("agentSlotKeyPlaceholder")}
          disabled={disabled}
          className="w-36"
        />
        <Select value={agentId} onValueChange={setAgentId} disabled={disabled}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("agentSlotAgentPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" variant="outline" disabled={!canAdd} onClick={add}>
          {t("agentSlotAdd")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {t("agentSlotsLoadFailed")}
        </p>
      )}
      {duplicate && <p className="text-xs text-destructive">{t("agentSlotDuplicateKey")}</p>}
    </div>
  );
}
