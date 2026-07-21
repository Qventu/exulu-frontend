"use client";

/**
 * Knowledge base editing — config sheet content for the knowledge_base_editor
 * tool in the Tools section. Per-context create/update checkboxes are explicit
 * opt-in (unchecking both removes the context). Each handler writes exactly ONE
 * config entry through `update` — the sheet's update path maps over the staged
 * tools per call, so two updates in one handler would drop the first.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

import type { ToolConfigEntry } from "../tool-config-fields";
import { parseKbEditingConfig, type KbWritePermission } from "./config-schema";

export function KbEditingConfigPanel({
  config,
  contexts,
  update,
}: {
  config: ToolConfigEntry[];
  contexts: { id: string; name: string; description?: string }[];
  update: (value: any, name: string) => void;
}) {
  const t = useTranslations("agents");

  const parsed = parseKbEditingConfig(config);

  const applyKnowledgeBases = (next: Record<string, KbWritePermission>) => {
    update(JSON.stringify(next), "knowledge_bases");
  };

  const setContextEnabled = (id: string, on: boolean) => {
    const next = { ...parsed.knowledgeBases };
    if (on) {
      next[id] = { create: true, update: false };
    } else {
      delete next[id];
    }
    applyKnowledgeBases(next);
  };

  const setPermission = (id: string, key: "create" | "update", on: boolean) => {
    const current = parsed.knowledgeBases[id] ?? { create: false, update: false };
    const nextPerm = { ...current, [key]: on };
    const next = { ...parsed.knowledgeBases };
    if (!nextPerm.create && !nextPerm.update) {
      delete next[id];
    } else {
      next[id] = nextPerm;
    }
    applyKnowledgeBases(next);
  };

  return (
    <div className="space-y-3">
      {contexts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("editor.knowledge.noContexts")}
        </p>
      )}
      {contexts.map((ctx) => {
        const perms = parsed.knowledgeBases[ctx.id];
        const isOn = !!perms;
        return (
          <div key={ctx.id} className="space-y-3 rounded-md border p-3">
            <label className="flex items-start gap-3">
              <Checkbox
                checked={isOn}
                onCheckedChange={(v) => setContextEnabled(ctx.id, v === true)}
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">{ctx.name}</span>
                {ctx.description && (
                  <span className="block text-xs text-muted-foreground">
                    {ctx.description}
                  </span>
                )}
              </span>
            </label>
            {isOn && (
              <div className="flex gap-6 border-t pt-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={perms.create}
                    onCheckedChange={(v) => setPermission(ctx.id, "create", v === true)}
                  />
                  {t("editor.knowledge.editing.createLabel")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={perms.update}
                    onCheckedChange={(v) => setPermission(ctx.id, "update", v === true)}
                  />
                  {t("editor.knowledge.editing.updateLabel")}
                </label>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-start justify-between gap-3 border-t pt-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {t("editor.knowledge.editing.skipApprovalTitle")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("editor.knowledge.editing.skipApprovalDescription")}
          </p>
        </div>
        <Switch
          checked={parsed.skipApproval}
          onCheckedChange={(v) => update(v ? "true" : "false", "skip_approval")}
          aria-label={t("editor.knowledge.editing.skipApprovalTitle")}
        />
      </div>
    </div>
  );
}
