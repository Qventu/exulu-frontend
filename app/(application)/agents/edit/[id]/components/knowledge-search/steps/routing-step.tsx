"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  ruleIdFromLabel, selectedKbIds, type RoutingRule, type WizardConfig,
} from "../config-schema";

/** Toggleable KB chips used for a rule's main/fallback lists. */
function KbChips({
  ids, active, onToggle,
}: {
  ids: { id: string; name: string }[];
  active: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((kb) => (
        <Badge
          key={kb.id}
          variant={active.includes(kb.id) ? "default" : "outline"}
          className="cursor-pointer select-none"
          onClick={() => onToggle(kb.id)}
        >
          {kb.name}
        </Badge>
      ))}
    </div>
  );
}

export function RoutingStep({
  draft, setDraft, contexts,
}: {
  draft: WizardConfig;
  setDraft: (updater: (prev: WizardConfig) => WizardConfig) => void;
  contexts: { id: string; name: string; description?: string }[];
}) {
  const t = useTranslations("agents");
  const enabledIds = selectedKbIds(draft, contexts.map((c) => c.id));
  const enabledKbs = contexts
    .filter((c) => enabledIds.includes(c.id))
    .map((c) => ({ id: c.id, name: c.name }));

  const setRules = (rules: RoutingRule[]) =>
    setDraft((prev) => ({ ...prev, routing: { rules } }));

  const updateRule = (idx: number, patch: Partial<RoutingRule>) =>
    setRules(draft.routing.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const toggleIn = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const addRule = () =>
    setRules([
      ...draft.routing.rules,
      {
        id: ruleIdFromLabel(
          t("editor.knowledge.wizard.routing.newRuleLabel"),
          draft.routing.rules.map((r) => r.id),
        ),
        label: "", description: "", main: [], fallback: [],
      },
    ]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("editor.knowledge.wizard.routing.intro")}
      </p>
      <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
        {t("editor.knowledge.wizard.routing.defaultNote")}
      </p>

      {draft.routing.rules.map((rule, idx) => (
        <div key={rule.id} className="space-y-3 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <Input
              placeholder={t("editor.knowledge.wizard.routing.labelPlaceholder")}
              value={rule.label}
              onChange={(e) =>
                updateRule(idx, {
                  label: e.target.value,
                  id: ruleIdFromLabel(
                    e.target.value || rule.id,
                    draft.routing.rules.filter((_, i) => i !== idx).map((r) => r.id),
                  ),
                })
              }
            />
            <Button
              type="button" variant="ghost" size="icon"
              aria-label={t("editor.knowledge.wizard.routing.removeRule")}
              onClick={() => setRules(draft.routing.rules.filter((_, i) => i !== idx))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <Textarea
            rows={2}
            placeholder={t("editor.knowledge.wizard.routing.descriptionPlaceholder")}
            value={rule.description}
            onChange={(e) => updateRule(idx, { description: e.target.value })}
          />
          <div className="space-y-1">
            <p className="text-xs font-medium">
              {t("editor.knowledge.wizard.routing.mainLabel")}
            </p>
            <KbChips
              ids={enabledKbs}
              active={rule.main}
              onToggle={(id) => updateRule(idx, { main: toggleIn(rule.main, id) })}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">
              {t("editor.knowledge.wizard.routing.fallbackLabel")}
            </p>
            <KbChips
              ids={enabledKbs.filter((kb) => !rule.main.includes(kb.id))}
              active={rule.fallback}
              onToggle={(id) => updateRule(idx, { fallback: toggleIn(rule.fallback, id) })}
            />
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addRule}>
        <Plus className="mr-1 size-4" />
        {t("editor.knowledge.wizard.routing.addRule")}
      </Button>
    </div>
  );
}
