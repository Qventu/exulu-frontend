"use client";

/**
 * Knowledge base editing — config sheet content for the knowledge_base_editor
 * tool in the Tools section. One compact row per knowledge base: checkbox +
 * name, with a Create/Update pill toggle-group when enabled. Explicit opt-in:
 * deselecting both pills (or the checkbox) removes the context. Each handler
 * writes exactly ONE config entry through `update` — the sheet's update path
 * maps over the staged tools per call, so two updates in one handler would
 * drop the first.
 */

import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import type { ToolConfigEntry } from "../tool-config-fields";
import { parseKbEditingConfig, type KbWritePermission } from "./config-schema";

export function KbEditingConfigPanel({
  config,
  contexts,
  update,
}: {
  config: ToolConfigEntry[];
  contexts: { id: string; name: string }[];
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

  const setPermissions = (id: string, enabled: string[]) => {
    const perm: KbWritePermission = {
      create: enabled.includes("create"),
      update: enabled.includes("update"),
    };
    const next = { ...parsed.knowledgeBases };
    if (!perm.create && !perm.update) {
      delete next[id];
    } else {
      next[id] = perm;
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
      <div className="space-y-2">
        {contexts.map((ctx) => {
          const perms = parsed.knowledgeBases[ctx.id];
          const isOn = !!perms;
          return (
            <div
              key={ctx.id}
              className="flex items-center justify-between gap-3 rounded-md border p-3"
            >
              <label className="flex min-w-0 items-center gap-3">
                <Checkbox
                  checked={isOn}
                  onCheckedChange={(v) => setContextEnabled(ctx.id, v === true)}
                />
                <span className="truncate text-sm font-medium">{ctx.name}</span>
              </label>
              {isOn && (
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  value={[
                    ...(perms.create ? ["create"] : []),
                    ...(perms.update ? ["update"] : []),
                  ]}
                  onValueChange={(next) => setPermissions(ctx.id, next)}
                >
                  <ToggleGroupItem
                    value="create"
                    aria-label={t("editor.knowledge.editing.createLabel")}
                  >
                    <Plus className="mr-1 size-3.5" />
                    {t("editor.knowledge.editing.createLabel")}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="update"
                    aria-label={t("editor.knowledge.editing.updateLabel")}
                  >
                    <Pencil className="mr-1 size-3.5" />
                    {t("editor.knowledge.editing.updateLabel")}
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            </div>
          );
        })}
      </div>

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
